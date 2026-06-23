export interface ProductoRecibo {
  codigo: string
  descripcion: string
  cantidad: number
  precioUnitario: number
  subtotal: number
}

export interface ReciboMercancia {
  id: string
  numeroRecibo: string
  proveedor: string
  nitProveedor: string
  fecha: string
  productos: ProductoRecibo[]
  total: number
  xmlRaw?: string
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
