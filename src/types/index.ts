export interface ProductoRecibo {
  codigo: string           // EntDet_Barra
  descripcion: string      // EntDet_Articulo
  cantidadPedida?: number  // EntDet_CanPed
  cantidad: number         // EntDet_CanRec (cantidad RECIBIDA)
  cantidadAdicional?: number // EntDet_CanAdi
  precioLista?: number     // EntDet_Costo (precio lista antes de descuentos)
  costoBruto?: number      // EntDet_CostoBruto (precio unitario bruto)
  precioUnitario: number   // EntDet_CostoNeto (precio neto unitario)
  descPct1?: number        // EntDet_Descue01 (% descuento 1)
  descPct2?: number        // EntDet_Descue02 (% descuento 2)
  descPct3?: number        // EntDet_Descue03 (% descuento 3)
  descuento?: number       // descuento calculado total
  tasaIva?: number         // EntDet_Iva (tasa % IVA: 0, 5, 19)
  iva?: number             // TotalVrIva (valor IVA de la línea)
  tasaIconsumo?: number    // EntDet_IConsumo tasa
  iconsumo?: number        // valor impoconsumo de la línea
  tasaIbua?: number        // EntDet_IBUA tasa
  ibua?: number            // TotalVrIBUA (valor IBUA)
  tasaIcui?: number        // EntDet_ICUI tasa
  icui?: number            // TotalVrICUI (valor ICUI)
  estampillas?: number     // EntDet_Estampillas
  otros?: number           // EntDet_Otros
  totalBruto?: number      // EntDet_TotalBruto (Cant × CostoBruto)
  subtotal: number         // EntDet_TotalNeto (total neto sin impuestos)
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
  notaAjuste?: any  // NotaAjustePrecio | null
}
