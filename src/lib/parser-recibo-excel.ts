import * as XLSX from 'xlsx'
import type { ReciboMercancia, ProductoRecibo } from '@/types'

// Mapas de nombres de columna posibles
const COL_CODIGO = ['codigo', 'code', 'cod', 'ref', 'referencia', 'item', 'sku', 'id']
const COL_DESC = ['descripcion', 'description', 'nombre', 'name', 'producto', 'articulo', 'detalle']
const COL_CANT = ['cantidad', 'cant', 'qty', 'quantity', 'unidades', 'und', 'recibido', 'recibida']
const COL_PRECIO = ['precio', 'price', 'valor', 'value', 'costo', 'cost', 'preciounitario', 'p.unitario', 'vr.unitario', 'vlr']
const COL_SUBTOTAL = ['subtotal', 'total', 'importe', 'valortotal', 'vlrtotal', 'vrtotal']
const COL_RECIBO = ['recibo', 'numero', 'nro', 'no', 'consecutivo', 'pedido', 'orden']
const COL_PROVEEDOR = ['proveedor', 'supplier', 'vendor', 'empresa', 'razon']
const COL_NIT = ['nit', 'rut', 'cedula', 'identificacion', 'taxid']
const COL_FECHA = ['fecha', 'date', 'fechaentrega', 'fecharecepcion']

function buscarColumna(headers: string[], opciones: string[]): number {
  for (const op of opciones) {
    const idx = headers.findIndex(h => h.toLowerCase().replace(/[\s._]/g, '').includes(op))
    if (idx >= 0) return idx
  }
  return -1
}

function limpiarNum(val: any): number {
  if (val === null || val === undefined || val === '') return 0
  const str = String(val).replace(/[$,\s]/g, '').replace(',', '.')
  return parseFloat(str) || 0
}

export async function parsearReciboExcel(
  buffer: ArrayBuffer,
  nombreArchivo: string
): Promise<Omit<ReciboMercancia, 'id' | 'creadoEn'>> {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  if (rows.length < 2) throw new Error('El archivo Excel no tiene datos suficientes')

  // Buscar fila de encabezados (primeras 5 filas)
  let headerRow = 0
  let headers: string[] = []
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const row = rows[i].map((c: any) => String(c ?? ''))
    const tieneDesc = buscarColumna(row, COL_DESC) >= 0
    const tieneCant = buscarColumna(row, COL_CANT) >= 0
    if (tieneDesc || tieneCant) {
      headerRow = i
      headers = row
      break
    }
  }

  if (headers.length === 0) {
    // Asumir primera fila como encabezado
    headers = rows[0].map((c: any) => String(c ?? ''))
    headerRow = 0
  }

  const iCodigo = buscarColumna(headers, COL_CODIGO)
  const iDesc = buscarColumna(headers, COL_DESC)
  const iCant = buscarColumna(headers, COL_CANT)
  const iPrecio = buscarColumna(headers, COL_PRECIO)
  const iSubtotal = buscarColumna(headers, COL_SUBTOTAL)

  // Buscar metadatos en filas anteriores al encabezado
  let numeroRecibo = ''
  let proveedor = ''
  let nitProveedor = ''
  let fecha = ''

  for (let i = 0; i < headerRow; i++) {
    const row = rows[i]
    for (let j = 0; j < row.length - 1; j++) {
      const key = String(row[j] ?? '').toLowerCase()
      const val = String(row[j + 1] ?? '').trim()
      if (!val) continue
      if (COL_RECIBO.some(k => key.includes(k))) numeroRecibo = val
      if (COL_PROVEEDOR.some(k => key.includes(k))) proveedor = val
      if (COL_NIT.some(k => key.includes(k))) nitProveedor = val
      if (COL_FECHA.some(k => key.includes(k))) fecha = val
    }
  }

  // Parsear productos
  const productos: ProductoRecibo[] = []
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i]
    if (row.every((c: any) => !c && c !== 0)) continue // fila vacía

    const descripcion = iDesc >= 0 ? String(row[iDesc] ?? '').trim() : ''
    const cantidad = iCant >= 0 ? limpiarNum(row[iCant]) : 0
    const precioUnitario = iPrecio >= 0 ? limpiarNum(row[iPrecio]) : 0
    const subtotalRaw = iSubtotal >= 0 ? limpiarNum(row[iSubtotal]) : 0
    const subtotal = subtotalRaw || cantidad * precioUnitario
    const codigo = iCodigo >= 0 ? String(row[iCodigo] ?? '').trim() : String(i)

    if (!descripcion && cantidad === 0) continue

    productos.push({ codigo, descripcion, cantidad, precioUnitario, subtotal })
  }

  const total = productos.reduce((s, p) => s + p.subtotal, 0)

  return {
    numeroRecibo: numeroRecibo || nombreArchivo.replace(/\.[^.]+$/, ''),
    proveedor,
    nitProveedor,
    fecha,
    productos,
    total,
  }
}
