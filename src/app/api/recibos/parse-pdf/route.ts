import { NextRequest, NextResponse } from 'next/server'
import { extractText, getDocumentProxy } from 'unpdf'
import type { ProductoRecibo } from '@/types'

// Números en formato US: $1,234.56 → 1234.56
function parsearNum(str: string): number {
  return parseFloat(str.replace(/[$,\s]/g, '')) || 0
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

    const buffer = new Uint8Array(await file.arrayBuffer())
    const pdf = await getDocumentProxy(buffer)
    const { text } = await extractText(pdf, { mergePages: true })
    const texto = text as string

    // ── Metadatos ──────────────────────────────────────────────────────────────

    // Número de recibo/compra: "Compra No 154712169"
    const matchCompra = texto.match(/Compra\s+No\s+(\d+)/i)
    // Número de recibo alternativo
    const matchRecibo = texto.match(/Recibo\s+(?:mercanc[íi]a\s+)?No\s+([\w\d-]+)/i)
    const numeroRecibo = matchCompra?.[1] || matchRecibo?.[1] || file.name.replace('.pdf', '')

    // Proveedor y NIT: aparece como "XXXXXXXXX-X NOMBRE S.A"
    let proveedor = ''
    let nitProveedor = ''
    const matchProvNit = texto.match(/(\d{6,12}-\d)\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s.]+S\.A\.?S?\.?)/)
    if (matchProvNit) {
      nitProveedor = matchProvNit[1]
      proveedor = matchProvNit[2].trim().replace(/\s+/g, ' ')
    }

    // Fecha de elaboración: "Elaborado: 17/06/2026"
    const matchFecha = texto.match(/Elaborado:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)
    // Fecha alternativa: "Fecha factura: XX/XX/XXXX"
    const matchFecha2 = texto.match(/Fecha\s+factura:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)
    const fecha = matchFecha?.[1] || matchFecha2?.[1] || ''

    // ── Productos ──────────────────────────────────────────────────────────────
    // Formato CORBETA por línea:
    // [BARCODE13] [DESCRIPCION] $[COSTO] [DESCTO%] [IMPO%] $[NETO][IVA_RATE] $[TOTAL][CANT].00 $0.00 $0.00 [0]
    //
    // Ejemplo:
    // 7702026151683 TOALLITA HUMEDA PEQUENIN X 40 $6,102.46 0.00 0.00 $6,102.4619 $87,143.1312.00 $0.00 $0.00 0
    // Los campos NETO+IVA y TOTAL+CANT están concatenados sin separador.

    const reProducto = /(\d{13})\s+([^$\d][^$]*?)\s+\$([\d,]+\.\d{2})\s+([\d.]+)\s+([\d.]+)\s+\$([\d,]+\.\d{2})(\d{1,2})\s+\$([\d,]+\.\d{2})(\d+)\.00/g

    const productos: ProductoRecibo[] = []
    let match: RegExpExecArray | null

    while ((match = reProducto.exec(texto)) !== null) {
      const [, codigo, descripcionRaw, , , , , ivaRateStr, totalStr, cantStr] = match

      const cantidad   = parseFloat(cantStr) || 1
      const subtotal   = parsearNum(totalStr)
      const ivaRate    = parseFloat(ivaRateStr) || 0
      // Precio unitario sin IVA = subtotal / cantidad / (1 + iva/100)
      const precioUnitario = cantidad > 0 ? (subtotal / cantidad) / (1 + ivaRate / 100) : 0

      productos.push({
        codigo: codigo.trim(),
        descripcion: descripcionRaw.trim().replace(/\s+/g, ' '),
        cantidad,
        precioUnitario: Math.round(precioUnitario * 100) / 100,
        subtotal,
      })
    }

    // ── Total del recibo ────────────────────────────────────────────────────────
    // Buscar "Neto $X,XXX,XXX" al final del documento
    const matchNeto = texto.match(/Neto\s+\$([\d,]+)/i)
    // Buscar también "SubTotal Neto $X"
    const matchSubNeto = texto.match(/SubTotal\s+(?:Neto\s+)?\$([\d,]+\.?\d*)/i)
    let total = 0
    if (matchNeto) {
      total = parsearNum(matchNeto[1])
    } else if (matchSubNeto) {
      total = parsearNum(matchSubNeto[1])
    } else {
      total = productos.reduce((s, p) => s + p.subtotal, 0)
    }

    // Si el total del Neto en el footer incluye IVA, usamos ese directamente
    // (en CORBETA: SubTotal + IVA = Neto)
    const matchIvaFooter = texto.match(/IVA\s+\$([\d,]+\.?\d*)/i)
    const matchSubtotalFooter = texto.match(/SubTotal\s+\$([\d,]+\.\d{2})\s/i)
    if (matchIvaFooter && matchSubtotalFooter && total === 0) {
      total = parsearNum(matchSubtotalFooter[1]) + parsearNum(matchIvaFooter[1])
    }

    return NextResponse.json({
      numeroRecibo,
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
