'use client'
import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GitCompareArrows, ChevronDown, ChevronUp, FileDown, Trash2, CheckSquare, Square, Eye, AlertTriangle, CheckCircle2, Search, FileWarning, X } from 'lucide-react'
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
function PanelDiferencias({ resultado, factura, onClose, onEliminar }: {
  resultado: ResultadoComparacion
  factura: Factura
  onClose: () => void
  onEliminar: () => void
}) {
  async function descargarPDF() {
    try { await generarInformePDF(resultado, factura); toast.success('PDF generado') }
    catch (e) { toast.error(`Error: ${(e as Error).message}`) }
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
            Comparación: {resultado.numeroFactura} ↔ Recibo {resultado.numeroRecibo}
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
        {/* Resumen numérico */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">Total Factura (con IVA)</p>
            <p className="text-2xl font-bold text-blue-700">${fmt(resultado.valorTotalFactura)}</p>
          </div>
          <div className="bg-white rounded-lg border p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">Total Recibo</p>
            <p className="text-2xl font-bold text-green-700">${fmt(resultado.valorTotalRecibo)}</p>
          </div>
          <div className={`rounded-lg border p-4 text-center ${resultado.valorDiferenciaTotal === 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <p className="text-xs text-gray-500 mb-1">Diferencia</p>
            <p className={`text-2xl font-bold ${resultado.valorDiferenciaTotal === 0 ? 'text-green-700' : 'text-red-700'}`}>
              ${fmt(resultado.valorDiferenciaTotal)}
            </p>
          </div>
        </div>

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
  const [panelAbierto, setPanelAbierto] = useState<ResultadoComparacion | null>(null)

  const recargar = async () => {
    const [fs, rs, cs] = await Promise.all([storeFacturas.getAll(), storeRecibos.getAll(), storeComparaciones.getAll()])
    setFacturas(fs); setRecibos(rs); setResultados(cs)
    setFacturasMap(Object.fromEntries(fs.map(f => [f.id, f])))
  }
  useEffect(() => { recargar() }, [])

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
      if (!q) return true
      const nitNorm = (f.nitProveedor || '').replace(/[.\-\s]/g, '')
      const qNorm = q.replace(/[.\-\s]/g, '')
      return f.numeroFactura.toLowerCase().includes(q) ||
        (f.proveedor || '').toLowerCase().includes(q) ||
        nitNorm.includes(qNorm)
    })
  }, [facturas, busqueda])

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
        <div className="flex gap-2 items-center">
          {seleccionadas.size > 0 && (
            <Button onClick={compararSeleccionadas} disabled={procesando}>
              <GitCompareArrows size={15} className="mr-1.5" />
              {procesando ? 'Comparando...' : `Comparar (${seleccionadas.size})`}
            </Button>
          )}
        </div>
      </div>

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
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">
              Facturas cargadas ({facturasFiltradas.length})
              {busqueda && <span className="ml-2 text-sm font-normal text-gray-400">de {facturas.length} total</span>}
            </CardTitle>
            {/* Barra de búsqueda dentro del card */}
            <div className="relative min-w-[300px]">
              <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar proveedor, NIT o No. factura..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="w-full pl-8 pr-7 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-gray-50"
              />
              {busqueda && (
                <button onClick={() => setBusqueda('')} className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
            <CheckSquare size={11} className="text-blue-500" /> Marca las facturas pendientes con recibo detectado y haz clic en Comparar
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {facturasFiltradas.length === 0 ? (
            <p className="text-center text-gray-400 py-10 text-sm">No hay facturas. Ve a Facturas y sube archivos XML.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-sm" style={{ tableLayout: 'fixed', minWidth: '1100px', width: '100%' }}>
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
                    const puedeSeleccionar = f.estado === 'pendiente' && !!recibo

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
                          {recibo
                            ? <span className="text-green-700 font-medium flex items-center gap-1">
                                <CheckCircle2 size={12} />
                                <span>{recibo.numeroRecibo}</span>
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
                            <button onClick={() => setPanelAbierto(resultado)}
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
          onClose={() => setPanelAbierto(null)}
          onEliminar={() => eliminarComparacion(panelAbierto.id, panelAbierto.facturaId)}
        />
      )}
    </div>
  )
}
