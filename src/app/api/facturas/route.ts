import { sql } from '@vercel/postgres'
import { NextRequest, NextResponse } from 'next/server'
import type { Factura } from '@/types'

export async function GET() {
  try {
    const { rows } = await sql`SELECT * FROM facturas ORDER BY creado_en DESC`
    const facturas: Factura[] = rows.map(r => ({
      id: r.id,
      numeroFactura: r.numero_factura,
      proveedor: r.proveedor,
      nitProveedor: r.nit_proveedor,
      fecha: r.fecha,
      fechaVencimiento: r.fecha_vencimiento,
      productos: r.productos,
      subtotal: parseFloat(r.subtotal),
      impuestos: parseFloat(r.impuestos),
      total: parseFloat(r.total),
      estado: r.estado,
      reciboAsociadoId: r.recibo_asociado_id,
      xmlRaw: r.xml_raw,
      correoOrigen: r.correo_origen,
      creadoEn: r.creado_en,
    }))
    return NextResponse.json(facturas)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const f: Factura = await req.json()
    await sql`
      INSERT INTO facturas (id, numero_factura, proveedor, nit_proveedor, fecha, fecha_vencimiento,
        productos, subtotal, impuestos, total, estado, recibo_asociado_id, xml_raw, correo_origen, creado_en)
      VALUES (${f.id}, ${f.numeroFactura}, ${f.proveedor}, ${f.nitProveedor}, ${f.fecha},
        ${f.fechaVencimiento ?? null}, ${JSON.stringify(f.productos)}, ${f.subtotal},
        ${f.impuestos}, ${f.total}, ${f.estado}, ${f.reciboAsociadoId ?? null},
        ${f.xmlRaw ?? null}, ${f.correoOrigen ?? null}, ${f.creadoEn})
      ON CONFLICT (id) DO UPDATE SET
        estado = EXCLUDED.estado,
        recibo_asociado_id = EXCLUDED.recibo_asociado_id,
        numero_factura = EXCLUDED.numero_factura,
        proveedor = EXCLUDED.proveedor,
        nit_proveedor = EXCLUDED.nit_proveedor,
        fecha = EXCLUDED.fecha,
        productos = EXCLUDED.productos,
        subtotal = EXCLUDED.subtotal,
        impuestos = EXCLUDED.impuestos,
        total = EXCLUDED.total,
        correo_origen = EXCLUDED.correo_origen
    `
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
