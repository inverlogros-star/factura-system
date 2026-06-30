import { sql } from '@vercel/postgres'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(req: NextRequest) {
  try {
    const { desde, hasta } = await req.json()
    if (!desde || !hasta) {
      return NextResponse.json({ error: 'Se requieren desde y hasta' }, { status: 400 })
    }
    const { rowCount } = await sql`
      DELETE FROM facturas
      WHERE fecha >= ${desde} AND fecha <= ${hasta}
    `
    return NextResponse.json({ ok: true, eliminados: rowCount ?? 0 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
