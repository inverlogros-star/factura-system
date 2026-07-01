'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Upload, Trash2, FileText, Eye, CheckSquare, Square, Search, X, CalendarX2, FileDown, CalendarIcon, RefreshCw } from 'lucide-react'
import { parsearFacturaDIAN } from '@/lib/parser-dian'
import { storeFacturas, storeRecibos } from '@/lib/store'
import { generarInformeFacturasPDF } from '@/lib/informe-facturas-pdf'
import { fmtRecibo } from '@/lib/utils'
import type { Factura, ReciboMercancia } from '@/types'
import { toast } from 'sonner'
import DetalleFactura from '@/components/DetalleFactura'

const ESTADO_LABELS: Record<Factura['estado'], string> = {
  pendiente: 'Pendiente', conciliada: 'Conciliada',
  con_diferencias: 'Con diferencias', rechazada: 'Rechazada',
}
const ESTADO_VARIANT: Record<Factura['estado'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pendiente: 'secondary', conciliada: 'default',
  con_diferencias: 'destructive', rechazada: 'outline',
}

const TIPO_LABEL: Record<string, string> = {
  factura: 'Factura', nota_credito: 'Nota Crédito',
  nota_debito: 'Nota Débito', otro: 'Otro doc.',
}
const TIPO_COLOR: Record<string, string> = {
  factura: 'bg-blue-100 text-blue-800',
  nota_credito: 'bg-orange-100 text-orange-800',
  nota_debito: 'bg-purple-100 text-purple-800',
  otro: 'bg-gray-100 text-gray-600',
}

function hoy() { return new Date().toISOString().slice(0, 10) }
function primerDiaMes() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }

export default function FacturasPage() {
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [recibos, setRecibos] = useState<ReciboMercancia[]>([])
  const [cargando, setCargando] = useState(false)
  const [seleccionada, setSeleccionada] = useState<Factura | null>(null)
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [busqueda, setBusqueda] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  // Modal de eliminación por rango de fechas
  const [modalBorrarRango, setModalBorrarRango] = useState(false)
  const [borrarDesde, setBorrarDesde] = useState('')
  const [borrarHasta, setBorrarHasta] = useState('')
  const [borrando, setBorrando] = useState(false)
  // Informe de facturas/notas por rango de fechas
  const [informeDesde, setInformeDesde] = useState(primerDiaMes())
  const [informeHasta, setInformeHasta] = useState(hoy())
  const [generandoInforme, setGenerandoInforme] = useState(false)
  const [reprocesando, setReprocesando] = useState(false)

  const recargar = async () => {
    const [fs, rs] = await Promise.all([storeFacturas.getAll(), storeRecibos.getAll()])
    setFacturas(fs); setRecibos(rs); setMarcadas(new Set())
  }
  useEffect(() => { recargar() }, [])

  const facturasInforme = useMemo(() => {
    return facturas
      .filter(f => {
        const fecha = (f.fecha || '').slice(0, 10)
        return fecha >= informeDesde && fecha <= informeHasta
      })
      .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
  }, [facturas, informeDesde, informeHasta])
  const totalInforme = facturasInforme.reduce((s, f) => s + Number(f.total || 0), 0)

  async function descargarInformePDF() {
    if (facturasInforme.length === 0) { toast.error('No hay documentos en el rango seleccionado'); return }
    setGenerandoInforme(true)
    try {
      await generarInformeFacturasPDF(facturasInforme, recibos, informeDesde, informeHasta)
      toast.success(`Informe generado: ${facturasInforme.length} documento(s)`)
    } catch (e) { toast.error(`Error generando PDF: ${(e as Error).message}`) }
    finally { setGenerandoInforme(false) }
  }

  function toggleMarca(id: string) {
    setMarcadas(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleTodas() {
    setMarcadas(marcadas.size === facturas.length ? new Set() : new Set(facturas.map(f => f.id)))
  }

  async function handleArchivos(files: FileList | null) {
    if (!files || files.length === 0) return
    setCargando(true)
    let importadas = 0
    for (const file of Array.from(files)) {
      if (!file.name.endsWith('.xml')) { toast.error(`${file.name} no es XML`); continue }
      try {
        const datos = await parsearFacturaDIAN(await file.text())
        await storeFacturas.save({
          id: `f-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          ...datos, estado: 'pendiente', creadoEn: new Date().toISOString(),
        })
        importadas++
      } catch (err) { toast.error(`Error en ${file.name}: ${(err as Error).message}`) }
    }
    await recargar(); setCargando(false)
    if (importadas > 0) toast.success(`${importadas} factura(s) importada(s)`)
  }

  async function eliminarMarcadas() {
    if (marcadas.size === 0) return
    for (const id of marcadas) await storeFacturas.delete(id)
    toast.success(`${marcadas.size} factura(s) eliminada(s)`)
    await recargar()
  }

  async function reprocesarVacias() {
    setReprocesando(true)
    try {
      const res = await fetch('/api/facturas/reprocesar', { method: 'POST' })
      const data = await res.json()
      if (data.error) { toast.error(data.error); return }
      if (data.procesados === 0) {
        toast.info(data.mensaje || 'No hay facturas pendientes de reprocesar')
      } else {
        toast.success(`${data.procesados} de ${data.total} factura(s) reprocesadas correctamente`)
      }
      await recargar()
    } catch { toast.error('Error al reprocesar') }
    finally { setReprocesando(false) }
  }

  async function eliminarPorRango() {
    if (!borrarDesde || !borrarHasta) { toast.error('Selecciona ambas fechas'); return }
    if (borrarDesde > borrarHasta) { toast.error('Fecha inicial no puede ser mayor a la final'); return }
    setBorrando(true)
    try {
      const res = await fetch('/api/facturas/eliminar-rango', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ desde: borrarDesde, hasta: borrarHasta }),
      })
      const data = await res.json()
      if (data.error) { toast.error(data.error); return }
      toast.success(`${data.eliminados} factura(s) eliminada(s) del ${borrarDesde} al ${borrarHasta}`)
      setModalBorrarRango(false)
      setBorrarDesde(''); setBorrarHasta('')
      await recargar()
    } catch { toast.error('Error al eliminar') }
    finally { setBorrando(false) }
  }

  const facturasFiltradas = facturas.filter(f => {
    const tipoOk = filtroTipo === 'todos' || (f.tipoDocumento || 'factura') === filtroTipo
    const q = busqueda.trim().toLowerCase()
    const busquedaOk = !q ||
      f.numeroFactura.toLowerCase().includes(q) ||
      (f.proveedor || '').toLowerCase().includes(q) ||
      (f.nitProveedor || '').replace(/[.\-\s]/g, '').includes(q.replace(/[.\-\s]/g, ''))
    return tipoOk && busquedaOk
  })
  const todasMarcadas = facturasFiltradas.length > 0 && facturasFiltradas.every(f => marcadas.has(f.id))

  const conteos = facturas.reduce((acc, f) => {
    const t = f.tipoDocumento || 'factura'
    acc[t] = (acc[t] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 p-6 shadow-lg flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-white drop-shadow-sm">Facturas Electrónicas</h1>
          <p className="text-blue-100 text-sm mt-1">Importa XML DIAN para conciliar con recibos</p>
        </div>
        <div className="flex gap-2">
          {marcadas.size > 0 && (
            <Button variant="destructive" onClick={eliminarMarcadas}>
              <Trash2 size={15} className="mr-1.5" />
              Eliminar ({marcadas.size})
            </Button>
          )}
          <Button
            variant="outline"
            onClick={reprocesarVacias}
            disabled={reprocesando}
            className="border-yellow-400 text-yellow-700 hover:bg-yellow-50 bg-white"
            title="Reprocesa facturas que quedaron con datos vacíos (total=$0 o sin proveedor)"
          >
            <RefreshCw size={15} className={`mr-1.5 ${reprocesando ? 'animate-spin' : ''}`} />
            {reprocesando ? 'Reprocesando...' : 'Reprocesar vacías'}
          </Button>
          <Button
            variant="outline"
            onClick={() => setModalBorrarRango(true)}
            className="border-red-300 text-red-600 hover:bg-red-50"
          >
            <CalendarX2 size={16} className="mr-2" /> Eliminar por fechas
          </Button>
          <Button onClick={() => inputRef.current?.click()} disabled={cargando}>
            <Upload size={16} className="mr-2" />
            {cargando ? 'Importando...' : 'Subir XML'}
          </Button>
        </div>
        <input ref={inputRef} type="file" accept=".xml" multiple className="hidden"
          onChange={e => handleArchivos(e.target.files)} />
      </div>

      {/* Filtros por tipo */}
      <div className="flex gap-2 flex-wrap">
        {[['todos', 'Todos', facturas.length], ...Object.entries(conteos).map(([k, v]) => [k, TIPO_LABEL[k] || k, v])].map(([tipo, label, count]) => (
          <button key={tipo as string}
            onClick={() => setFiltroTipo(tipo as string)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filtroTipo === tipo ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
            {label as string} ({count as number})
          </button>
        ))}
      </div>

      {/* ── Informe de Facturas, Notas Crédito y Débito por Rango de Fechas (PDF) ── */}
      <Card className="border-blue-200 bg-blue-50/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileDown size={18} className="text-blue-600" />
            Informe de Facturas, Notas Crédito y Débito (PDF)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                <CalendarIcon size={12} /> Fecha inicial
              </label>
              <input
                type="date"
                value={informeDesde}
                onChange={e => setInformeDesde(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white cursor-pointer"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                <CalendarIcon size={12} /> Fecha final
              </label>
              <input
                type="date"
                value={informeHasta}
                onChange={e => setInformeHasta(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white cursor-pointer"
              />
            </div>
            <div className="text-sm text-gray-600">
              <span className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full font-medium">
                {facturasInforme.length} documento(s) · ${totalInforme.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
            <Button
              onClick={descargarInformePDF}
              disabled={generandoInforme}
              className="bg-blue-700 hover:bg-blue-800"
            >
              <FileDown size={16} className="mr-2" />
              {generandoInforme ? 'Generando...' : 'Generar PDF'}
            </Button>
          </div>

          {/* Vista previa */}
          {facturasInforme.length > 0 && (
            <div className="mt-4 border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-blue-100 text-blue-800 sticky top-0">
                  <tr>
                    {['Fecha', 'Tipo', 'No. Factura/Nota', 'No. Recibo', 'Proveedor', 'NIT Proveedor', 'Valor Total'].map(h => (
                      <th key={h} className="text-left px-3 py-2 font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {facturasInforme.map(f => {
                    const recibo = f.reciboAsociadoId ? recibos.find(r => r.id === f.reciboAsociadoId) : undefined
                    return (
                      <tr key={f.id} className="hover:bg-blue-50">
                        <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{f.fecha || '—'}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TIPO_COLOR[f.tipoDocumento || 'factura']}`}>
                            {TIPO_LABEL[f.tipoDocumento || 'factura']}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 font-mono font-semibold whitespace-nowrap">{f.numeroFactura}</td>
                        <td className="px-3 py-1.5 font-mono whitespace-nowrap">{recibo ? fmtRecibo(recibo.numeroRecibo) : '—'}</td>
                        <td className="px-3 py-1.5">{f.proveedor || '—'}</td>
                        <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{f.nitProveedor || '—'}</td>
                        <td className="px-3 py-1.5 font-semibold text-right whitespace-nowrap">
                          ${Number(f.total || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

      {facturasFiltradas.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No hay facturas cargadas.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="text-base">
                {facturasFiltradas.length} documento(s)
                {marcadas.size > 0 && <span className="ml-2 text-sm font-normal text-blue-600">— {marcadas.size} seleccionado(s)</span>}
                {busqueda && <span className="ml-2 text-sm font-normal text-gray-400">de {facturas.length} total</span>}
              </CardTitle>
              {/* Barra de búsqueda dentro del card */}
              <div className="relative min-w-[280px]">
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
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <button onClick={toggleTodas} className="text-blue-600">
                      {todasMarcadas ? <CheckSquare size={18} /> : <Square size={18} className="text-gray-400" />}
                    </button>
                  </th>
                  {['No. Documento','Tipo','Proveedor','NIT','Fecha','Total','Estado','Correo origen',''].map(h => (
                    <th key={h} className="text-left px-3 py-3 font-medium text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {facturasFiltradas.map(f => (
                  <tr key={f.id} className={`transition-colors cursor-pointer ${marcadas.has(f.id) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    onClick={() => toggleMarca(f.id)}>
                    <td className="px-4 py-3" onClick={e => { e.stopPropagation(); toggleMarca(f.id) }}>
                      {marcadas.has(f.id)
                        ? <CheckSquare size={18} className="text-blue-600" />
                        : <Square size={18} className="text-gray-300" />}
                    </td>
                    <td className="px-3 py-3 font-mono font-medium">{f.numeroFactura}</td>
                    <td className="px-3 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TIPO_COLOR[f.tipoDocumento || 'factura']}`}>
                        {TIPO_LABEL[f.tipoDocumento || 'factura']}
                      </span>
                    </td>
                    <td className="px-3 py-3">{f.proveedor || '—'}</td>
                    <td className="px-3 py-3 text-gray-500">{f.nitProveedor || '—'}</td>
                    <td className="px-3 py-3 text-gray-500">{f.fecha}</td>
                    <td className="px-3 py-3 font-medium">${Number(f.total).toLocaleString('es-CO')}</td>
                    <td className="px-3 py-3">
                      <Badge variant={ESTADO_VARIANT[f.estado]}>{ESTADO_LABELS[f.estado]}</Badge>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500">
                      {f.correoOrigen
                        ? <span className="bg-gray-100 px-2 py-0.5 rounded-full">{f.correoOrigen}</span>
                        : '—'}
                    </td>
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setSeleccionada(f)}><Eye size={14} /></Button>
                        <Button size="sm" variant="ghost" onClick={async () => { await storeFacturas.delete(f.id); await recargar(); toast.success('Eliminada') }}>
                          <Trash2 size={14} className="text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
      {seleccionada && <DetalleFactura factura={seleccionada} onClose={() => setSeleccionada(null)} />}

      {/* ── Modal de eliminación por rango de fechas ── */}
      {modalBorrarRango && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4">
            {/* Encabezado */}
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-red-100 rounded-full">
                <CalendarX2 size={24} className="text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Eliminar Facturas por Fechas</h2>
                <p className="text-sm text-gray-500">Se eliminarán TODAS las facturas del rango seleccionado</p>
              </div>
            </div>

            {/* Calendarios */}
            <div className="space-y-4 mb-6">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  Fecha inicial
                </label>
                <input
                  type="date"
                  value={borrarDesde}
                  onChange={e => setBorrarDesde(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-red-400 bg-white cursor-pointer font-medium"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  Fecha final
                </label>
                <input
                  type="date"
                  value={borrarHasta}
                  onChange={e => setBorrarHasta(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-red-400 bg-white cursor-pointer font-medium"
                />
              </div>
            </div>

            {/* Resumen */}
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
              <p className="text-sm text-red-700 font-medium">
                ⚠️ Se eliminarán todas las facturas del <strong>{borrarDesde || '…'}</strong> al <strong>{borrarHasta || '…'}</strong>
              </p>
              <p className="text-xs text-red-500 mt-1">Esta acción no se puede deshacer.</p>
            </div>

            {/* Botones */}
            <div className="flex gap-3">
              <button
                onClick={() => setModalBorrarRango(false)}
                disabled={borrando}
                className="flex-1 px-4 py-2.5 rounded-lg border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={eliminarPorRango}
                disabled={borrando}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {borrando ? 'Eliminando...' : 'Eliminar facturas'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
