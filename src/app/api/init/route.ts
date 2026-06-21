import { inicializarDB } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    await inicializarDB()
    return NextResponse.json({ ok: true, mensaje: 'Base de datos inicializada' })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
