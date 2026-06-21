import { parseStringPromise } from 'xml2js'
import type { ReciboMercancia, Factura, ProductoFactura, ProductoRecibo } from '@/types'

function getText(obj: any, ...paths: string[][]): string {
  for (const path of paths) {
    let current = obj
    for (const key of path) {
      if (!current) break
      current = Array.isArray(current[key]) ? current[key][0] : current[key]
    }
    if (current && typeof current === 'string') return current.trim()
    if (current && current._) return current._.trim()
  }
  return ''
}

function getNum(obj: any, ...paths: string[][]): number {
  const val = getText(obj, ...paths)
  return val ? parseFloat(val) || 0 : 0
}

export async function parsearFacturaDIAN(xmlString: string): Promise<Omit<Factura, 'id' | 'creadoEn' | 'estado'>> {
  const parsed = await parseStringPromise(xmlString, { explicitArray: true, ignoreAttrs: false })

  const root =
    parsed['Invoice'] ||
    parsed['fe:Invoice'] ||
    parsed['FacturaElectronica'] ||
    Object.values(parsed)[0]

  const cac = (key: string) => {
    const variations = [`cac:${key}`, key, `fe:${key}`]
    for (const v of variations) if (root[v]) return root[v][0]
    return null
  }

  const cbc = (parent: any, key: string): string => {
    if (!parent) return ''
    const variations = [`cbc:${key}`, key, `fe:${key}`]
    for (const v of variations) {
      const val = parent[v]
      if (val) {
        const item = Array.isArray(val) ? val[0] : val
        if (typeof item === 'string') return item.trim()
        if (item && item._) return item._.trim()
        if (item && typeof item === 'object') return String(Object.values(item)[0] || '').trim()
      }
    }
    return ''
  }

  const numeroFactura =
    cbc(root, 'ID') ||
    cbc(root, 'InvoiceID') ||
    getText(parsed, ['Invoice', 'ID'], ['fe:Invoice', 'fe:InvoiceID'])

  const fecha = cbc(root, 'IssueDate') || cbc(root, 'InvoiceDate')
  const fechaVencimiento = cbc(root, 'DueDate') || undefined

  const supplierParty = cac('AccountingSupplierParty') || cac('SellerSupplierParty')
  const partyNode = supplierParty?.['cac:Party']?.[0] || supplierParty?.['Party']?.[0] || supplierParty
  const partyName =
    partyNode?.['cac:PartyName']?.[0]?.['cbc:Name']?.[0] ||
    partyNode?.['PartyName']?.[0]?.['Name']?.[0] ||
    partyNode?.['cac:PartyLegalEntity']?.[0]?.['cbc:RegistrationName']?.[0] ||
    ''
  const proveedor = typeof partyName === 'string' ? partyName : partyName?._ || ''

  const taxScheme =
    partyNode?.['cac:PartyTaxScheme']?.[0]?.['cbc:CompanyID']?.[0] ||
    partyNode?.['PartyTaxScheme']?.[0]?.['CompanyID']?.[0] ||
    ''
  const nitProveedor = typeof taxScheme === 'string' ? taxScheme : taxScheme?._ || ''

  const legalMonetary = cac('LegalMonetaryTotal')
  const subtotal = legalMonetary ? parseFloat(cbc(legalMonetary, 'LineExtensionAmount') || '0') : 0
  const total = legalMonetary
    ? parseFloat(cbc(legalMonetary, 'PayableAmount') || cbc(legalMonetary, 'TaxInclusiveAmount') || '0')
    : 0

  const taxTotals = root['cac:TaxTotal'] || root['TaxTotal'] || []
  let impuestos = 0
  for (const tt of taxTotals) {
    impuestos += parseFloat(cbc(tt, 'TaxAmount') || '0')
  }

  const lineNodes = root['cac:InvoiceLine'] || root['InvoiceLine'] || []
  const productos: ProductoFactura[] = lineNodes.map((line: any) => {
    const item = line['cac:Item']?.[0] || line['Item']?.[0] || {}
    const price = line['cac:Price']?.[0] || line['Price']?.[0] || {}
    const sellersId =
      item['cac:SellersItemIdentification']?.[0]?.['cbc:ID']?.[0] ||
      item['SellersItemIdentification']?.[0]?.['ID']?.[0] ||
      ''
    const codigo = typeof sellersId === 'string' ? sellersId : sellersId?._ || cbc(line, 'ID')
    const descripcion = cbc(item, 'Description') || cbc(item, 'Name')
    const cantidad = parseFloat(cbc(line, 'InvoicedQuantity') || '1')
    const precioUnitario = parseFloat(cbc(price, 'PriceAmount') || '0')
    const subtotalLinea = parseFloat(cbc(line, 'LineExtensionAmount') || '0')
    const lineTax = line['cac:TaxTotal']?.[0] || line['TaxTotal']?.[0]
    const impuestoLinea = lineTax ? parseFloat(cbc(lineTax, 'TaxAmount') || '0') : 0
    const descuento = parseFloat(
      line['cac:AllowanceCharge']?.[0]?.['cbc:Amount']?.[0]?._ ||
      line['cac:AllowanceCharge']?.[0]?.['cbc:Amount']?.[0] ||
      '0'
    )
    return {
      codigo,
      descripcion: typeof descripcion === 'string' ? descripcion : '',
      cantidad,
      precioUnitario,
      descuento,
      subtotal: subtotalLinea,
      impuesto: impuestoLinea,
      total: subtotalLinea + impuestoLinea,
    }
  })

  return {
    numeroFactura,
    proveedor,
    nitProveedor,
    fecha,
    fechaVencimiento,
    productos,
    subtotal,
    impuestos,
    total,
    xmlRaw: xmlString,
  }
}

export async function parsearReciboXML(xmlString: string): Promise<Omit<ReciboMercancia, 'id' | 'creadoEn'>> {
  const parsed = await parseStringPromise(xmlString, { explicitArray: true, ignoreAttrs: false })
  const root = parsed['RecepcionMercancia'] || parsed['Recibo'] || parsed['GoodsReceipt'] || Object.values(parsed)[0] as any

  const cbc = (parent: any, key: string): string => {
    if (!parent) return ''
    const val = parent[key]
    if (!val) return ''
    const item = Array.isArray(val) ? val[0] : val
    if (typeof item === 'string') return item.trim()
    if (item?._) return item._.trim()
    return ''
  }

  const numeroRecibo = cbc(root, 'NumeroRecibo') || cbc(root, 'ID') || cbc(root, 'Numero')
  const proveedor = cbc(root, 'Proveedor') || cbc(root, 'NombreProveedor') || ''
  const nitProveedor = cbc(root, 'NitProveedor') || cbc(root, 'NIT') || ''
  const fecha = cbc(root, 'Fecha') || cbc(root, 'FechaRecepcion') || ''

  const lineNodes =
    root['Productos']?.[0]?.['Producto'] ||
    root['Items']?.[0]?.['Item'] ||
    root['Lineas']?.[0]?.['Linea'] ||
    []

  const productos: ProductoRecibo[] = lineNodes.map((line: any) => {
    const codigo = cbc(line, 'Codigo') || cbc(line, 'CodigoProducto') || cbc(line, 'ID')
    const descripcion = cbc(line, 'Descripcion') || cbc(line, 'Nombre') || cbc(line, 'Description')
    const cantidad = parseFloat(cbc(line, 'Cantidad') || cbc(line, 'CantidadRecibida') || '0')
    const precioUnitario = parseFloat(cbc(line, 'PrecioUnitario') || cbc(line, 'Precio') || '0')
    const subtotal = parseFloat(cbc(line, 'Subtotal') || cbc(line, 'Total') || String(cantidad * precioUnitario))
    return { codigo, descripcion, cantidad, precioUnitario, subtotal }
  })

  const total = productos.reduce((s, p) => s + p.subtotal, 0)

  return { numeroRecibo, proveedor, nitProveedor, fecha, productos, total, xmlRaw: xmlString }
}
