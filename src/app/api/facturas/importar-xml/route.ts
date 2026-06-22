import { sql } from '@vercel/postgres'
import { NextRequest, NextResponse } from 'next/server'
import { parsearFacturaDIAN } from '@/lib/parser-dian'
import type { Factura } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const { xmlContent, nombreArchivo } = await req.json()
    if (!xmlContent) return NextResponse.json({ error: 'Sin contenido XML' }, { status: 400 })

    // Verificar que no exista ya por nombre de archivo
    const { rows: existe } = await sql`
      SELECT id FROM facturas WHERE xml_raw LIKE ${`%${nombreArchivo}%`} LIMIT 1
    `
    if (existe.length > 0) {
      return NextResponse.json({ ok: true, omitido: true, mensaje: 'Ya existe' })
    }

    const datos = await parsearFacturaDIAN(xmlContent)

    // Verificar por número de factura
    const { rows: existeNum } = await sql`
      SELECT id FROM facturas WHERE numero_factura = ${datos.numeroFactura} LIMIT 1
    `
    if (existeNum.length > 0) {
      return NextResponse.json({ ok: true, omitido: true, mensaje: `Factura ${datos.numeroFactura} ya existe` })
    }

    const factura: Factura = {
      id: `f-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ...datos,
      estado: 'pendiente',
      creadoEn: new Date().toISOString(),
    }

    await sql`
      INSERT INTO facturas (id, numero_factura, proveedor, nit_proveedor, fecha, fecha_vencimiento,
        productos, subtotal, impuestos, total, estado, recibo_asociado_id, xml_raw, creado_en)
      VALUES (${factura.id}, ${factura.numeroFactura}, ${factura.proveedor}, ${factura.nitProveedor},
        ${factura.fecha}, ${factura.fechaVencimiento ?? null}, ${JSON.stringify(factura.productos)},
        ${factura.subtotal}, ${factura.impuestos}, ${factura.total}, ${factura.estado},
        ${null}, ${factura.xmlRaw ?? null}, ${factura.creadoEn})
    `

    return NextResponse.json({ ok: true, omitido: false, numeroFactura: factura.numeroFactura })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
