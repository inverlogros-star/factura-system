import { sql } from '@vercel/postgres'
import { NextRequest, NextResponse } from 'next/server'
import type { ReciboMercancia } from '@/types'

export async function GET() {
  try {
    const { rows } = await sql`
      SELECT id, numero_recibo, proveedor, nit_proveedor, fecha,
             productos, total, numero_factura_proveedor, creado_en
      FROM recibos ORDER BY creado_en DESC`
    const recibos: ReciboMercancia[] = rows.map(r => ({
      id: r.id,
      numeroRecibo: r.numero_recibo,
      proveedor: r.proveedor,
      nitProveedor: r.nit_proveedor,
      fecha: r.fecha,
      productos: r.productos,
      total: parseFloat(r.total),
      totales: r.totales ?? undefined,
      numeroFacturaProveedor: r.numero_factura_proveedor,
      creadoEn: r.creado_en,
    }))
    return NextResponse.json(recibos)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const r: ReciboMercancia = await req.json()
    await sql`
      INSERT INTO recibos (id, numero_recibo, proveedor, nit_proveedor, fecha,
        productos, total, xml_raw, numero_factura_proveedor, totales, creado_en)
      VALUES (${r.id}, ${r.numeroRecibo}, ${r.proveedor}, ${r.nitProveedor}, ${r.fecha},
        ${JSON.stringify(r.productos)}, ${r.total}, ${r.xmlRaw ?? null},
        ${r.numeroFacturaProveedor ?? null}, ${r.totales ? JSON.stringify(r.totales) : null}, ${r.creadoEn})
      ON CONFLICT (id) DO UPDATE SET
        proveedor = EXCLUDED.proveedor,
        nit_proveedor = EXCLUDED.nit_proveedor,
        fecha = EXCLUDED.fecha,
        productos = EXCLUDED.productos,
        total = EXCLUDED.total,
        totales = EXCLUDED.totales,
        numero_factura_proveedor = EXCLUDED.numero_factura_proveedor
      ON CONFLICT (id) DO NOTHING
    `
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
