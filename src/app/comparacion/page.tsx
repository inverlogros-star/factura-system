'use client'
import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GitCompareArrows, ChevronDown, ChevronUp, FileDown, Trash2, CheckSquare, Square, Eye, AlertTriangle, CheckCircle2, Search, FileWarning, X } from 'lucide-react'
import { fmtRecibo } from '@/lib/utils'
import { storeFacturas, storeRecibos, storeComparaciones } from '@/lib/store'
import { compararFacturaConRecibo, encontrarReciboPorFactura, ultimos4Digitos } from '@/lib/comparador'
import { generarInformePDF } from '@/lib/informe-pdf'
import type { Factura, ReciboMercancia, ResultadoComparacion, TipoDiferencia } from '@/types'
import { toast } from 'sonner'

function fmt(n: number) {
  return Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

const TIPO_LABEL: Record<TipoDiferencia, string> = {
  cantidad: 'Cantidad', precio: 'Precio',
  codigo_producto: 'Código', presentacion: 'Presentación',
  producto_no_encontrado: 'No encontrado',
}
const TIPO_COLOR: Record<TipoDiferencia, string> = {
  cantidad: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  precio: 'bg-orange-50 border-orange-200 text-orange-800',
  codigo_producto: 'bg-blue-50 border-blue-200 text-blue-800',
  presentacion: 'bg-purple-50 border-purple-200 text-purple-800',
  producto_no_encontrado: 'bg-red-50 border-red-200 text-red-800',
}
const ESTADO_COLOR: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-800',
  conciliada: 'bg-green-100 text-green-800',
  con_diferencias: 'bg-red-100 text-red-800',
  rechazada: 'bg-gray-100 text-gray-500',
}

// Panel de diferencias detalladas
function PanelDiferencias({ resultado, factura, recibo, onClose, onEliminar }: {
  resultado: ResultadoComparacion
  factura: Factura
  recibo?: ReciboMercancia
  onClose: () => void
  onEliminar: () => void
}) {
  async function descargarPDF() {
    try {
      // Buscar el recibo asociado para incluir su fecha en el informe
      const recibosStore = await import('@/lib/store').then(m => m.storeRecibos.getAll())
      const reciboAsociado = recibosStore.find((r: any) => r.id === resultado.reciboId)
      await generarInformePDF(resultado, factura, reciboAsociado)
      toast.success('PDF generado')
    } catch (e) { toast.error(`Error: ${(e as Error).message}`) }
  }

  async function descargarNotaAjuste() {
    if (!resultado.notaAjuste) return
    try {
      const { generarNotaAjustePDF } = await import('@/lib/nota-ajuste-pdf')
      await generarNotaAjustePDF(resultado.notaAjuste)
      toast.success('Nota de Ajuste generada')
    } catch (e) { toast.error(`Error: ${(e as Error).message}`) }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between px-8 py-4 border-b bg-white shrink-0">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Comparación: {resultado.numeroFactura} ↔ Recibo {fmtRecibo(resultado.numeroRecibo)}
          </h2>
          <p className="text-sm text-gray-500">{resultado.proveedor}</p>
        </div>
        <div className="flex items-center gap-3">
          {resultado.tieneDiferencias
            ? <Badge variant="destructive">{resultado.diferencias.length} diferencia(s)</Badge>
            : <Badge className="bg-green-100 text-green-800">Sin diferencias ✓</Badge>}
          <Button variant="outline" onClick={descargarPDF}><FileDown size={15} className="mr-1.5" /> PDF</Button>
          {resultado.notaAjuste && (
            <Button variant="outline" onClick={descargarNotaAjuste} className="border-orange-300 text-orange-700 hover:bg-orange-50">
              <FileWarning size={15} className="mr-1.5" /> Nota de Ajuste
            </Button>
          )}
          <Button variant="ghost" onClick={onEliminar}><Trash2 size={15} className="text-red-500" /></Button>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">✕</button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8 bg-gray-50 space-y-6">
        {/* Resumen numérico — el recibo siempre se redondea al peso */}
        {(() => {
          const totalFactura = Number(resultado.valorTotalFactura)
          const totalRecibo  = Math.round(Number(resultado.valorTotalRecibo))  // redondear al peso
          const diferencia   = totalFactura - totalRecibo
          return (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">Total Factura (con IVA)</p>
            <p className="text-2xl font-bold text-blue-700">${fmt(totalFactura)}</p>
          </div>
          <div className="bg-white rounded-lg border p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">Total Recibo (redondeado)</p>
            <p className="text-2xl font-bold text-green-700">${fmt(totalRecibo)}</p>
          </div>
          <div className={`rounded-lg border p-4 text-center ${Math.abs(diferencia) < 1 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <p className="text-xs text-gray-500 mb-1">Diferencia</p>
            <p className={`text-2xl font-bold ${Math.abs(diferencia) < 1 ? 'text-green-700' : 'text-red-700'}`}>
              ${fmt(diferencia)}
            </p>
          </div>
        </div>
          )
        })()}

        {/* ── CUADRO COMPARATIVO DE IMPUESTOS ── */}
        {factura.productos.length > 0 && (() => {
          // Calcular impuestos de la FACTURA agrupados por tasa
          const impFact: Record<string, {base:number; iva:number}> = {}
          let impFact0 = 0, impFact5 = 0, impFact19 = 0
          let baseFact0 = 0, baseFact5 = 0, baseFact19 = 0
          let iconsumoFact = 0, ibuaFact = 0, icuiFact = 0
          for (const p of factura.productos) {
            const ivaV  = (p as any).ivaValor ?? p.impuesto
            let tasa = (p as any).tasaIva ?? 0
            if (tasa === 0 && ivaV > 0 && p.subtotal > 0) {
              const c = Math.round((ivaV / p.subtotal) * 100)
              if (c >= 4 && c <= 6) tasa = 5
              else if (c >= 17 && c <= 21) tasa = 19
            }
            if (tasa === 5)       { baseFact5  += p.subtotal; impFact5  += ivaV }
            else if (tasa === 19) { baseFact19 += p.subtotal; impFact19 += ivaV }
            else                  { baseFact0  += p.subtotal }
            iconsumoFact += (p as any).iconsumo || 0
            ibuaFact     += (p as any).ibua     || 0
            icuiFact     += (p as any).icui     || 0
          }

          // Impuestos del RECIBO — prioridad: totales del encabezado (Ent_Iva) > suma productos
          const t    = recibo?.totales
          const prods = recibo?.productos ?? []
          // SIEMPRE usar totales del header — son los valores reales de la BD
          const ivaRec      = Math.round(t?.iva      ?? prods.reduce((s: number, p: any) => s + (Number(p.iva)      || 0), 0))
          const iconsumoRec = Math.round(t?.iconsumo ?? prods.reduce((s: number, p: any) => s + (Number(p.iconsumo) || 0), 0))
          const ibuaRec     = Math.round(t?.ibua     ?? prods.reduce((s: number, p: any) => s + (Number(p.ibua)     || 0), 0))
          const icuiRec     = Math.round(t?.icui     ?? prods.reduce((s: number, p: any) => s + (Number(p.icui)     || 0), 0))
          const totalReciboReal = Math.round(t?.neto ?? Number(resultado.valorTotalRecibo))
          const necesitaReimportar = ivaRec === 0 && prods.length > 0 && !recibo
          const totalIvaFact  = Math.round(impFact5 + impFact19)
          const totalIvaRec   = ivaRec
          const difIva        = totalIvaFact - totalIvaRec
          const difIconsumo   = Math.round(iconsumoFact) - iconsumoRec
          const difIbua       = Math.round(ibuaFact) - ibuaRec
          const difIcui       = Math.round(icuiFact) - icuiRec

          const totalFact = Math.round(Number(factura.total))
          const totalRec  = totalReciboReal
          // Recibo no tiene IVA por tasa — solo total IVA
          // Para bases del recibo, usar proporcional si hay total IVA
          const base5Rec  = ivaRec > 0 && impFact5 > 0  ? Math.round(ivaRec * (impFact5  / (impFact5 + impFact19 || 1)) / 0.05)  : 0
          const base19Rec = ivaRec > 0 && impFact19 > 0 ? Math.round(ivaRec * (impFact19 / (impFact5 + impFact19 || 1)) / 0.19) : 0

          const filas = [
            { cuenta: '14351015', concepto: 'Base gravable IVA 5%',  factura: Math.round(baseFact5),  recibo: base5Rec  || (0 as string|number), dif: Math.round(baseFact5)  - (base5Rec  || 0), esBase: true  },
            { cuenta: '24081015', concepto: 'IVA 5%',                factura: Math.round(impFact5),   recibo: ivaRec > 0 ? Math.round(ivaRec * (impFact5 / (impFact5 + impFact19 || 1))) : 0, dif: Math.round(impFact5) - Math.round(ivaRec * (impFact5 / (impFact5 + impFact19 || 1))), esBase: false },
            { cuenta: '14351007', concepto: 'Base gravable IVA 19%', factura: Math.round(baseFact19), recibo: base19Rec || 0, dif: Math.round(baseFact19) - (base19Rec || 0), esBase: true  },
            { cuenta: '24081007', concepto: 'IVA 19%',               factura: Math.round(impFact19),  recibo: ivaRec > 0 ? Math.round(ivaRec * (impFact19 / (impFact5 + impFact19 || 1))) : 0, dif: Math.round(impFact19) - Math.round(ivaRec * (impFact19 / (impFact5 + impFact19 || 1))), esBase: false },
            { cuenta: '14351011', concepto: 'Base Impoconsumo',      factura: Math.round(iconsumoFact), recibo: iconsumoRec, dif: Math.round(iconsumoFact) - iconsumoRec, esBase: false },
            { cuenta: '14351012', concepto: 'Base IBUA',             factura: Math.round(ibuaFact),   recibo: ibuaRec,     dif: Math.round(ibuaFact) - ibuaRec,     esBase: false },
            { cuenta: '14351013', concepto: 'Base ICUI',             factura: Math.round(icuiFact),   recibo: icuiRec,     dif: Math.round(icuiFact) - icuiRec,     esBase: false },
            { cuenta: '240803',   concepto: 'Total IVA',             factura: totalIvaFact,           recibo: ivaRec,      dif: totalIvaFact - ivaRec,              esBase: false },
            { cuenta: '220505',   concepto: 'TOTAL A PAGAR',         factura: totalFact,              recibo: totalRec,    dif: totalFact - totalRec,               esBase: false },
          ]

          return (
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
                <h3 className="font-semibold text-indigo-800 text-sm">Cuadro Comparativo de Impuestos — Factura vs Recibo</h3>
                {necesitaReimportar
                  ? <span className="text-xs text-orange-600 font-semibold bg-orange-100 px-2 py-1 rounded">⚠️ Recibo sin detalle IVA — reimportar desde Recibos</span>
                  : <span className="text-xs text-indigo-500">Para corrección de cuentas contables</span>}
              </div>
              <table className="w-full text-xs">
                <thead className="bg-indigo-700 text-white">
                  <tr>
                    <th className="px-3 py-2 text-left">Cta. Contable</th>
                    <th className="px-3 py-2 text-left">Concepto</th>
                    <th className="px-3 py-2 text-right">Factura</th>
                    <th className="px-3 py-2 text-right">Recibo</th>
                    <th className="px-3 py-2 text-right">Diferencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filas.map((f, i) => {
                    const dif = typeof f.dif === 'number' ? f.dif : null
                    const hasDif = dif !== null && Math.abs(dif) >= 1
                    return (
                      <tr key={i} className={f.cuenta === '220505' ? 'bg-blue-600 text-white font-bold' : f.esBase ? 'bg-gray-50 text-gray-500 italic' : hasDif ? 'bg-red-50' : 'bg-white'}>
                        <td className="px-3 py-2 font-mono text-gray-500">{f.cuenta}</td>
                        <td className="px-3 py-2 font-medium">{f.concepto}</td>
                        <td className="px-3 py-2 text-right text-blue-700">${typeof f.factura === 'number' ? fmt(f.factura) : f.factura}</td>
                        <td className="px-3 py-2 text-right text-green-700">{typeof f.recibo === 'number' ? `$${fmt(f.recibo)}` : f.recibo}</td>
                        <td className={`px-3 py-2 text-right font-bold ${hasDif ? 'text-red-600' : 'text-emerald-600'}`}>
                          {dif !== null ? (Math.abs(dif) < 1 ? '$0' : `${dif > 0 ? '+' : ''}$${fmt(dif)}`) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })()}

        {/* Diferencias por producto */}
        {resultado.diferencias.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
            <CheckCircle2 size={48} className="mx-auto text-green-500 mb-3" />
            <p className="text-green-700 font-semibold text-lg">Sin diferencias — documentos conciliados</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-700">Diferencias por producto ({resultado.diferencias.length})</h3>
            {resultado.diferencias.map((d, i) => (
              <div key={i} className={`border rounded-lg p-4 ${TIPO_COLOR[d.tipoDiferencia]}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm">{TIPO_LABEL[d.tipoDiferencia]}</span>
                    <span className="font-medium">{d.descripcion}</span>
                  </div>
                  {d.valorDiferenciaTotal !== undefined && (
                    <span className="font-bold">Δ ${fmt(d.valorDiferenciaTotal)}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs opacity-80 mb-2">
                  {d.codigoRecibo && <span>Cód. recibo: <code className="bg-white/50 px-1">{d.codigoRecibo}</code></span>}
                  {d.codigoFactura && <span>Cód. factura: <code className="bg-white/50 px-1">{d.codigoFactura}</code></span>}
                  {d.cantidadRecibida !== undefined && <span>Cant. recibida: <b>{d.cantidadRecibida}</b></span>}
                  {d.cantidadFacturada !== undefined && <span>Cant. facturada: <b>{d.cantidadFacturada}</b></span>}
                  {d.precioRecibo !== undefined && <span>Precio recibo: ${fmt(d.precioRecibo)}</span>}
                  {d.precioFactura !== undefined && <span>Precio factura: ${fmt(d.precioFactura)}</span>}
                </div>
                <div className="bg-white/60 rounded p-2 text-xs border border-current/20">
                  <span className="font-semibold">Nota: </span>{d.nota}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ComparacionPage() {
  const [facturas, setFacturas]       = useState<Factura[]>([])
  const [recibos, setRecibos]         = useState<ReciboMercancia[]>([])
  const [resultados, setResultados]   = useState<ResultadoComparacion[]>([])
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set())
  const [procesando, setProcesando]   = useState(false)
  const [facturasMap, setFacturasMap] = useState<Record<string, Factura>>({})
  const [busqueda, setBusqueda]       = useState('')
  // Fechas por defecto: primer día del mes actual → hoy
  const hoyStr = () => new Date().toISOString().slice(0, 10)
  const primerDiaMes = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }
  const [fechaDesde, setFechaDesde]   = useState(primerDiaMes)
  const [fechaHasta, setFechaHasta]   = useState(hoyStr)
  const [panelAbierto, setPanelAbierto] = useState<ResultadoComparacion | null>(null)
  const [reciboDelPanel, setReciboDelPanel] = useState<ReciboMercancia | undefined>(undefined)

  const recargar = async () => {
    const [fs, rs, cs] = await Promise.all([storeFacturas.getAll(), storeRecibos.getAll(), storeComparaciones.getAll()])
    setFacturas(fs); setRecibos(rs); setResultados(cs)
    setFacturasMap(Object.fromEntries(fs.map(f => [f.id, f])))
    return rs  // devolver recibos para uso inmediato
  }
  useEffect(() => { recargar() }, [])

  // Cargar recibo fresco desde la BD y pasarlo directamente al panel
  const abrirPanel = async (resultado: ResultadoComparacion) => {
    // Obtener recibos frescos de la BD (no del estado en memoria)
    const recibosActualizados = await storeRecibos.getAll()
    setRecibos(recibosActualizados)
    const recibo = recibosActualizados.find((r: ReciboMercancia) => r.id === resultado.reciboId)
    setReciboDelPanel(recibo)
    setPanelAbierto(resultado)
  }

  function toggleFactura(id: string) {
    setSeleccionadas(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleTodas() {
    const pendientes = facturasFiltradas.filter(f => f.estado === 'pendiente')
    const idsPendientes = new Set(pendientes.map(f => f.id))
    const todasMarcadas = pendientes.every(f => seleccionadas.has(f.id))
    setSeleccionadas(todasMarcadas ? new Set() : idsPendientes)
  }

  async function compararSeleccionadas() {
    if (seleccionadas.size === 0) { toast.error('Selecciona al menos una factura'); return }
    setProcesando(true)
    let procesadas = 0, sinRecibo = 0
    for (const id of seleccionadas) {
      const factura = facturas.find(f => f.id === id)
      if (!factura) continue
      const recibo = encontrarReciboPorFactura(factura, recibos)
      if (!recibo) { sinRecibo++; continue }
      // Buscar notas crédito del mismo proveedor
      const notasCredito = facturas.filter(f =>
        f.tipoDocumento === 'nota_credito' &&
        (f.nitProveedor === factura.nitProveedor ||
         f.proveedor?.toLowerCase() === factura.proveedor?.toLowerCase())
      )
      const resultado = compararFacturaConRecibo(factura, recibo, notasCredito)
      await storeComparaciones.save(resultado)
      await storeFacturas.save({ ...factura, estado: resultado.tieneDiferencias ? 'con_diferencias' : 'conciliada', reciboAsociadoId: recibo.id })
      procesadas++
    }
    await recargar(); setSeleccionadas(new Set()); setProcesando(false)
    if (procesadas > 0) toast.success(`${procesadas} factura(s) comparada(s)`)
    if (sinRecibo > 0) toast.warning(`${sinRecibo} sin recibo asociado`)
  }

  async function compararTodo() {
    // Comparar solo facturas (no notas crédito POS) que tengan recibo detectado
    const pendientes = facturas.filter(f =>
      f.estado === 'pendiente' &&
      f.tipoDocumento !== 'nota_credito' &&  // excluir notas crédito
      !!encontrarReciboPorFactura(f, recibos)
    )
    if (pendientes.length === 0) { toast.info('No hay facturas pendientes con recibo para comparar'); return }
    setProcesando(true)
    let procesadas = 0
    for (const factura of pendientes) {
      const recibo = encontrarReciboPorFactura(factura, recibos)
      if (!recibo) continue
      const notasCredito = facturas.filter(f =>
        f.tipoDocumento === 'nota_credito' &&
        (f.nitProveedor === factura.nitProveedor || f.proveedor?.toLowerCase() === factura.proveedor?.toLowerCase())
      )
      const resultado = compararFacturaConRecibo(factura, recibo, notasCredito)
      await storeComparaciones.save(resultado)
      await storeFacturas.save({
        ...factura,
        estado: resultado.tieneDiferencias ? 'con_diferencias' : 'conciliada',
        reciboAsociadoId: recibo.id,
      })
      procesadas++
    }
    await recargar()
    setSeleccionadas(new Set())
    setProcesando(false)
    toast.success(`${procesadas} facturas comparadas automáticamente`)
  }

  async function eliminarComparacion(comparacionId: string, facturaId: string) {
    await storeComparaciones.delete(comparacionId)
    const factura = facturasMap[facturaId]
    if (factura) await storeFacturas.save({ ...factura, estado: 'pendiente', reciboAsociadoId: undefined })
    await recargar(); setPanelAbierto(null)
    toast.success('Comparación eliminada — factura vuelve a Pendiente')
  }

  // Filtrar y separar facturas con/sin recibo
  const facturasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return facturas.filter(f => {
      if (f.tipoDocumento === 'nota_credito' || f.tipoDocumento === 'nota_debito') return false

      // Filtrar por fecha del RECIBO DE MERCANCÍA (no de la factura)
      if (fechaDesde || fechaHasta) {
        const recibo = encontrarReciboPorFactura(f, recibos)
        const fechaRecibo = recibo?.fecha || ''
        if (!fechaRecibo) return false   // sin recibo = no aplica en el rango
        if (fechaDesde && fechaRecibo < fechaDesde) return false
        if (fechaHasta && fechaRecibo > fechaHasta) return false
      }

      if (!q) return true
      const nitNorm = (f.nitProveedor || '').replace(/[.\-\s]/g, '')
      const qNorm = q.replace(/[.\-\s]/g, '')
      return f.numeroFactura.toLowerCase().includes(q) ||
        (f.proveedor || '').toLowerCase().includes(q) ||
        nitNorm.includes(qNorm)
    })
  }, [facturas, recibos, busqueda, fechaDesde, fechaHasta])

  const conRecibo    = facturasFiltradas.filter(f => encontrarReciboPorFactura(f, recibos))
  const sinRecibo    = facturasFiltradas.filter(f => !encontrarReciboPorFactura(f, recibos))
  const yaComparadas = resultados.length

  // Mapa de resultados por facturaId para acceso rápido
  const resultadosPorFactura = useMemo(() =>
    Object.fromEntries(resultados.map(r => [r.facturaId, r])), [resultados])

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comparación de Documentos</h1>
          <p className="text-gray-500 text-sm mt-1">
            Coteja facturas DIAN con recibos de mercancía usando los últimos 4 dígitos
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {/* Comparar todo en un clic */}
          <Button
            onClick={compararTodo}
            disabled={procesando}
            className="bg-emerald-700 hover:bg-emerald-800"
          >
            <GitCompareArrows size={15} className="mr-1.5" />
            {procesando ? 'Comparando...' : 'Comparar Todo'}
          </Button>
          {seleccionadas.size > 0 && (
            <Button onClick={compararSeleccionadas} disabled={procesando} variant="outline">
              <GitCompareArrows size={15} className="mr-1.5" />
              {procesando ? '...' : `Comparar selec. (${seleccionadas.size})`}
            </Button>
          )}
        </div>
      </div>

      {/* ── SELECTOR DE FECHAS — primer elemento visible ── */}
      <Card className="border-blue-200 bg-blue-50/40">
        <CardContent className="p-5">
          <p className="text-xs text-blue-600 font-semibold mb-3">📦 Filtro por fecha del Recibo de Mercancía</p>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-blue-700 flex items-center gap-1.5">
                <CalendarIcon size={13} /> Fecha recibo inicial
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={e => setFechaDesde(e.target.value)}
                  className="border-2 border-blue-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 bg-white cursor-pointer font-medium min-w-[150px]"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-blue-700 flex items-center gap-1.5">
                <CalendarIcon size={13} /> Fecha recibo final
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={e => setFechaHasta(e.target.value)}
                  className="border-2 border-blue-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 bg-white cursor-pointer font-medium min-w-[150px]"
                />
              </div>
            </div>
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-bold text-blue-700">Buscar proveedor o NIT</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Nombre o NIT..."
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  className="w-full pl-8 pr-7 py-2.5 border-2 border-blue-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 bg-white"
                />
                {busqueda && (
                  <button onClick={() => setBusqueda('')} className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
            <div className="text-center">
              <p className="text-xs text-blue-500 font-semibold mb-1">Mostrando</p>
              <span className="text-2xl font-bold text-blue-700">{facturasFiltradas.length}</span>
              <p className="text-xs text-blue-400">de {facturas.filter(f => f.tipoDocumento !== 'nota_credito' && f.tipoDocumento !== 'nota_debito').length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen estadístico */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total facturas',  value: facturas.length,  color: 'text-gray-700' },
          { label: 'Con recibo',      value: conRecibo.length, color: 'text-green-700' },
          { label: 'Sin recibo',      value: sinRecibo.length, color: 'text-yellow-700' },
          { label: 'Comparadas',      value: yaComparadas,     color: 'text-blue-700' },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── TABLA PRINCIPAL: documentos a comparar ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">
              {facturasFiltradas.length} factura(s) — {fechaDesde || '…'} al {fechaHasta || '…'}
            </CardTitle>
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <CheckSquare size={11} className="text-blue-500" /> Marca pendientes y compara
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {facturasFiltradas.length === 0 ? (
            <p className="text-center text-gray-400 py-10 text-sm">No hay facturas. Ve a Facturas y sube archivos XML.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-sm" style={{ tableLayout: 'fixed', minWidth: '1220px', width: '100%' }}>
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th style={{ width: 32 }} className="px-2 py-2.5">
                      <button onClick={toggleTodas} className="text-blue-600">
                        {conRecibo.filter(f => seleccionadas.has(f.id)).length === conRecibo.filter(f => f.estado === 'pendiente').length && conRecibo.filter(f => f.estado === 'pendiente').length > 0
                          ? <CheckSquare size={17} /> : <Square size={17} className="text-gray-400" />}
                      </button>
                    </th>
                    {[
                      { h: 'No. Factura',       w: 130 },
                      { h: '4 díg.',            w: 55  },
                      { h: 'Proveedor',          w: 160 },
                      { h: 'Fecha',             w: 85  },
                      { h: 'T. Factura',        w: 100 },
                      { h: 'Estado',            w: 65  },
                      { h: 'Recibo / No.Fact.', w: 170 },
                      { h: 'T. Recibo',         w: 100 },
                      { h: 'T.Fact - T.Recibo', w: 110 },
                      { h: 'Res.',              w: 50  },
                      { h: '',                  w: 36  },
                    ].map(({ h, w }) => (
                      <th key={h} style={{ width: w }} className="text-left px-2 py-2.5 font-medium text-gray-600 whitespace-nowrap text-xs overflow-hidden text-ellipsis">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {facturasFiltradas.map(f => {
                    const recibo    = encontrarReciboPorFactura(f, recibos)
                    const checked   = seleccionadas.has(f.id)
                    const resultado = resultadosPorFactura[f.id]
                    const esNCPOS   = f.tipoDocumento === 'nota_credito'
                    const puedeSeleccionar = f.estado === 'pendiente' && !!recibo && !esNCPOS

                    return (
                      <tr key={f.id}
                        className={`transition-colors ${checked ? 'bg-blue-50' : 'hover:bg-gray-50'} ${puedeSeleccionar ? 'cursor-pointer' : ''}`}
                        onClick={() => puedeSeleccionar && toggleFactura(f.id)}>

                        {/* Checkbox */}
                        <td className="px-3 py-2 w-8">
                          {puedeSeleccionar
                            ? checked ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} className="text-gray-300" />
                            : <span className="w-4 h-4 block" />}
                        </td>
                        {/* No. Factura */}
                        <td className="px-2 py-2 font-mono font-semibold text-xs whitespace-nowrap">{f.numeroFactura}</td>
                        {/* 4 dígitos */}
                        <td className="px-2 py-2">
                          <span className="bg-blue-100 text-blue-800 font-bold font-mono px-1.5 py-0.5 rounded text-xs">
                            {ultimos4Digitos(f.numeroFactura)}
                          </span>
                        </td>
                        {/* Proveedor */}
                        <td className="px-2 py-2 text-xs text-gray-700 max-w-[140px]">
                          <span className="block truncate" title={f.proveedor}>{f.proveedor || '—'}</span>
                        </td>
                        {/* Fecha */}
                        <td className="px-2 py-2 text-xs text-gray-500 whitespace-nowrap">{f.fecha}</td>
                        {/* Total Factura */}
                        <td className="px-2 py-2 text-xs font-semibold whitespace-nowrap">${fmt(f.total)}</td>
                        {/* Estado */}
                        <td className="px-2 py-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${ESTADO_COLOR[f.estado]}`}>
                            {f.estado === 'con_diferencias' ? 'dif.' : f.estado === 'conciliada' ? 'OK' : f.estado === 'pendiente' ? 'pend.' : f.estado}
                          </span>
                        </td>
                        {/* Recibo asociado */}
                        <td className="px-2 py-2 text-xs whitespace-nowrap">
                          {esNCPOS
                            ? <span className="text-gray-400 italic">N.C. POS — no aplica</span>
                            : recibo
                            ? <span className="text-green-700 font-medium flex items-center gap-1">
                                <CheckCircle2 size={12} />
                                <span>{fmtRecibo(recibo.numeroRecibo)}</span>
                                {recibo.numeroFacturaProveedor && (
                                  <span className="bg-green-100 text-green-700 font-mono px-1 rounded">
                                    {recibo.numeroFacturaProveedor}
                                  </span>
                                )}
                              </span>
                            : <span className="text-gray-400 flex items-center gap-1"><AlertTriangle size={12} className="text-yellow-500" />Sin recibo</span>}
                        </td>
                        {/* Total Recibo */}
                        <td className="px-2 py-2 text-xs font-semibold whitespace-nowrap">
                          {recibo ? <span className="text-green-700">${fmt(recibo.total)}</span> : <span className="text-gray-300">—</span>}
                        </td>
                        {/* T.Factura - T.Recibo */}
                        <td className="px-2 py-2 text-xs font-bold whitespace-nowrap text-center">
                          {recibo ? (() => {
                            const dif = Math.round(Number(f.total)) - Math.round(Number(recibo.total))
                            if (Math.abs(dif) < 1)
                              return <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold">$0</span>
                            if (dif > 0)
                              return <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">+${fmt(dif)}</span>
                            return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">-${fmt(Math.abs(dif))}</span>
                          })() : <span className="text-gray-300">—</span>}
                        </td>
                        {/* Resultado */}
                        <td className="px-2 py-2 whitespace-nowrap">
                          {resultado
                            ? <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${resultado.tieneDiferencias ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {resultado.tieneDiferencias ? `${resultado.diferencias.length}d` : '✓'}
                              </span>
                            : null}
                        </td>
                        {/* Acción */}
                        <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                          {resultado && (
                            <button onClick={() => abrirPanel(resultado)}
                              className="p-1 rounded hover:bg-blue-100 text-blue-600 transition-colors">
                              <Eye size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Panel de diferencias */}
      {panelAbierto && (
        <PanelDiferencias
          resultado={panelAbierto}
          factura={facturasMap[panelAbierto.facturaId] ?? ({} as Factura)}
          recibo={reciboDelPanel ?? recibos.find(r => r.id === panelAbierto.reciboId)}
          onClose={() => { setPanelAbierto(null); setReciboDelPanel(undefined) }}
          onEliminar={() => eliminarComparacion(panelAbierto.id, panelAbierto.facturaId)}
        />
      )}
    </div>
  )
}
