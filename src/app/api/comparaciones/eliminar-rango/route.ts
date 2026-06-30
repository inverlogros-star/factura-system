import { sql } from '@vercel/postgres'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(req: NextRequest) {
  try {
    const { desde, hasta } = await req.json()
    if (!desde || !hasta) {
      return NextResponse.json({ error: 'Se requieren desde y hasta' }, { status: 400 })
    }
    // Obtener las facturas afectadas para devolverlas a "pendiente"
    const { rows: afectadas } = await sql`
      SELECT factura_id FROM comparaciones
      WHERE fecha_comparacion::date >= ${desde}::date AND fecha_comparacion::date <= ${hasta}::date
    `
    const { rowCount } = await sql`
      DELETE FROM comparaciones
      WHERE fecha_comparacion::date >= ${desde}::date AND fecha_comparacion::date <= ${hasta}::date
    `
    for (const { factura_id } of afectadas) {
      await sql`UPDATE facturas SET estado = 'pendiente', recibo_asociado_id = NULL WHERE id = ${factura_id}`
    }
    return NextResponse.json({ ok: true, eliminados: rowCount ?? 0 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
