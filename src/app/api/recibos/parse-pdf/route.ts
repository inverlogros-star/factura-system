import { NextRequest, NextResponse } from 'next/server'
import type { ProductoRecibo } from '@/types'

function limpiarNum(str: string): number {
  return parseFloat(str.replace(/[$\s]/g, '').replace(/\./g, '').replace(',', '.')) || 0
}

function esLinea(line: string): boolean {
  // Línea que probablemente es un producto: tiene texto y al menos un número
  return line.trim().length > 3 && /\d/.test(line)
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse')
    const data = await pdfParse(buffer)
    const texto: string = data.text

    const lineas = texto.split('\n').map((l: string) => l.trim()).filter(Boolean)

    // Extraer metadatos básicos
    let numeroRecibo = ''
    let proveedor = ''
    let nitProveedor = ''
    let fecha = ''

    for (const linea of lineas.slice(0, 30)) {
      const lower = linea.toLowerCase()
      if (!numeroRecibo && (lower.includes('recibo') || lower.includes('orden') || lower.includes('pedido'))) {
        const match = linea.match(/[\w\d-]{4,20}/)
        if (match) numeroRecibo = match[0]
      }
      if (!fecha) {
        const matchFecha = linea.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/)
        if (matchFecha) fecha = matchFecha[0]
      }
      if (!nitProveedor) {
        const matchNit = linea.match(/\b\d{6,12}[-\d]*\b/)
        if (matchNit && (lower.includes('nit') || lower.includes('rut') || lower.includes('identificacion'))) {
          nitProveedor = matchNit[0]
        }
      }
      if (!proveedor && linea.length > 5 && linea.length < 80 && lineas.indexOf(linea) < 10) {
        const upper = linea.toUpperCase()
        if (upper === linea && !/^[\d.,\s$]+$/.test(linea.trim())) proveedor = linea
      }
    }

    // Intentar detectar tabla de productos
    // Buscar línea de encabezados
    const HEADER_KEYWORDS = ['descripcion', 'description', 'producto', 'articulo', 'cantidad', 'precio', 'valor']
    let headerIdx = -1
    for (let i = 0; i < lineas.length; i++) {
      const lower = lineas[i].toLowerCase()
      const matches = HEADER_KEYWORDS.filter(k => lower.includes(k)).length
      if (matches >= 2) { headerIdx = i; break }
    }

    const productos: ProductoRecibo[] = []

    if (headerIdx >= 0) {
      // Parsear desde la línea siguiente al encabezado
      for (let i = headerIdx + 1; i < lineas.length; i++) {
        const linea = lineas[i]
        if (!esLinea(linea)) continue

        // Separar por espacios múltiples o tabs
        const partes = linea.split(/\s{2,}|\t/).map(p => p.trim()).filter(Boolean)
        if (partes.length < 2) continue

        // Asumir: último = total, penúltimo = precio, antepenúltimo = cantidad, resto = descripción/código
        const numericos = partes.filter(p => /^[\d.,\s$]+$/.test(p.trim()) && p.trim().length > 0)
        if (numericos.length === 0) continue

        const descripcion = partes.filter(p => !/^[\d.,\s$]+$/.test(p.trim()) && p.trim().length > 0).join(' ')
        const subtotal = limpiarNum(numericos[numericos.length - 1])
        const precioUnitario = numericos.length >= 2 ? limpiarNum(numericos[numericos.length - 2]) : 0
        const cantidad = numericos.length >= 3 ? limpiarNum(numericos[numericos.length - 3]) : 1

        if (descripcion && (cantidad > 0 || subtotal > 0)) {
          productos.push({
            codigo: String(productos.length + 1).padStart(4, '0'),
            descripcion,
            cantidad,
            precioUnitario,
            subtotal: subtotal || cantidad * precioUnitario,
          })
        }
      }
    } else {
      // Sin encabezado detectado — parsear líneas numéricas
      for (const linea of lineas) {
        const partes = linea.split(/\s{2,}|\t/).map(p => p.trim()).filter(Boolean)
        if (partes.length < 3) continue
        const numericos = partes.filter(p => /^[\d.,\s$]+$/.test(p.trim()) && p.trim().length > 0)
        if (numericos.length < 2) continue
        const descripcion = partes.filter(p => !/^[\d.,\s$]+$/.test(p.trim()) && p.trim().length > 0).join(' ')
        if (!descripcion) continue
        const subtotal = limpiarNum(numericos[numericos.length - 1])
        const precioUnitario = limpiarNum(numericos[numericos.length - 2])
        const cantidad = numericos.length >= 3 ? limpiarNum(numericos[0]) : 1
        productos.push({
          codigo: String(productos.length + 1).padStart(4, '0'),
          descripcion,
          cantidad,
          precioUnitario,
          subtotal: subtotal || cantidad * precioUnitario,
        })
      }
    }

    const total = productos.reduce((s, p) => s + p.subtotal, 0)

    return NextResponse.json({
      numeroRecibo: numeroRecibo || file.name.replace('.pdf', ''),
      proveedor,
      nitProveedor,
      fecha,
      productos,
      total,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
