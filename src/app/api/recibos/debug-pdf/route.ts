import { NextRequest, NextResponse } from 'next/server'
import { extractText, getDocumentProxy } from 'unpdf'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })
    const buffer = new Uint8Array(await file.arrayBuffer())
    const pdf = await getDocumentProxy(buffer)
    const { text } = await extractText(pdf, { mergePages: true })
    const lineas = (text as string).split('\n').map((l: string, i: number) => ({ i, l })).filter(x => x.l.trim())
    return NextResponse.json({ texto: text, lineas })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
