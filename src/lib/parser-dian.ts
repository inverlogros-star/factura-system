import { parseStringPromise } from 'xml2js'
import type { ReciboMercancia, Factura, ProductoFactura, ProductoRecibo } from '@/types'

// Obtiene el texto de un nodo xml2js (maneja string directo o {_: ...})
function t(node: any): string {
  if (!node) return ''
  if (typeof node === 'string') return node.trim()
  if (Array.isArray(node)) return t(node[0])
  if (node._) return String(node._).trim()
  const vals = Object.values(node).filter(v => typeof v === 'string' || (typeof v === 'object' && (v as any)._))
  return vals.length ? t(vals[0]) : ''
}

function n(node: any): number {
  return parseFloat(t(node).replace(/,/g, '')) || 0
}

// Busca un nodo con prefijo o sin él
function get(obj: any, ...keys: string[]): any {
  if (!obj) return undefined
  for (const key of keys) {
    const variants = [key, `cbc:${key}`, `cac:${key}`, `fe:${key}`, `sts:${key}`]
    for (const v of variants) {
      if (obj[v] !== undefined) {
        const val = obj[v]
        return Array.isArray(val) ? val[0] : val
      }
    }
  }
  return undefined
}

function getArr(obj: any, ...keys: string[]): any[] {
  if (!obj) return []
  for (const key of keys) {
    const variants = [key, `cbc:${key}`, `cac:${key}`, `fe:${key}`]
    for (const v of variants) {
      if (obj[v] !== undefined) {
        const val = obj[v]
        return Array.isArray(val) ? val : [val]
      }
    }
  }
  return []
}

async function parseXML(xmlStr: string) {
  return parseStringPromise(xmlStr, {
    explicitArray: true,
    ignoreAttrs: false,
    trim: true,
    explicitCharkey: true,
    charkey: '_',
  })
}

export type TipoDocumentoParsed = 'factura' | 'nota_credito' | 'nota_debito' | 'otro'

function detectarTipo(rootKey: string): TipoDocumentoParsed {
  const k = rootKey.toLowerCase()
  if (k.includes('creditnote')) return 'nota_credito'
  if (k.includes('debitnote')) return 'nota_debito'
  if (k.includes('invoice')) return 'factura'
  return 'otro'
}

// Extrae el documento interno del AttachedDocument DIAN
async function extraerDocumento(xmlString: string): Promise<{ root: any; tipo: TipoDocumentoParsed }> {
  const parsed = await parseXML(xmlString)
  const rootKey = Object.keys(parsed)[0]

  if (rootKey?.includes('AttachedDocument') || rootKey === 'AttachedDocument') {
    const doc = parsed[rootKey]
    const attachment = get(doc, 'Attachment') || get(doc, 'cac:Attachment')
    const extRef = get(attachment, 'ExternalReference') || get(attachment, 'cac:ExternalReference')
    const descNode = get(extRef, 'Description') || get(extRef, 'cbc:Description')
    const cdataContent = t(descNode)

    if (cdataContent && cdataContent.includes('<?xml')) {
      const innerParsed = await parseXML(cdataContent)
      const innerKey = Object.keys(innerParsed)[0]
      return { root: innerParsed[innerKey], tipo: detectarTipo(innerKey) }
    }
  }

  return { root: parsed[rootKey], tipo: detectarTipo(rootKey) }
}

// NIT de INVERSIONES LOGROS SA (destinatario válido)
const NIT_LOGROS = '811031830'

function normalizarNit(nit: string): string {
  return nit.replace(/[.\-\s]/g, '').replace(/\d$/, s => s).slice(0, 9)
}

function extraerCliente(root: any): { cliente: string; nitCliente: string } {
  // Buscar en AccountingCustomerParty o BuyerCustomerParty o ReceiverParty
  const customerParty =
    get(root, 'AccountingCustomerParty') ||
    get(root, 'BuyerCustomerParty') ||
    get(root, 'ReceiverParty')

  const party       = get(customerParty, 'Party') || customerParty
  const partyName   = get(party, 'PartyName')
  const legalEntity = get(party, 'PartyLegalEntity')
  const taxScheme   = get(party, 'PartyTaxScheme')

  const cliente =
    t(get(partyName, 'Name')) ||
    t(get(legalEntity, 'RegistrationName')) ||
    t(get(taxScheme, 'RegistrationName')) || ''

  const companyId =
    get(taxScheme, 'CompanyID') ||
    get(legalEntity, 'CompanyID') ||
    get(party, 'PartyIdentification', 'ID')

  const nitCliente = t(companyId) || ''
  return { cliente, nitCliente }
}

export function esDestinatarioValido(nitCliente: string): boolean {
  const normalizado = normalizarNit(nitCliente)
  return normalizado.startsWith(NIT_LOGROS) || NIT_LOGROS.startsWith(normalizado)
}

function extraerProveedor(root: any): { proveedor: string; nitProveedor: string } {
  const supplierParty = get(root, 'AccountingSupplierParty', 'SellerSupplierParty')
  const party = get(supplierParty, 'Party')

  // Nombre
  const partyName = get(party, 'PartyName')
  const legalEntity = get(party, 'PartyLegalEntity')
  const taxScheme = get(party, 'PartyTaxScheme')

  const proveedor =
    t(get(partyName, 'Name')) ||
    t(get(legalEntity, 'RegistrationName')) ||
    t(get(taxScheme, 'RegistrationName')) ||
    ''

  // NIT
  const companyId =
    get(taxScheme, 'CompanyID') ||
    get(legalEntity, 'CompanyID') ||
    get(party, 'PartyIdentification', 'ID')

  const nitProveedor = t(companyId) || ''

  return { proveedor, nitProveedor }
}

function extraerLineas(root: any): ProductoFactura[] {
  // Invoice → InvoiceLine, CreditNote → CreditNoteLine, DebitNote → DebitNoteLine
  const lineas = getArr(root, 'InvoiceLine', 'cac:InvoiceLine',
    'CreditNoteLine', 'cac:CreditNoteLine',
    'DebitNoteLine', 'cac:DebitNoteLine')
  if (lineas.length === 0) return []

  return lineas.map((line: any) => {
    const item = get(line, 'Item', 'cac:Item') || {}
    const price = get(line, 'Price', 'cac:Price') || {}

    // Código del producto
    const sellersId = get(get(item, 'SellersItemIdentification', 'cac:SellersItemIdentification'), 'ID', 'cbc:ID')
    const standardId = get(get(item, 'StandardItemIdentification', 'cac:StandardItemIdentification'), 'ID', 'cbc:ID')
    const buyersId = get(get(item, 'BuyersItemIdentification', 'cac:BuyersItemIdentification'), 'ID', 'cbc:ID')
    const codigoItem = t(sellersId) || t(standardId) || t(buyersId) || t(get(line, 'ID', 'cbc:ID'))

    // Descripción
    const descripcion =
      t(get(item, 'Description', 'cbc:Description')) ||
      t(get(item, 'Name', 'cbc:Name')) ||
      ''

    // Cantidad
    const cantNode = get(line, 'InvoicedQuantity', 'cbc:InvoicedQuantity',
      'CreditedQuantity', 'cbc:CreditedQuantity',
      'DebitedQuantity', 'cbc:DebitedQuantity')
    const cantidad = n(cantNode) || 1

    // Precio unitario
    const precioUnitario = n(get(price, 'PriceAmount', 'cbc:PriceAmount'))

    // Subtotal de la línea (sin IVA)
    const subtotal = n(get(line, 'LineExtensionAmount', 'cbc:LineExtensionAmount'))

    // Descuento
    const allowances = getArr(line, 'AllowanceCharge', 'cac:AllowanceCharge')
    let descuento = 0
    for (const ac of allowances) {
      const isCharge = t(get(ac, 'ChargeIndicator', 'cbc:ChargeIndicator'))
      if (isCharge.toLowerCase() === 'false') {
        descuento += n(get(ac, 'Amount', 'cbc:Amount'))
      }
    }

    // IVA de la línea
    const taxTotals = getArr(line, 'TaxTotal', 'cac:TaxTotal')
    let impuesto = 0
    let tasaIva = 0
    for (const tt of taxTotals) {
      impuesto += n(get(tt, 'TaxAmount', 'cbc:TaxAmount'))
      const subtaxes = getArr(tt, 'TaxSubtotal', 'cac:TaxSubtotal')
      for (const st of subtaxes) {
        const tasa = n(get(st, 'Percent', 'cbc:Percent'))
        if (tasa > 0) tasaIva = tasa
      }
    }

    // Impoconsumo / otros impuestos
    const withTotals = getArr(line, 'WithholdingTaxTotal', 'cac:WithholdingTaxTotal')
    let otrosImp = 0
    for (const wt of withTotals) {
      otrosImp += n(get(wt, 'TaxAmount', 'cbc:TaxAmount'))
    }

    const total = subtotal + impuesto + otrosImp

    return {
      codigo: codigoItem,
      descripcion,
      cantidad,
      precioUnitario: precioUnitario || (cantidad > 0 ? subtotal / cantidad : 0),
      descuento,
      subtotal,
      impuesto: impuesto + otrosImp,
      total,
      tasaIva,
    } as ProductoFactura & { tasaIva?: number }
  })
}

export async function parsearFacturaDIAN(xmlString: string): Promise<Omit<Factura, 'id' | 'creadoEn' | 'estado'>> {
  const { root, tipo } = await extraerDocumento(xmlString)
  if (!root) throw new Error('No se pudo extraer el documento del XML')

  const numeroFactura =
    t(get(root, 'ID', 'cbc:ID')) || ''

  const fecha = t(get(root, 'IssueDate', 'cbc:IssueDate')) || ''
  const fechaVencimiento = t(get(root, 'DueDate', 'cbc:DueDate')) || undefined

  const { proveedor, nitProveedor } = extraerProveedor(root)
  const { nitCliente } = extraerCliente(root)

  // Totales
  const monetary = get(root, 'LegalMonetaryTotal', 'cac:LegalMonetaryTotal')
  const subtotal = n(get(monetary, 'LineExtensionAmount', 'cbc:LineExtensionAmount')) ||
    n(get(monetary, 'TaxExclusiveAmount', 'cbc:TaxExclusiveAmount'))
  const total = n(get(monetary, 'PayableAmount', 'cbc:PayableAmount')) ||
    n(get(monetary, 'TaxInclusiveAmount', 'cbc:TaxInclusiveAmount'))

  // IVA total
  const taxTotals = getArr(root, 'TaxTotal', 'cac:TaxTotal')
  let impuestos = 0
  for (const tt of taxTotals) {
    impuestos += n(get(tt, 'TaxAmount', 'cbc:TaxAmount'))
  }

  // Productos
  const productos = extraerLineas(root)

  return {
    numeroFactura,
    proveedor,
    nitProveedor,
    fecha,
    fechaVencimiento: fechaVencimiento || undefined,
    productos,
    subtotal,
    impuestos,
    total,
    tipoDocumento: tipo,
    nitCliente,
    xmlRaw: xmlString,
  }
}

export async function parsearReciboXML(xmlString: string): Promise<Omit<ReciboMercancia, 'id' | 'creadoEn'>> {
  const parsed = await parseXML(xmlString)
  const root = parsed['RecepcionMercancia'] || parsed['Recibo'] || parsed['GoodsReceipt'] || Object.values(parsed)[0] as any

  const cbc = (parent: any, key: string): string => {
    if (!parent) return ''
    const val = parent[key] || parent[`cbc:${key}`]
    if (!val) return ''
    const item = Array.isArray(val) ? val[0] : val
    if (typeof item === 'string') return item.trim()
    if (item?._) return String(item._).trim()
    return ''
  }

  const numeroRecibo = cbc(root, 'NumeroRecibo') || cbc(root, 'ID') || cbc(root, 'Numero')
  const proveedor = cbc(root, 'Proveedor') || cbc(root, 'NombreProveedor') || ''
  const nitProveedor = cbc(root, 'NitProveedor') || cbc(root, 'NIT') || ''
  const fecha = cbc(root, 'Fecha') || cbc(root, 'FechaRecepcion') || ''

  const lineNodes =
    root['Productos']?.[0]?.['Producto'] ||
    root['Items']?.[0]?.['Item'] ||
    root['Lineas']?.[0]?.['Linea'] || []

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
