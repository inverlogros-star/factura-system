import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

interface FilaMysql {
  Ent_Numero: string
  Ent_Nit: string
  Emp_Razon: string
  Ent_Fecha: Date | string
  Ent_NoFactura: string
  Ent_VrFactura: number
  Ent_Neto: number
  EntDet_Barra: string
  EntDet_Articulo: string
  EntDet_CanRec: number
  EntDet_Costo: number
  EntDet_CostoNeto: number
  EntDet_TotalNeto: number
  EntDet_Descue01: number
  EntDet_Descue02: number
  EntDet_Descue03: number
  EntDet_Iva: number
  EntDet_IConsumo: number
  EntDet_IBUA: number
  EntDet_ICUI: number
}

function formatFecha(val: Date | string | null): string {
  if (!val) return ''
  if (val instanceof Date) return val.toISOString().slice(0, 10)
  return String(val).slice(0, 10)
}

export async function POST(req: NextRequest) {
  const { fechaInicio, fechaFin } = await req.json()
  if (!fechaInicio || !fechaFin) {
    return NextResponse.json({ error: 'Se requieren fechaInicio y fechaFin' }, { status: 400 })
  }

  // mysql2 solo disponible en entorno local
  let mysql: any
  try {
    mysql = require('mysql2/promise')
  } catch {
    return NextResponse.json({ error: 'mysql2 no disponible en este entorno' }, { status: 503 })
  }

  let conn: any
  try {
    conn = await mysql.createConnection({
      host:     process.env.DB_HOST     || '192.168.11.251',
      user:     process.env.DB_USER     || 'chatte',
      password: process.env.DB_PASS     || 'PrgInv*2019-chatte',
      database: process.env.DB_NAME     || 'tab_pacardyl',
      port:     3306,
    })
  } catch (e: any) {
    return NextResponse.json({ error: `No se pudo conectar a MySQL: ${e.message}` }, { status: 500 })
  }

  try {
    // Crear tabla temporal
    await conn.execute('CALL sp_crea_entradas_conta_tmp(?, ?)', [fechaInicio, fechaFin])

    // Leer solo proveedores reales (excluir NITs internos)
    const [filas] = await conn.execute(
      "SELECT * FROM tmp_entradasconta WHERE Ent_Nit NOT IN ('222222222','99','0') AND Ent_Nit IS NOT NULL AND Ent_Nit != ''"
    ) as [FilaMysql[], any]

    // Borrar tabla temporal
    await conn.execute('DROP TABLE IF EXISTS tmp_entradasconta')
    await conn.end()

    if (!filas.length) {
      return NextResponse.json({ ok: true, importados: 0, mensaje: 'Sin registros para ese rango de fechas' })
    }

    // Agrupar por recibo
    const mapa = new Map<string, any>()
    for (const f of filas) {
      const num = String(f.Ent_Numero || '').trim()
      if (!num) continue
      const noFactura = String(f.Ent_NoFactura || '').replace(/^0+/, '') || String(f.Ent_NoFactura || '')

      if (!mapa.has(num)) {
        mapa.set(num, {
          id: `r-bd-${num}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          numeroRecibo: num,
          proveedor: String(f.Emp_Razon || '').trim(),
          nitProveedor: String(f.Ent_Nit || '').trim(),
          fecha: formatFecha(f.Ent_Fecha),
          numeroFacturaProveedor: noFactura,
          productos: [],
          total: 0,
          creadoEn: new Date().toISOString(),
        })
      }

      const r = mapa.get(num)!
      const cantidad = Number(f.EntDet_CanRec) || 0
      const costoNeto = Number(f.EntDet_CostoNeto) || 0
      const totalNeto = Number(f.EntDet_TotalNeto) || cantidad * costoNeto

      if (String(f.EntDet_Barra || '').trim() || String(f.EntDet_Articulo || '').trim()) {
        r.productos.push({
          codigo: String(f.EntDet_Barra || '').trim(),
          descripcion: String(f.EntDet_Articulo || '').trim(),
          cantidad,
          precioUnitario: costoNeto,
          descuento: (Number(f.EntDet_Descue01) || 0) + (Number(f.EntDet_Descue02) || 0) + (Number(f.EntDet_Descue03) || 0),
          subtotal: totalNeto,
        })
        r.total += totalNeto
      }
    }

    // Usar total del encabezado si el calculado es 0
    for (const r of mapa.values()) {
      if (r.total === 0) r.total = Number(filas.find(f => f.Ent_Numero === r.numeroRecibo)?.Ent_Neto) || 0
    }

    // Guardar en Vercel Postgres
    let importados = 0, duplicados = 0, errores = 0
    for (const r of mapa.values()) {
      try {
        const { rows: existe } = await sql`SELECT id FROM recibos WHERE numero_recibo = ${r.numeroRecibo} LIMIT 1`
        if (existe.length > 0) { duplicados++; continue }

        await sql`
          INSERT INTO recibos (id, numero_recibo, proveedor, nit_proveedor, fecha,
            productos, total, xml_raw, numero_factura_proveedor, creado_en)
          VALUES (${r.id}, ${r.numeroRecibo}, ${r.proveedor}, ${r.nitProveedor}, ${r.fecha},
            ${JSON.stringify(r.productos)}, ${r.total}, ${null},
            ${r.numeroFacturaProveedor ?? null}, ${r.creadoEn})
        `
        importados++
      } catch { errores++ }
    }

    return NextResponse.json({ ok: true, importados, duplicados, errores, total: mapa.size })
  } catch (e: any) {
    try { await conn.execute('DROP TABLE IF EXISTS tmp_entradasconta') } catch {}
    try { await conn.end() } catch {}
    return NextResponse.json({ error: String(e.message) }, { status: 500 })
  }
}
