import { sql } from '@vercel/postgres'
import { NextRequest, NextResponse } from 'next/server'
import type { ReciboMercancia } from '@/types'

export async function GET() {
  try {
    const { rows } = await sql`SELECT * FROM recibos ORDER BY creado_en DESC`
    const recibos: ReciboMercancia[] = rows.map(r => ({
      id: r.id,
      numeroRecibo: r.numero_recibo,
      proveedor: r.proveedor,
      nitProveedor: r.nit_proveedor,
      fecha: r.fecha,
      productos: r.productos,
      total: parseFloat(r.total),
      xmlRaw: r.xml_raw,
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
      INSERT INTO recibos (id, numero_recibo, proveedor, nit_proveedor, fecha, productos, total, xml_raw, creado_en)
      VALUES (${r.id}, ${r.numeroRecibo}, ${r.proveedor}, ${r.nitProveedor}, ${r.fecha},
        ${JSON.stringify(r.productos)}, ${r.total}, ${r.xmlRaw ?? null}, ${r.creadoEn})
      ON CONFLICT (id) DO NOTHING
    `
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
