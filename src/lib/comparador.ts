import type { Factura, ReciboMercancia, Diferencia, ResultadoComparacion } from '@/types'

const TOLERANCIA_PRECIO = 0.01
const SIMILITUD_DESCRIPCION = 0.7

// Devuelve los últimos 4 dígitos numéricos del número de factura
export function ultimos4Digitos(numeroFactura: string): string {
  const soloDigitos = numeroFactura.replace(/\D/g, '')
  return soloDigitos.slice(-4)
}

// Busca el recibo que coincide con los últimos 4 dígitos del número de factura
export function encontrarReciboPorFactura(
  factura: Factura,
  recibos: ReciboMercancia[]
): ReciboMercancia | undefined {
  const digitos = ultimos4Digitos(factura.numeroFactura)
  // 1. Coincidir por últimos 4 dígitos del número de recibo
  const porDigitos = recibos.find(r => r.numeroRecibo.replace(/\D/g, '').endsWith(digitos))
  if (porDigitos) return porDigitos
  // 2. Coincidir por NIT
  if (factura.nitProveedor) {
    const porNit = recibos.find(r => r.nitProveedor === factura.nitProveedor)
    if (porNit) return porNit
  }
  // 3. Coincidir por nombre de proveedor
  if (factura.proveedor) {
    return recibos.find(r =>
      r.proveedor?.toLowerCase().includes(factura.proveedor.toLowerCase()) ||
      factura.proveedor.toLowerCase().includes(r.proveedor?.toLowerCase() ?? '')
    )
  }
  return undefined
}

function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
}

function similitudTexto(a: string, b: string): number {
  const na = normalizarTexto(a)
  const nb = normalizarTexto(b)
  if (na === nb) return 1
  const wordsA = new Set(na.split(/\s+/))
  const wordsB = new Set(nb.split(/\s+/))
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length
  const union = new Set([...wordsA, ...wordsB]).size
  return union === 0 ? 0 : intersection / union
}

function esMismoPresentacion(descA: string, descB: string): boolean {
  return similitudTexto(descA, descB) >= SIMILITUD_DESCRIPCION
}

export function compararFacturaConRecibo(
  factura: Factura,
  recibo: ReciboMercancia
): ResultadoComparacion {
  const diferencias: Diferencia[] = []

  for (const pf of factura.productos) {
    const codigoExacto = recibo.productos.find(pr => pr.codigo === pf.codigo)

    if (codigoExacto) {
      // Mismo código — comparar cantidad y precio
      if (codigoExacto.cantidad !== pf.cantidad) {
        diferencias.push({
          tipoDiferencia: 'cantidad',
          codigoRecibo: codigoExacto.codigo,
          codigoFactura: pf.codigo,
          descripcion: pf.descripcion,
          cantidadRecibida: codigoExacto.cantidad,
          cantidadFacturada: pf.cantidad,
          precioRecibo: codigoExacto.precioUnitario,
          precioFactura: pf.precioUnitario,
          valorDiferenciaUnitario: pf.precioUnitario,
          valorDiferenciaTotal: (pf.cantidad - codigoExacto.cantidad) * pf.precioUnitario,
          nota: `Cantidad recibida (${codigoExacto.cantidad}) difiere de cantidad facturada (${pf.cantidad}). Diferencia: ${pf.cantidad - codigoExacto.cantidad} unidades. Valor diferencia: $${Math.abs((pf.cantidad - codigoExacto.cantidad) * pf.precioUnitario).toFixed(2)}`,
        })
      }

      const diffPrecio = Math.abs(codigoExacto.precioUnitario - pf.precioUnitario)
      if (diffPrecio > TOLERANCIA_PRECIO) {
        diferencias.push({
          tipoDiferencia: 'precio',
          codigoRecibo: codigoExacto.codigo,
          codigoFactura: pf.codigo,
          descripcion: pf.descripcion,
          cantidadRecibida: codigoExacto.cantidad,
          cantidadFacturada: pf.cantidad,
          precioRecibo: codigoExacto.precioUnitario,
          precioFactura: pf.precioUnitario,
          valorDiferenciaUnitario: pf.precioUnitario - codigoExacto.precioUnitario,
          valorDiferenciaTotal: (pf.precioUnitario - codigoExacto.precioUnitario) * pf.cantidad,
          nota: `Precio unitario en recibo ($${codigoExacto.precioUnitario}) difiere del facturado ($${pf.precioUnitario}). Diferencia unitaria: $${(pf.precioUnitario - codigoExacto.precioUnitario).toFixed(2)}. Nuevo valor total: $${(pf.precioUnitario * pf.cantidad).toFixed(2)}`,
        })
      }
    } else {
      // Código diferente — buscar por descripción similar (presentaciones)
      const porDescripcion = recibo.productos.find(pr =>
        esMismoPresentacion(pr.descripcion, pf.descripcion)
      )

      if (porDescripcion) {
        // Misma descripción, código diferente → presentación diferente
        const diffPrecio = Math.abs(porDescripcion.precioUnitario - pf.precioUnitario)
        const diffCantidad = porDescripcion.cantidad !== pf.cantidad

        diferencias.push({
          tipoDiferencia: 'presentacion',
          codigoRecibo: porDescripcion.codigo,
          codigoFactura: pf.codigo,
          descripcion: pf.descripcion,
          cantidadRecibida: porDescripcion.cantidad,
          cantidadFacturada: pf.cantidad,
          precioRecibo: porDescripcion.precioUnitario,
          precioFactura: pf.precioUnitario,
          valorDiferenciaUnitario: pf.precioUnitario - porDescripcion.precioUnitario,
          valorDiferenciaTotal:
            pf.precioUnitario * pf.cantidad - porDescripcion.precioUnitario * porDescripcion.cantidad,
          nota: `Producto con presentación diferente. Código recibo: ${porDescripcion.codigo} / Código factura: ${pf.codigo}. Descripción coincide: "${pf.descripcion}". ${diffCantidad ? `Cantidad recibida: ${porDescripcion.cantidad}, facturada: ${pf.cantidad}. ` : ''}${diffPrecio > TOLERANCIA_PRECIO ? `Precio recibo: $${porDescripcion.precioUnitario}, facturado: $${pf.precioUnitario}. ` : ''}Nuevo valor total facturado: $${(pf.precioUnitario * pf.cantidad).toFixed(2)}`,
        })
      } else {
        // Producto no encontrado en el recibo
        diferencias.push({
          tipoDiferencia: 'producto_no_encontrado',
          codigoRecibo: '',
          codigoFactura: pf.codigo,
          descripcion: pf.descripcion,
          cantidadFacturada: pf.cantidad,
          precioFactura: pf.precioUnitario,
          valorDiferenciaTotal: pf.total,
          nota: `Producto "${pf.descripcion}" (código: ${pf.codigo}) facturado por $${pf.total.toFixed(2)} NO se encontró en el recibo de mercancía.`,
        })
      }
    }
  }

  // Productos en recibo que no están en factura
  for (const pr of recibo.productos) {
    const enFactura =
      factura.productos.find(pf => pf.codigo === pr.codigo) ||
      factura.productos.find(pf => esMismoPresentacion(pf.descripcion, pr.descripcion))
    if (!enFactura) {
      diferencias.push({
        tipoDiferencia: 'producto_no_encontrado',
        codigoRecibo: pr.codigo,
        codigoFactura: '',
        descripcion: pr.descripcion,
        cantidadRecibida: pr.cantidad,
        precioRecibo: pr.precioUnitario,
        valorDiferenciaTotal: pr.subtotal,
        nota: `Producto "${pr.descripcion}" (código: ${pr.codigo}) recibido por $${pr.subtotal.toFixed(2)} NO aparece en la factura.`,
      })
    }
  }

  const valorDiferenciaTotal = factura.total - recibo.total

  return {
    id: `${factura.id}-${recibo.id}-${Date.now()}`,
    facturaId: factura.id,
    reciboId: recibo.id,
    numeroFactura: factura.numeroFactura,
    numeroRecibo: recibo.numeroRecibo,
    proveedor: factura.proveedor || recibo.proveedor,
    fechaComparacion: new Date().toISOString(),
    diferencias,
    tieneDiferencias: diferencias.length > 0,
    valorTotalFactura: factura.total,
    valorTotalRecibo: recibo.total,
    valorDiferenciaTotal,
    estado: diferencias.length === 0 ? 'ok' : 'con_diferencias',
  }
}
