import type { Factura, ReciboMercancia, ProductoFactura, ProductoRecibo, Diferencia, ResultadoComparacion } from '@/types'

// ── Normalización ─────────────────────────────────────────────────────────────

// Abreviaturas comunes en facturas colombianas
const ABREVIATURAS: Record<string, string> = {
  'manzna': 'manzana', 'manzn': 'manzana',
  'bande': 'bandeja', 'bandej': 'bandeja',
  'aprox': 'aproximado', 'apx': 'aproximado',
  'und': 'unidad', 'uds': 'unidades', 'un': 'unidad',
  'x': '', 'gr': 'gramo', 'grs': 'gramos', 'kg': 'kilo', 'kl': 'kilo',
  'selec': 'selecto', 'select': 'selecto',
  'comb': 'combinado', 'combina': 'combinado',
  'nac': 'nacional', 'col': 'colombia',
}

function normalizar(texto: string): string {
  let s = (texto || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Eliminar prefijo numérico al inicio (ej: "750 GUAYABA" → "GUAYABA")
  s = s.replace(/^\d+\s+/, '')

  // Eliminar EAN (secuencia de 8-14 dígitos seguida de espacio)
  s = s.replace(/\b\d{8,14}\b/g, '').replace(/\s+/g, ' ').trim()

  // Expandir abreviaturas
  s = s.split(' ').map(w => ABREVIATURAS[w] ?? w).filter(Boolean).join(' ')

  return s
}

// Extrae EAN de un campo código O de dentro de la descripción
function limpiarEAN(codigo: string, descripcion?: string): string {
  const eanCodigo = (codigo || '').replace(/\D/g, '').trim()
  if (eanCodigo.length >= 8) return eanCodigo

  // Intentar extraer EAN de la descripción (8-14 dígitos al inicio)
  if (descripcion) {
    const match = (descripcion || '').match(/\b(\d{8,14})\b/)
    if (match) return match[1]
  }
  return eanCodigo
}

// Similitud combinada: Jaccard de palabras + substrings
function similitud(a: string, b: string): number {
  const na = normalizar(a), nb = normalizar(b)
  if (!na || !nb) return 0
  if (na === nb) return 1

  // Contiene completo
  if (na.includes(nb) || nb.includes(na)) return 0.92

  const wa = na.split(' ').filter(w => w.length > 2)
  const wb = nb.split(' ').filter(w => w.length > 2)
  const setA = new Set(wa), setB = new Set(wb)

  // Jaccard estricto
  const inter = [...setA].filter(w => setB.has(w)).length
  const union = new Set([...setA, ...setB]).size
  const jaccard = union === 0 ? 0 : inter / union

  // Bonus: palabras de a que son substring de alguna palabra de b (abreviaturas)
  let bonus = 0
  for (const w of wa) {
    if (w.length >= 4 && [...setB].some(bw => bw.startsWith(w) || w.startsWith(bw))) bonus += 0.08
  }

  return Math.min(1, jaccard + bonus)
}

const UMBRAL_DESC = 0.40

// ── Sinónimos regionales Colombia ─────────────────────────────────────────────
// Frutas, verduras y productos con nombres distintos por región
const SINONIMOS: Record<string, string[]> = {
  // Frutas exóticas y tropicales
  'gulupa':          ['curuba redonda', 'maracuya pequeño', 'granadilla china', 'passion fruit'],
  'curuba':          ['taxo', 'curuba larga', 'tumbo', 'banana pasion'],
  'uchuva':          ['uvilla', 'physalis', 'vejigon', 'capuli', 'tomatillo'],
  'lulo':            ['naranjilla', 'tomate de monte'],
  'pitahaya':        ['pitaya', 'dragon fruit', 'fruta del dragon'],
  'feijoa':          ['guayabo del pais', 'guayaba feijoa', 'acca'],
  'tomate de arbol': ['tamarillo', 'tomate de monte', 'tomate arbóreo'],
  'chontaduro':      ['pejibaye', 'cachipay', 'pupunha'],
  'guanabana':       ['graviola', 'soursop'],
  'maracuya':        ['parchita', 'passion fruit', 'granadilla amarilla', 'parcha'],
  'papaya':          ['lechosa', 'papaw', 'fruta bomba', 'mamão'],
  'aguacate':        ['palta', 'avocado', 'cura', 'abacate'],
  'pina':            ['ananas', 'ananás', 'piña perolera'],
  'mora':            ['zarzamora', 'mora castilla', 'blackberry'],
  'fresa':           ['frutilla', 'strawberry', 'fresón'],
  'mamoncillo':      ['mamón', 'quenepa', 'limoncillo', 'mamon'],
  'guayaba':         ['guava', 'guayabo'],
  'zapote':          ['mamey', 'zapote negro', 'sapote'],
  'nispero':         ['níspero', 'sapodilla', 'chiku'],
  'granadilla':      ['granadilla dulce', 'sweet granadilla'],
  'borojo':          ['borojó', 'borojo negro'],
  'corozo':          ['palma corozo', 'naidí'],
  'arazá':           ['araza', 'guayaba amazónica'],
  'carambolo':       ['carambola', 'star fruit'],

  // Verduras y tubérculos regionales
  'auyama':          ['ahuyama', 'calabaza', 'zapallo', 'ahuama', 'calabacín'],
  'yuca':            ['mandioca', 'cassava', 'tapioca', 'yuca amarga'],
  'name':            ['ñame', 'yam', 'ñame espino'],
  'arracacha':       ['apio', 'aracacha', 'blanco apio'],
  'bore':            ['malanga', 'taro', 'ñampi'],
  'guatila':         ['chayote', 'cidra', 'papa de aire', 'chayota'],
  'pepino cohombro': ['cohombro', 'pepino pepon', 'cucumber', 'pepino latino'],
  'cebolla junca':   ['cebolla larga', 'cebolla rama', 'cebollin', 'green onion', 'cebolla de rama'],
  'cebolla cabezona':['cebolla blanca', 'cebolla morada', 'cebolla roja'],
  'papa criolla':    ['papa amarilla', 'papa nativa', 'papa criolla especial'],
  'papa capira':     ['papa pastusa', 'papa blanca', 'papa capira pastusa'],
  'tomate chonto':   ['tomate', 'tomate criollo', 'tomatillo chonto'],
  'tomate cherry':   ['tomate uva', 'tomatito', 'tomate bolita'],
  'pimenton':        ['pimiento', 'chile dulce', 'bell pepper', 'morrón'],
  'cilantro':        ['culantro', 'coriandro', 'cilantrón'],
  'platano':         ['plátano hartón', 'plátano dominico', 'plantain', 'banano macho'],
  'banano':          ['banana', 'guineo', 'manzanillo'],
  'habichuela':      ['vainita', 'ejote', 'green bean', 'habichuela larga'],
  'frijol':          ['fríjol', 'habichuela roja', 'bean', 'poroto'],
  'arveja':          ['guisante', 'alverja', 'petit pois', 'pea'],
  'repollo':         ['col', 'cabbage', 'col repollo'],
  'coliflor':        ['brocoli de flor', 'cauliflower'],
  'remolacha':       ['betarraga', 'beet', 'betabel', 'beterrada'],
  'mango':           ['manga', 'mango tomy', 'mango tommy'],
  'uva':             ['grape', 'uva red globe', 'uva crimson'],
  'melon':           ['cantaloupe', 'melón cantaloup', 'melon chino', 'melon verde'],
  'sandia':          ['sandía', 'watermelon', 'patilla'],
  'maiz':            ['choclo', 'mazorca', 'elote', 'corn'],
}

// Normaliza para buscar en el diccionario
function normalizarParaSinonimos(texto: string): string {
  return texto.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Busca si dos textos son sinónimos o contienen sinónimos conocidos
function esSinonimo(a: string, b: string): boolean {
  const na = normalizarParaSinonimos(a)
  const nb = normalizarParaSinonimos(b)
  for (const [clave, variantes] of Object.entries(SINONIMOS)) {
    const todos = [clave, ...variantes].map(v => normalizarParaSinonimos(v))
    const enA = todos.some(v => na.includes(v) || v.includes(na.split(' ')[0]))
    const enB = todos.some(v => nb.includes(v) || v.includes(nb.split(' ')[0]))
    if (enA && enB) return true
  }
  return false
}

// ── Detección de embalaje ─────────────────────────────────────────────────────
interface InfoEmbalaje {
  tipo: string
  unidades: number
  textoDetectado: string
}

const PALABRAS_EMBALAJE: Record<string, number> = {
  'sixpack': 6, 'six pack': 6, 'six-pack': 6,
  'docena': 12, 'media docena': 6,
}

function detectarEmbalaje(descripcion: string): InfoEmbalaje | null {
  if (!descripcion) return null
  const desc = descripcion.toLowerCase()

  // Palabras fijas
  for (const [key, uds] of Object.entries(PALABRAS_EMBALAJE)) {
    if (desc.includes(key)) return { tipo: key, unidades: uds, textoDetectado: key }
  }

  // Patrones: "X 12", "*12", "x12", "PAC X 6", "CAJA*24", "CAJA X 12 UND", "X24"
  const patronesNum = [
    /[x*]\s*(\d+)\s*(und|uds|unid|unidades|un)?/i,  // X 12, *12, x12
    /caja\s*[x*]?\s*(\d+)/i,
    /paca?\s*[x*]?\s*(\d+)/i,
    /pack\s*[x*]?\s*(\d+)/i,
    /bolsa\s*[x*]?\s*(\d+)/i,
    /canasta\s*[x*]?\s*(\d+)/i,
    /fardo\s*[x*]?\s*(\d+)/i,
    /bandeja\s*[x*]?\s*(\d+)/i,
    /display\s*[x*]?\s*(\d+)/i,
    /estuche\s*[x*]?\s*(\d+)/i,
    /(\d+)\s*(und|uds|unidades)\s*[x*]/i,
  ]

  for (const patron of patronesNum) {
    const m = desc.match(patron)
    if (m) {
      const uds = parseInt(m[1] || m[2] || '1', 10)
      if (uds > 1 && uds <= 500) {
        const tipo = desc.includes('caja') ? 'caja' :
                     desc.includes('pac') ? 'paca' :
                     desc.includes('bolsa') ? 'bolsa' : 'embalaje'
        return { tipo, unidades: uds, textoDetectado: m[0] }
      }
    }
  }
  return null
}

// ── Emparejamiento EAN + Descripción ─────────────────────────────────────────
interface Par {
  pf: ProductoFactura
  pr: ProductoRecibo
  criterio: 'ean' | 'descripcion'
  score: number
}

function emparejarProductos(
  factura: Factura,
  recibo: ReciboMercancia
): { pares: Par[]; soloFactura: ProductoFactura[]; soloRecibo: ProductoRecibo[] } {
  const usadosRecibo = new Set<number>()
  const pares: Par[] = []
  const soloFactura: ProductoFactura[] = []

  for (const pf of factura.productos) {
    // Extraer EAN del campo codigo O de la descripción
    const eanF = limpiarEAN(pf.codigo, pf.descripcion)
    let mejor: { idx: number; par: Par } | null = null

    for (let i = 0; i < recibo.productos.length; i++) {
      if (usadosRecibo.has(i)) continue
      const pr = recibo.productos[i]
      const eanR = limpiarEAN(pr.codigo, pr.descripcion)

      // 1. Coincidencia exacta por EAN
      if (eanF && eanR && eanF.length >= 8 && eanR.length >= 8 && eanF === eanR) {
        mejor = { idx: i, par: { pf, pr, criterio: 'ean', score: 1 } }
        break
      }

      // 2. EAN parcial (EAN-8 dentro de EAN-13, etc.)
      if (eanF && eanR && eanF.length >= 6 && eanR.length >= 6 &&
        (eanF.endsWith(eanR) || eanR.endsWith(eanF))) {
        const sc = 0.95
        if (!mejor || sc > mejor.par.score)
          mejor = { idx: i, par: { pf, pr, criterio: 'ean', score: sc } }
        continue
      }

      // 3. Sinónimos regionales Colombia (ej: GULUPA = CURUBA REDONDA)
      if (esSinonimo(pf.descripcion, pr.descripcion)) {
        const sc = 0.88
        if (!mejor || sc > mejor.par.score)
          mejor = { idx: i, par: { pf, pr, criterio: 'descripcion', score: sc } }
        continue
      }

      // 4. Descripción — usa normalización mejorada con abreviaturas
      const sc = similitud(pf.descripcion, pr.descripcion)
      // Bonus: si las cantidades son idénticas y hay similitud media, aumentar confianza
      const cantF = pf.cantidad, cantR = pr.cantidad
      const bonusCantidad = Math.abs(cantF - cantR) < 0.01 && sc >= 0.30 ? 0.15 : 0
      const scFinal = Math.min(1, sc + bonusCantidad)
      if (scFinal >= UMBRAL_DESC && (!mejor || scFinal > mejor.par.score)) {
        mejor = { idx: i, par: { pf, pr, criterio: 'descripcion', score: scFinal } }
      }
    }

    if (mejor) {
      pares.push(mejor.par)
      usadosRecibo.add(mejor.idx)
    } else {
      soloFactura.push(pf)
    }
  }

  const soloRecibo = recibo.productos.filter((_, i) => !usadosRecibo.has(i))
  return { pares, soloFactura, soloRecibo }
}

// ── Tipos para la nota de ajuste ──────────────────────────────────────────────
export interface LineaAjuste {
  codigoEAN: string
  descripcionFactura: string
  descripcionRecibo: string
  criterioMatch: 'ean' | 'descripcion' | 'no_encontrado'
  cantFacturada: number
  cantRecibida: number
  difCantidad: number
  precioFactura: number
  precioRecibo: number
  difPrecio: number
  ivaFactura: number
  ivaRecibo: number
  difIva: number
  iconsumoFactura: number
  iconsumoRecibo: number
  difIconsumo: number
  ibuaFactura: number
  ibuaRecibo: number
  difIbua: number
  icuiFactura: number
  icuiRecibo: number
  difIcui: number
  descuentoFactura: number
  descuentoRecibo: number
  difDescuento: number
  totalFactura: number
  totalRecibo: number
  diferenciaNeta: number
  tienesDiferencia: boolean
}

export interface NotaAjustePrecio {
  numeroFactura: string
  numeroRecibo: string
  proveedor: string
  nitProveedor: string
  fecha: string
  lineas: LineaAjuste[]
  totalFactura: number
  totalRecibo: number
  difCantidades: number
  difPrecios: number
  difImpuestos: number
  difDescuentos: number
  diferenciaNeta: number
  generada: string
}

// ── Buscar nota crédito que cubra una diferencia ─────────────────────────────
function buscarNotaCredito(
  notasCredito: Factura[],
  nitProveedor: string,
  codigoProducto: string,
  descripcion: string,
  cantidadDif: number
): { encontrada: boolean; numeroNota: string; cantidadNota: number } {
  for (const nc of notasCredito) {
    // Misma proveedor/NIT
    const mismoProv = nc.nitProveedor === nitProveedor ||
      normalizarNIT(nc.nitProveedor) === normalizarNIT(nitProveedor)
    if (!mismoProv) continue

    for (const prod of nc.productos) {
      const eanNC = limpiarEAN(prod.codigo, prod.descripcion)
      const eanProd = limpiarEAN(codigoProducto, descripcion)
      const matchEAN = eanNC && eanProd && eanNC === eanProd
      const matchDesc = similitud(prod.descripcion, descripcion) >= UMBRAL_DESC

      if (matchEAN || matchDesc) {
        // La cantidad en la nota crédito cubre (total o parcialmente) la diferencia
        if (Math.abs(prod.cantidad) >= Math.abs(cantidadDif) * 0.9) {
          return { encontrada: true, numeroNota: nc.numeroFactura, cantidadNota: prod.cantidad }
        }
      }
    }
  }
  return { encontrada: false, numeroNota: '', cantidadNota: 0 }
}

// ── Comparación principal ─────────────────────────────────────────────────────
const TOLERANCIA = 0.01

export function compararFacturaConRecibo(
  factura: Factura,
  recibo: ReciboMercancia,
  notasCredito: Factura[] = []  // notas crédito del mismo proveedor
): ResultadoComparacion {
  const diferencias: Diferencia[] = []
  const { pares, soloFactura, soloRecibo } = emparejarProductos(factura, recibo)

  // Compara dos valores teniendo en cuenta si la factura trae decimales
  // Si la factura NO tiene decimales, se redondean ambos antes de comparar
  function compararValor(valFactura: number, valRecibo: number): {
    diferencia: number, usarDecimales: boolean
  } {
    const factTieneDecimales = Math.abs(valFactura - Math.round(valFactura)) > 0.005
    if (!factTieneDecimales) {
      // Factura es número entero → ignorar decimales del recibo
      return { diferencia: Math.round(valFactura) - Math.round(valRecibo), usarDecimales: false }
    }
    return { diferencia: valFactura - valRecibo, usarDecimales: true }
  }

  // --- Comparar cada par emparejado ---
  for (const { pf, pr, criterio } of pares) {
    // Detectar si la factura viene en embalaje (caja, sixpack, etc.)
    const embalaje = detectarEmbalaje(pf.descripcion)

    // Cantidad efectiva de la factura en unidades
    // Si viene en cajas de 12 y la factura dice 5 cajas → 60 unidades
    const cantF_raw = pf.cantidad
    const cantF_uds = embalaje ? cantF_raw * embalaje.unidades : cantF_raw
    const cantR = pr.cantidad

    // Para comparar precios: si hay embalaje, el precio unitario de la factura
    // es por embalaje, el del recibo es por unidad → convertir
    const precioF_uds = embalaje ? pf.precioUnitario / embalaje.unidades : pf.precioUnitario

    const cantF = cantF_uds  // cantidad comparable
    const precioF = precioF_uds
    const precioR = pr.precioUnitario
    const ivaF = pf.impuesto || 0, ivaR = (pr as any).iva || 0
    const icF = 0, icR = (pr as any).iconsumo || 0
    const ibuaF = 0, ibuaR = (pr as any).ibua || 0
    const icuiF = 0, icuiR = (pr as any).icui || 0
    const descF = pf.descuento || 0, descR = (pr as any).descuento || 0
    const totalF = pf.total, totalR = pr.subtotal

    const difNeta = totalF - totalR

    // Comparar cantidad y precio usando la regla de decimales
    const cmpCant  = compararValor(cantF, cantR)
    const cmpPrecio = compararValor(precioF, precioR)
    const cmpIva    = compararValor(ivaF, ivaR)

    // 1. Diferencia de cantidad (considerando embalaje y decimales)
    if (Math.abs(cmpCant.diferencia) > TOLERANCIA) {
      const difCant = cmpCant.diferencia
      // Verificar si existe nota crédito que justifique el faltante
      const nc = notasCredito.length > 0
        ? buscarNotaCredito(notasCredito, factura.nitProveedor, pf.codigo, pf.descripcion, difCant)
        : { encontrada: false, numeroNota: '', cantidadNota: 0 }

      const embalajeInfo = embalaje
        ? ` [Embalaje: ${embalaje.tipo} x${embalaje.unidades} → Fact. ${cantF_raw} ${embalaje.tipo}s = ${cantF_uds} uds]`
        : ''

      const ncInfo = nc.encontrada
        ? ` ✅ CUBIERTO por Nota Crédito ${nc.numeroNota} (${nc.cantidadNota} uds)`
        : ''

      diferencias.push({
        tipoDiferencia: 'cantidad',
        codigoFactura: pf.codigo, codigoRecibo: pr.codigo,
        descripcion: pf.descripcion,
        cantidadFacturada: cantF, cantidadRecibida: cantR,
        precioFactura: precioF, precioRecibo: precioR,
        valorDiferenciaUnitario: precioF,
        valorDiferenciaTotal: nc.encontrada ? 0 : difCant * precioF,
        nota: `${criterio === 'ean' ? '🔢 EAN' : '📝 Desc.'}: Facturado ${cantF} uds ≠ Recibido ${cantR} uds. Diferencia: ${difCant} uds × $${precioF.toLocaleString('es-CO')} = $${(difCant * precioF).toLocaleString('es-CO')}${embalajeInfo}${ncInfo}`,
      })
    }

    // 2. Diferencia de precio unitario (respetando decimales de la factura)
    if (Math.abs(cmpPrecio.diferencia) > TOLERANCIA) {
      const difP = cmpPrecio.diferencia
      diferencias.push({
        tipoDiferencia: 'precio',
        codigoFactura: pf.codigo, codigoRecibo: pr.codigo,
        descripcion: pf.descripcion,
        cantidadFacturada: cantF, cantidadRecibida: cantR,
        precioFactura: precioF, precioRecibo: precioR,
        valorDiferenciaUnitario: difP,
        valorDiferenciaTotal: difP * cantF,
        nota: `Precio unitario factura $${precioF.toLocaleString('es-CO')} ≠ recibo $${precioR.toLocaleString('es-CO')}.${!cmpPrecio.usarDecimales ? ' (Factura sin decimales: se compara en enteros)' : ''} Diferencia: $${difP.toLocaleString('es-CO')} × ${cantF} uds = $${(difP * cantF).toLocaleString('es-CO')}`,
      })
    }

    // 3. Diferencia IVA (respetando decimales de la factura)
    if (Math.abs(cmpIva.diferencia) > TOLERANCIA && (ivaF > 0 || ivaR > 0)) {
      diferencias.push({
        tipoDiferencia: 'precio',
        codigoFactura: pf.codigo, codigoRecibo: pr.codigo,
        descripcion: `IVA — ${pf.descripcion}`,
        precioFactura: ivaF, precioRecibo: ivaR,
        valorDiferenciaTotal: cmpIva.diferencia,
        nota: `IVA facturado $${ivaF.toLocaleString('es-CO')} ≠ IVA recibo $${ivaR.toLocaleString('es-CO')}.${!cmpIva.usarDecimales ? ' (Factura sin decimales)' : ''} Diferencia: $${cmpIva.diferencia.toLocaleString('es-CO')}`,
      })
    }

    // 4. Diferencia Impoconsumo
    if (Math.abs(icF - icR) > TOLERANCIA && icR > 0) {
      diferencias.push({
        tipoDiferencia: 'precio',
        codigoFactura: pf.codigo, codigoRecibo: pr.codigo,
        descripcion: `Impoconsumo — ${pf.descripcion}`,
        precioFactura: icF, precioRecibo: icR,
        valorDiferenciaTotal: icF - icR,
        nota: `Impoconsumo factura $${icF.toLocaleString('es-CO')} ≠ recibo $${icR.toLocaleString('es-CO')}`,
      })
    }

    // 5. Diferencia IBUA
    if (Math.abs(ibuaF - ibuaR) > TOLERANCIA && ibuaR > 0) {
      diferencias.push({
        tipoDiferencia: 'precio',
        codigoFactura: pf.codigo, codigoRecibo: pr.codigo,
        descripcion: `IBUA — ${pf.descripcion}`,
        precioFactura: ibuaF, precioRecibo: ibuaR,
        valorDiferenciaTotal: ibuaF - ibuaR,
        nota: `IBUA factura $${ibuaF.toLocaleString('es-CO')} ≠ recibo $${ibuaR.toLocaleString('es-CO')}`,
      })
    }

    // 6. Diferencia ICUI
    if (Math.abs(icuiF - icuiR) > TOLERANCIA && icuiR > 0) {
      diferencias.push({
        tipoDiferencia: 'precio',
        codigoFactura: pf.codigo, codigoRecibo: pr.codigo,
        descripcion: `ICUI — ${pf.descripcion}`,
        precioFactura: icuiF, precioRecibo: icuiR,
        valorDiferenciaTotal: icuiF - icuiR,
        nota: `ICUI factura $${icuiF.toLocaleString('es-CO')} ≠ recibo $${icuiR.toLocaleString('es-CO')}`,
      })
    }

    // 7. Diferencia descuentos
    if (Math.abs(descF - descR) > TOLERANCIA && (descF > 0 || descR > 0)) {
      diferencias.push({
        tipoDiferencia: 'precio',
        codigoFactura: pf.codigo, codigoRecibo: pr.codigo,
        descripcion: `Descuento — ${pf.descripcion}`,
        precioFactura: descF, precioRecibo: descR,
        valorDiferenciaTotal: descF - descR,
        nota: `Descuento factura $${descF.toLocaleString('es-CO')} ≠ recibo $${descR.toLocaleString('es-CO')}`,
      })
    }

    // 8. Diferencia de presentación (emparejó por descripción, códigos distintos)
    if (criterio === 'descripcion' && pf.codigo && pr.codigo && limpiarEAN(pf.codigo) !== limpiarEAN(pr.codigo)) {
      const esSin = esSinonimo(pf.descripcion, pr.descripcion)
      diferencias.push({
        tipoDiferencia: 'presentacion',
        codigoFactura: pf.codigo, codigoRecibo: pr.codigo,
        descripcion: pf.descripcion,
        cantidadFacturada: cantF, cantidadRecibida: cantR,
        precioFactura: precioF, precioRecibo: precioR,
        valorDiferenciaTotal: difNeta,
        nota: esSin
          ? `🌿 Sinónimo regional: "${pf.descripcion}" (factura) = "${pr.descripcion}" (recibo). Mismo producto con nombre regional diferente. EAN factura: ${pf.codigo} / recibo: ${pr.codigo}. Valor: $${totalF.toLocaleString('es-CO')} vs $${totalR.toLocaleString('es-CO')}`
          : `Producto emparejado por descripción con códigos distintos. EAN factura: ${pf.codigo} / recibo: ${pr.codigo}. Verificar presentación. Valor: $${totalF.toLocaleString('es-CO')} vs $${totalR.toLocaleString('es-CO')}`,
      })
    }
  }

  // --- Productos en factura sin par en recibo ---
  for (const pf of soloFactura) {
    diferencias.push({
      tipoDiferencia: 'producto_no_encontrado',
      codigoFactura: pf.codigo, codigoRecibo: '',
      descripcion: pf.descripcion,
      cantidadFacturada: pf.cantidad,
      precioFactura: pf.precioUnitario,
      valorDiferenciaTotal: pf.total,
      nota: `Producto en FACTURA no encontrado en recibo. Código: ${pf.codigo || '—'} | Cant: ${pf.cantidad} | Total: $${pf.total.toLocaleString('es-CO')}`,
    })
  }

  // --- Productos en recibo sin par en factura ---
  for (const pr of soloRecibo) {
    diferencias.push({
      tipoDiferencia: 'producto_no_encontrado',
      codigoFactura: '', codigoRecibo: pr.codigo,
      descripcion: pr.descripcion,
      cantidadRecibida: pr.cantidad,
      precioRecibo: pr.precioUnitario,
      valorDiferenciaTotal: -pr.subtotal,
      nota: `Producto en RECIBO no encontrado en factura. Código: ${pr.codigo || '—'} | Cant: ${pr.cantidad} | Total: $${pr.subtotal.toLocaleString('es-CO')}`,
    })
  }

  // Diferencia total respetando decimales de la factura
  const cmpTotal = compararValor(factura.total, recibo.total)
  const valorDiferenciaTotal = cmpTotal.diferencia

  // --- Generar Nota de Ajuste si hay diferencia de totales ---
  let notaAjuste: NotaAjustePrecio | null = null
  if (Math.abs(valorDiferenciaTotal) > TOLERANCIA) {
    const lineas: LineaAjuste[] = pares.map(({ pf, pr, criterio }) => {
      const pr_ = pr as any
      const totalF = pf.total
      const totalR = pr.subtotal
      return {
        codigoEAN: limpiarEAN(pf.codigo) || limpiarEAN(pr.codigo),
        descripcionFactura: pf.descripcion,
        descripcionRecibo: pr.descripcion,
        criterioMatch: criterio,
        cantFacturada: pf.cantidad, cantRecibida: pr.cantidad, difCantidad: pf.cantidad - pr.cantidad,
        precioFactura: pf.precioUnitario, precioRecibo: pr.precioUnitario, difPrecio: pf.precioUnitario - pr.precioUnitario,
        ivaFactura: pf.impuesto || 0, ivaRecibo: pr_.iva || 0, difIva: (pf.impuesto || 0) - (pr_.iva || 0),
        iconsumoFactura: 0, iconsumoRecibo: pr_.iconsumo || 0, difIconsumo: -(pr_.iconsumo || 0),
        ibuaFactura: 0, ibuaRecibo: pr_.ibua || 0, difIbua: -(pr_.ibua || 0),
        icuiFactura: 0, icuiRecibo: pr_.icui || 0, difIcui: -(pr_.icui || 0),
        descuentoFactura: pf.descuento || 0, descuentoRecibo: pr_.descuento || 0, difDescuento: (pf.descuento || 0) - (pr_.descuento || 0),
        totalFactura: totalF, totalRecibo: totalR,
        diferenciaNeta: totalF - totalR,
        tienesDiferencia: Math.abs(totalF - totalR) > TOLERANCIA,
      }
    })

    // Agregar los sin par
    soloFactura.forEach(pf => lineas.push({
      codigoEAN: limpiarEAN(pf.codigo), descripcionFactura: pf.descripcion, descripcionRecibo: '—', criterioMatch: 'no_encontrado',
      cantFacturada: pf.cantidad, cantRecibida: 0, difCantidad: pf.cantidad,
      precioFactura: pf.precioUnitario, precioRecibo: 0, difPrecio: pf.precioUnitario,
      ivaFactura: pf.impuesto || 0, ivaRecibo: 0, difIva: pf.impuesto || 0,
      iconsumoFactura: 0, iconsumoRecibo: 0, difIconsumo: 0,
      ibuaFactura: 0, ibuaRecibo: 0, difIbua: 0,
      icuiFactura: 0, icuiRecibo: 0, difIcui: 0,
      descuentoFactura: pf.descuento || 0, descuentoRecibo: 0, difDescuento: pf.descuento || 0,
      totalFactura: pf.total, totalRecibo: 0, diferenciaNeta: pf.total, tienesDiferencia: true,
    }))

    soloRecibo.forEach(pr => {
      const pr_ = pr as any
      lineas.push({
        codigoEAN: limpiarEAN(pr.codigo), descripcionFactura: '—', descripcionRecibo: pr.descripcion, criterioMatch: 'no_encontrado',
        cantFacturada: 0, cantRecibida: pr.cantidad, difCantidad: -pr.cantidad,
        precioFactura: 0, precioRecibo: pr.precioUnitario, difPrecio: -pr.precioUnitario,
        ivaFactura: 0, ivaRecibo: pr_.iva || 0, difIva: -(pr_.iva || 0),
        iconsumoFactura: 0, iconsumoRecibo: pr_.iconsumo || 0, difIconsumo: -(pr_.iconsumo || 0),
        ibuaFactura: 0, ibuaRecibo: pr_.ibua || 0, difIbua: -(pr_.ibua || 0),
        icuiFactura: 0, icuiRecibo: pr_.icui || 0, difIcui: -(pr_.icui || 0),
        descuentoFactura: 0, descuentoRecibo: pr_.descuento || 0, difDescuento: -(pr_.descuento || 0),
        totalFactura: 0, totalRecibo: pr.subtotal, diferenciaNeta: -pr.subtotal, tienesDiferencia: true,
      })
    })

    const lineasConDif = lineas.filter(l => l.tienesDiferencia)
    notaAjuste = {
      numeroFactura: factura.numeroFactura,
      numeroRecibo: recibo.numeroRecibo,
      proveedor: factura.proveedor || recibo.proveedor,
      nitProveedor: factura.nitProveedor || recibo.nitProveedor,
      fecha: new Date().toISOString().slice(0, 10),
      lineas: lineasConDif,
      totalFactura: factura.total,
      totalRecibo: recibo.total,
      difCantidades: lineasConDif.reduce((s, l) => s + (l.difCantidad * l.precioFactura), 0),
      difPrecios:    lineasConDif.reduce((s, l) => s + (l.difPrecio * l.cantFacturada), 0),
      difImpuestos:  lineasConDif.reduce((s, l) => s + l.difIva + l.difIconsumo + l.difIbua + l.difIcui, 0),
      difDescuentos: lineasConDif.reduce((s, l) => s + l.difDescuento, 0),
      diferenciaNeta: valorDiferenciaTotal,
      generada: new Date().toISOString(),
    }
  }

  // Diferencias "reales" — excluir presentacion sin valor económico
  // Si la única diferencia es presentacion (código distinto pero mismo producto/cantidad/precio)
  // y el valor de la diferencia es 0, NO se considera diferencia real
  const diferenciasReales = diferencias.filter(d => {
    if (d.tipoDiferencia !== 'presentacion') return true
    // Es presentacion: solo cuenta si hay diferencia de valor real
    return Math.abs(d.valorDiferenciaTotal ?? 0) > TOLERANCIA
  })

  const hayDiferenciasReales = diferenciasReales.length > 0 || Math.abs(valorDiferenciaTotal) > TOLERANCIA

  return {
    id: `${factura.id}-${recibo.id}-${Date.now()}`,
    facturaId: factura.id,
    reciboId: recibo.id,
    numeroFactura: factura.numeroFactura,
    numeroRecibo: recibo.numeroRecibo,
    proveedor: factura.proveedor || recibo.proveedor,
    fechaComparacion: new Date().toISOString(),
    diferencias,  // conservar todas las diferencias para el informe
    tieneDiferencias: hayDiferenciasReales,
    valorTotalFactura: factura.total,
    valorTotalRecibo: recibo.total,
    valorDiferenciaTotal,
    estado: hayDiferenciasReales ? 'con_diferencias' : 'ok',
    notaAjuste,
  } as ResultadoComparacion & { notaAjuste: NotaAjustePrecio | null }
}

// ── Utilidades exportadas ─────────────────────────────────────────────────────
export function ultimos4Digitos(numeroFactura: string): string {
  return (numeroFactura || '').replace(/\D/g, '').slice(-4)
}

function normalizarNIT(nit: string): string {
  return (nit || '').replace(/[.\-\s]/g, '').slice(0, 9)
}

// Palabras genéricas que no sirven para distinguir proveedores
const PALABRAS_GENERICAS = new Set([
  'distribuidora', 'distribuciones', 'comercializadora', 'comercializaciones',
  'comercial', 'productos', 'alimentos', 'alimenticios', 'nacional', 'colombia',
  'colombiana', 'colombiano', 'industria', 'industrial', 'inversiones',
  'compania', 'empresa', 'grupo', 'servicios', 'sociedad', 'limitada',
  'ltda', 's.a', 'sas', 'sa', 'sociedad', 'anonima', 'cooperativa',
  'ventas', 'importadora', 'exportadora', 'proveedor', 'proveedores',
])

function palabrasSignificativas(nombre: string): string[] {
  return (nombre || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(p => p.length > 3 && !PALABRAS_GENERICAS.has(p))
}

export function encontrarReciboPorFactura(
  factura: Factura,
  recibos: ReciboMercancia[]
): ReciboMercancia | undefined {
  const digitos = ultimos4Digitos(factura.numeroFactura)
  const nitFact = normalizarNIT(factura.nitProveedor || '')

  // 1. Coincidencia exacta por numeroFacturaProveedor (última 4 del No. factura)
  if (digitos) {
    const porNoFact = recibos.find(r =>
      r.numeroFacturaProveedor && r.numeroFacturaProveedor === digitos
    )
    if (porNoFact) return porNoFact
  }

  // 2. NIT normalizado — coincidencia fuerte (mínimo 8 dígitos coincidentes)
  if (nitFact.length >= 8) {
    const porNit = recibos.find(r => {
      const nitRec = normalizarNIT(r.nitProveedor || '')
      return nitRec.length >= 8 && nitRec === nitFact
    })
    if (porNit) return porNit

    // NIT parcial (al menos 6 dígitos del inicio)
    const porNitParcial = recibos.find(r => {
      const nitRec = normalizarNIT(r.nitProveedor || '')
      return nitRec.length >= 6 && (
        nitRec.slice(0, 8) === nitFact.slice(0, 8)
      )
    })
    if (porNitParcial) return porNitParcial
  }

  // 3. Nombre del proveedor — solo si hay AL MENOS 2 palabras significativas en común
  //    Y el NIT tiene al menos los primeros 4 dígitos en común (evitar falsos positivos)
  if (factura.proveedor && nitFact.length >= 4) {
    const palabrasFact = palabrasSignificativas(factura.proveedor)
    if (palabrasFact.length >= 1) {
      const porNombre = recibos.find(r => {
        if (!r.proveedor) return false
        const nitRec = normalizarNIT(r.nitProveedor || '')
        // El NIT debe coincidir al menos en los primeros 4 dígitos
        if (nitRec.length >= 4 && !nitRec.startsWith(nitFact.slice(0, 4)) && !nitFact.startsWith(nitRec.slice(0, 4))) return false
        const palabrasRec = palabrasSignificativas(r.proveedor)
        const coincidencias = palabrasFact.filter(p => palabrasRec.some(rp => rp === p || rp.startsWith(p) || p.startsWith(rp)))
        // Requiere al menos 2 palabras significativas en común
        return coincidencias.length >= 2
      })
      if (porNombre) return porNombre
    }
  }

  // 4. Solo si hay 1 recibo disponible Y el NIT coincide
  if (recibos.length === 1 && nitFact.length >= 4) {
    const nitRec = normalizarNIT(recibos[0].nitProveedor || '')
    if (nitRec.startsWith(nitFact.slice(0, 4)) || nitFact.startsWith(nitRec.slice(0, 4))) {
      return recibos[0]
    }
  }

  return undefined
}
