export interface ProductoRecibo {
  codigo: string
  descripcion: string
  cantidad: number
  precioUnitario: number   // costo neto unitario
  costoBruto?: number      // costo antes de descuentos
  descuento?: number       // descuento total (desc1+desc2+desc3)
  subtotal: number         // total neto línea
  iva?: number             // valor IVA
  tasaIva?: number         // tasa IVA (5 o 19)
  iconsumo?: number        // impoconsumo
  ibua?: number            // IBUA
  icui?: number            // ICUI
  estampillas?: number     // estampillas
  otros?: number           // otros impuestos
}

export interface TotalesRecibo {
  bruto: number          // subtotal antes de descuentos
  descuentos: number     // total descuentos
  subtotalNeto: number   // bruto - descuentos
  iva: number            // IVA total
  iconsumo: number       // impoconsumo total
  ibua: number           // IBUA total
  icui: number           // ICUI total
  estampillas: number    // estampillas
  neto: number           // valor total a pagar
}

export interface ReciboMercancia {
  id: string
  numeroRecibo: string
  proveedor: string
  nitProveedor: string
  fecha: string
  productos: ProductoRecibo[]
  total: number
  totales?: TotalesRecibo  // resumen de impuestos y descuentos
  xmlRaw?: string
  numeroFacturaProveedor?: string
  creadoEn: string
}

export interface ProductoFactura {
  codigo: string
  descripcion: string
  cantidad: number
  precioUnitario: number
  descuento: number
  subtotal: number
  impuesto: number
  total: number
  tasaIva?: number
}

export type TipoDocumento = 'factura' | 'nota_credito' | 'nota_debito' | 'otro'

export interface Factura {
  id: string
  numeroFactura: string
  proveedor: string
  nitProveedor: string
  fecha: string
  fechaVencimiento?: string
  productos: ProductoFactura[]
  subtotal: number
  impuestos: number
  total: number
  estado: 'pendiente' | 'conciliada' | 'con_diferencias' | 'rechazada'
  reciboAsociadoId?: string
  xmlRaw?: string
  correoOrigen?: string
  tipoDocumento?: TipoDocumento
  nitCliente?: string
  creadoEn: string
}

export type TipoDiferencia =
  | 'cantidad'
  | 'precio'
  | 'codigo_producto'
  | 'presentacion'
  | 'producto_no_encontrado'

export interface Diferencia {
  tipoDiferencia: TipoDiferencia
  codigoRecibo: string
  codigoFactura: string
  descripcion: string
  cantidadRecibida?: number
  cantidadFacturada?: number
  precioRecibo?: number
  precioFactura?: number
  valorDiferenciaUnitario?: number
  valorDiferenciaTotal?: number
  nota: string
}

export interface ResultadoComparacion {
  id: string
  facturaId: string
  reciboId: string
  numeroFactura: string
  numeroRecibo: string
  proveedor: string
  fechaComparacion: string
  diferencias: Diferencia[]
  tieneDiferencias: boolean
  valorTotalFactura: number
  valorTotalRecibo: number
  valorDiferenciaTotal: number
  estado: 'ok' | 'con_diferencias' | 'pendiente_recibo'
}
