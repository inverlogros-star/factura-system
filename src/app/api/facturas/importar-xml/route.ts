import { sql } from '@vercel/postgres'
import { NextRequest, NextResponse } from 'next/server'
import { parsearFacturaDIAN } from '@/lib/parser-dian'
import type { Factura } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const { xmlContent, nombreArchivo, forzar, correoOrigen } = await req.json()
    if (!xmlContent) return NextResponse.json({ error: 'Sin contenido XML' }, { status: 400 })

    const datos = await parsearFacturaDIAN(xmlContent)

    // Buscar si ya existe por número de factura
    const { rows: existente } = await sql`
      SELECT id, estado FROM facturas WHERE numero_factura = ${datos.numeroFactura} LIMIT 1
    `

    if (existente.length > 0 && !forzar) {
      // Si ya tiene datos (total > 0), omitir
      const { rows: check } = await sql`SELECT total FROM facturas WHERE numero_factura = ${datos.numeroFactura} LIMIT 1`
      if (check[0] && parseFloat(check[0].total) > 0) {
        return NextResponse.json({ ok: true, omitido: true, mensaje: `Factura ${datos.numeroFactura} ya existe` })
      }
    }

    if (existente.length > 0) {
      // Actualizar la factura existente con los datos correctos
      await sql`
        UPDATE facturas SET
          proveedor = ${datos.proveedor},
          nit_proveedor = ${datos.nitProveedor},
          fecha = ${datos.fecha},
          fecha_vencimiento = ${datos.fechaVencimiento ?? null},
          productos = ${JSON.stringify(datos.productos)},
          subtotal = ${datos.subtotal},
          impuestos = ${datos.impuestos},
          total = ${datos.total},
          xml_raw = ${datos.xmlRaw ?? null},
          correo_origen = COALESCE(correo_origen, ${correoOrigen ?? null})
        WHERE numero_factura = ${datos.numeroFactura}
      `
      return NextResponse.json({ ok: true, omitido: false, actualizado: true, numeroFactura: datos.numeroFactura })
    }

    // Insertar nueva
    const factura: Factura = {
      id: `f-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ...datos,
      estado: 'pendiente',
      correoOrigen: correoOrigen ?? null,
      creadoEn: new Date().toISOString(),
    }

    await sql`
      INSERT INTO facturas (id, numero_factura, proveedor, nit_proveedor, fecha, fecha_vencimiento,
        productos, subtotal, impuestos, total, estado, recibo_asociado_id, xml_raw, correo_origen, creado_en)
      VALUES (${factura.id}, ${factura.numeroFactura}, ${factura.proveedor}, ${factura.nitProveedor},
        ${factura.fecha}, ${factura.fechaVencimiento ?? null}, ${JSON.stringify(factura.productos)},
        ${factura.subtotal}, ${factura.impuestos}, ${factura.total}, ${factura.estado},
        ${null}, ${factura.xmlRaw ?? null}, ${factura.correoOrigen ?? null}, ${factura.creadoEn})
    `

    return NextResponse.json({ ok: true, omitido: false, numeroFactura: factura.numeroFactura })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
