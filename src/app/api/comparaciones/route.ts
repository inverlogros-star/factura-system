import { sql } from '@vercel/postgres'
import { NextRequest, NextResponse } from 'next/server'
import type { ResultadoComparacion } from '@/types'

export async function GET() {
  try {
    const { rows } = await sql`SELECT * FROM comparaciones ORDER BY fecha_comparacion DESC`
    const comparaciones: ResultadoComparacion[] = rows.map(r => ({
      id: r.id,
      facturaId: r.factura_id,
      reciboId: r.recibo_id,
      numeroFactura: r.numero_factura,
      numeroRecibo: r.numero_recibo,
      proveedor: r.proveedor,
      diferencias: r.diferencias,
      tieneDiferencias: r.tiene_diferencias,
      valorTotalFactura: parseFloat(r.valor_total_factura),
      valorTotalRecibo: parseFloat(r.valor_total_recibo),
      valorDiferenciaTotal: parseFloat(r.valor_diferencia_total),
      estado: r.estado,
      fechaComparacion: r.fecha_comparacion,
    }))
    return NextResponse.json(comparaciones)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const c: ResultadoComparacion = await req.json()
    await sql`
      INSERT INTO comparaciones (id, factura_id, recibo_id, numero_factura, numero_recibo, proveedor,
        diferencias, tiene_diferencias, valor_total_factura, valor_total_recibo,
        valor_diferencia_total, estado, fecha_comparacion)
      VALUES (${c.id}, ${c.facturaId}, ${c.reciboId}, ${c.numeroFactura}, ${c.numeroRecibo},
        ${c.proveedor}, ${JSON.stringify(c.diferencias)}, ${c.tieneDiferencias},
        ${c.valorTotalFactura}, ${c.valorTotalRecibo}, ${c.valorDiferenciaTotal},
        ${c.estado}, ${c.fechaComparacion})
      ON CONFLICT (id) DO NOTHING
    `
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
