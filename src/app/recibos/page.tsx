'use client'
import { useEffect, useRef, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, Trash2, PackageCheck, Eye, FileSpreadsheet, FileText, FileCode, Bug, CheckSquare, Square, Database, CalendarIcon, BarChart2, ChevronDown, ChevronUp, CalendarX2, FileDown } from 'lucide-react'
import { fmtRecibo } from '@/lib/utils'
import { parsearReciboXML } from '@/lib/parser-dian'
import { parsearReciboExcel } from '@/lib/parser-recibo-excel'
import { parsearReciboPDF } from '@/lib/parser-recibo-pdf'
import { storeRecibos } from '@/lib/store'
import { generarInformeRecibosPDF } from '@/lib/informe-recibos-pdf'
import type { ReciboMercancia } from '@/types'
import { toast } from 'sonner'
import DetalleRecibo from '@/components/DetalleRecibo'

const FORMATOS_ACEPTADOS = '.xml,.xlsx,.xls,.pdf'

// Fecha de hoy y primer día del mes en formato YYYY-MM-DD
function hoy() { return new Date().toISOString().slice(0, 10) }
function primerDiaMes() {
  const d = new Date(); d.setDate(1)
  return d.toISOString().slice(0, 10)
}

export default function RecibosPage() {
  const [recibos, setRecibos]         = useState<ReciboMercancia[]>([])
  const [cargando, setCargando]       = useState(false)
  const [seleccionado, setSeleccionado] = useState<ReciboMercancia | null>(null)
  const [marcados, setMarcados]       = useState<Set<string>>(new Set())
  const [debugTexto, setDebugTexto]   = useState<string | null>(null)
  const [modalBorrar, setModalBorrar] = useState(false)
  const [borrarDesde, setBorrarDesde] = useState(primerDiaMes())
  const [borrarHasta, setBorrarHasta] = useState(hoy())
  const [borrando, setBorrando]       = useState(false)
  const [mostrarContador, setMostrarContador] = useState(true)
  // Informe de recibos por rango de fechas
  const [informeDesde, setInformeDesde] = useState(primerDiaMes())
  const [informeHasta, setInformeHasta] = useState(hoy())
  const [generandoInforme, setGenerandoInforme] = useState(false)

  // Agrupar recibos por fecha para el contador diario
  const contadorPorDia = useMemo(() => {
    const mapa = new Map<string, { cantidad: number; total: number; proveedores: Set<string> }>()
    for (const r of recibos) {
      const fecha = r.fecha || 'Sin fecha'
      if (!mapa.has(fecha)) mapa.set(fecha, { cantidad: 0, total: 0, proveedores: new Set() })
      const d = mapa.get(fecha)!
      d.cantidad++
      d.total += Number(r.total)
      if (r.proveedor) d.proveedores.add(r.proveedor)
    }
    return [...mapa.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 3)                          // solo los últimos 3 días
      .map(([fecha, data]) => ({
        fecha,
        cantidad: data.cantidad,
        total: data.total,
        proveedores: data.proveedores.size,
      }))
  }, [recibos])

  // Recibos dentro del rango del informe
  const recibosInforme = useMemo(() => {
    return recibos
      .filter(r => {
        const f = (r.fecha || '').slice(0, 10)
        return f >= informeDesde && f <= informeHasta
      })
      .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
  }, [recibos, informeDesde, informeHasta])
  const totalInforme = recibosInforme.reduce((s, r) => s + Number(r.total || 0), 0)

  async function descargarInformePDF() {
    if (recibosInforme.length === 0) { toast.error('No hay recibos en el rango seleccionado'); return }
    setGenerandoInforme(true)
    try {
      await generarInformeRecibosPDF(recibosInforme, informeDesde, informeHasta)
      toast.success(`Informe generado: ${recibosInforme.length} recibo(s)`)
    } catch (e) { toast.error(`Error generando PDF: ${(e as Error).message}`) }
    finally { setGenerandoInforme(false) }
  }

  // Importación desde BD
  const [fechaInicio, setFechaInicio] = useState(primerDiaMes())
  const [fechaFin, setFechaFin]       = useState(hoy())

  const inputRef = useRef<HTMLInputElement>(null)
  const debugRef = useRef<HTMLInputElement>(null)

  const recargar = async () => { setRecibos(await storeRecibos.getAll()); setMarcados(new Set()) }
  useEffect(() => { recargar() }, [])

  function toggleMarca(id: string) {
    setMarcados(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleTodos() {
    setMarcados(marcados.size === recibos.length ? new Set() : new Set(recibos.map(r => r.id)))
  }

  async function handleArchivos(files: FileList | null) {
    if (!files || files.length === 0) return
    setCargando(true)
    let importados = 0
    for (const file of Array.from(files)) {
      const nombre = file.name.toLowerCase()
      try {
        let datos: Omit<ReciboMercancia, 'id' | 'creadoEn'>
        if (nombre.endsWith('.xml')) datos = await parsearReciboXML(await file.text())
        else if (nombre.endsWith('.xlsx') || nombre.endsWith('.xls')) datos = await parsearReciboExcel(await file.arrayBuffer(), file.name)
        else if (nombre.endsWith('.pdf')) datos = await parsearReciboPDF(await file.arrayBuffer(), file.name)
        else { toast.error(`Formato no soportado: ${file.name}`); continue }
        await storeRecibos.save({ id: `r-${Date.now()}-${Math.random().toString(36).slice(2)}`, ...datos, creadoEn: new Date().toISOString() })
        importados++
      } catch (err) { toast.error(`Error en ${file.name}: ${(err as Error).message}`) }
    }
    await recargar(); setCargando(false)
    if (importados > 0) toast.success(`${importados} recibo(s) importado(s)`)
  }

  async function handleDebug(files: FileList | null) {
    if (!files || files.length === 0) return
    const fd = new FormData(); fd.append('file', files[0])
    const res = await fetch('/api/recibos/debug-pdf', { method: 'POST', body: fd })
    const data = await res.json()
    if (data.error) { toast.error(data.error); return }
    setDebugTexto(data.texto)
  }

  function importarDesdeBD() {
    if (!fechaInicio || !fechaFin) { toast.error('Selecciona ambas fechas'); return }
    if (fechaInicio > fechaFin) { toast.error('La fecha inicial no puede ser mayor a la final'); return }

    // Abrir ventana del servidor local directamente
    window.open(
      `http://localhost:3002/resultado?desde=${fechaInicio}&hasta=${fechaFin}`,
      'importar-recibos',
      'width=540,height=440,top=200,left=400'
    )
    toast.success('Ventana de importación abierta — espera el resultado')
    // Recargar la lista tras 12 segundos
    setTimeout(() => recargar(), 12000)
  }

  async function eliminarMarcados() {
    for (const id of marcados) await storeRecibos.delete(id)
    toast.success(`${marcados.size} recibo(s) eliminado(s)`)
    await recargar()
  }

  async function eliminarPorRango() {
    if (!borrarDesde || !borrarHasta) { toast.error('Selecciona ambas fechas'); return }
    if (borrarDesde > borrarHasta) { toast.error('Fecha inicial no puede ser mayor a la final'); return }
    setBorrando(true)
    try {
      const res = await fetch('/api/recibos/eliminar-rango', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ desde: borrarDesde, hasta: borrarHasta }),
      })
      const data = await res.json()
      if (data.error) { toast.error(data.error); return }
      toast.success(`${data.eliminados} recibo(s) eliminado(s) del ${borrarDesde} al ${borrarHasta}`)
      setModalBorrar(false)
      setRecibos([])          // limpiar pantalla inmediatamente
      setMarcados(new Set())
      await recargar()        // refrescar desde BD
    } catch { toast.error('Error al eliminar') }
    finally { setBorrando(false) }
  }

  const todosMarcados = recibos.length > 0 && marcados.size === recibos.length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recibos de Mercancía</h1>
          <p className="text-gray-500 text-sm mt-1">Carga recibos en XML, Excel, PDF o importa desde el sistema</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {marcados.size > 0 && (
            <Button variant="destructive" onClick={eliminarMarcados}>
              <Trash2 size={15} className="mr-1.5" /> Eliminar ({marcados.size})
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setModalBorrar(true)}
            className="border-red-300 text-red-600 hover:bg-red-50"
          >
            <CalendarX2 size={16} className="mr-2" /> Eliminar por fechas
          </Button>
          <Button onClick={() => inputRef.current?.click()} disabled={cargando}>
            <Upload size={16} className="mr-2" />
            {cargando ? 'Importando...' : 'Subir archivo'}
          </Button>
          <Button variant="outline" onClick={() => debugRef.current?.click()}>
            <Bug size={16} className="mr-2" /> Diagnóstico PDF
          </Button>
        </div>
        <input ref={inputRef} type="file" accept={FORMATOS_ACEPTADOS} multiple className="hidden"
          onChange={e => handleArchivos(e.target.files)} />
        <input ref={debugRef} type="file" accept=".pdf" className="hidden"
          onChange={e => handleDebug(e.target.files)} />
      </div>

      {/* ── Importar desde BD ─────────────────────────────────────────── */}
      <Card className="border-blue-200 bg-blue-50/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database size={18} className="text-blue-600" />
            Importar desde Sistema Pacardyl (MySQL)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            {/* Fecha inicial */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                <CalendarIcon size={12} /> Fecha inicial
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={e => setFechaInicio(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white cursor-pointer"
                />
              </div>
            </div>

            {/* Fecha final */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                <CalendarIcon size={12} /> Fecha final
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={fechaFin}
                  onChange={e => setFechaFin(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white cursor-pointer"
                />
              </div>
            </div>

            {/* Botón importar */}
            <Button
              onClick={importarDesdeBD}
              className="bg-blue-700 hover:bg-blue-800"
            >
              <Database size={16} className="mr-2" />
              Importar recibos
            </Button>

          </div>
          <p className="text-xs text-gray-400 mt-3">
            ℹ️ Requiere el servidor local corriendo (<code className="bg-gray-100 px-1 rounded">iniciar-servidor.bat</code>). Al hacer clic verifica automáticamente si está activo.
          </p>
        </CardContent>
      </Card>

      {/* ── Informe de Recibos por Rango de Fechas (PDF) ──────────────────── */}
      <Card className="border-emerald-200 bg-emerald-50/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileDown size={18} className="text-emerald-600" />
            Informe de Recibos de Mercancía (PDF)
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
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white cursor-pointer"
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
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white cursor-pointer"
              />
            </div>
            <div className="text-sm text-gray-600">
              <span className="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full font-medium">
                {recibosInforme.length} recibo(s) · ${totalInforme.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
            <Button
              onClick={descargarInformePDF}
              disabled={generandoInforme || recibosInforme.length === 0}
              className="bg-emerald-700 hover:bg-emerald-800"
            >
              <FileDown size={16} className="mr-2" />
              {generandoInforme ? 'Generando...' : 'Generar PDF'}
            </Button>
          </div>

          {/* Vista previa */}
          {recibosInforme.length > 0 && (
            <div className="mt-4 border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-emerald-100 text-emerald-800 sticky top-0">
                  <tr>
                    {['Fecha', 'No. Recibo', 'No. Factura', 'Proveedor', 'NIT Proveedor', 'Valor Total'].map(h => (
                      <th key={h} className="text-left px-3 py-2 font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {recibosInforme.map(r => (
                    <tr key={r.id} className="hover:bg-emerald-50">
                      <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{r.fecha || '—'}</td>
                      <td className="px-3 py-1.5 font-mono font-semibold whitespace-nowrap">{fmtRecibo(r.numeroRecibo)}</td>
                      <td className="px-3 py-1.5 font-mono whitespace-nowrap">{r.numeroFacturaProveedor || '—'}</td>
                      <td className="px-3 py-1.5">{r.proveedor || '—'}</td>
                      <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{r.nitProveedor || '—'}</td>
                      <td className="px-3 py-1.5 font-semibold text-right whitespace-nowrap">
                        ${Number(r.total || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Formatos */}
      <div className="flex gap-3 flex-wrap">
        {[
          { icon: <FileCode size={14} className="text-blue-500" />, label: 'XML' },
          { icon: <FileSpreadsheet size={14} className="text-green-500" />, label: 'Excel (.xlsx / .xls)' },
          { icon: <FileText size={14} className="text-red-500" />, label: 'PDF digital' },
        ].map(({ icon, label }) => (
          <div key={label} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-white text-xs text-gray-600">
            {icon} <span className="font-medium">{label}</span>
          </div>
        ))}
      </div>

      {debugTexto && (
        <Card className="border-orange-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-orange-700">Texto extraído del PDF</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setDebugTexto(null)}>✕</Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-gray-50 p-3 rounded border overflow-auto max-h-80 whitespace-pre-wrap font-mono">{debugTexto}</pre>
          </CardContent>
        </Card>
      )}

      {/* ── Contador de recibos por día ─────────────────────────────────── */}
      {recibos.length > 0 && (
        <Card className="border-green-200">
          <CardHeader className="pb-2 cursor-pointer" onClick={() => setMostrarContador(v => !v)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2 text-green-700">
                <BarChart2 size={16} /> Contador de Recibos por Día
                <span className="ml-2 bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  {recibos.length} recibos · {contadorPorDia.length} día(s)
                </span>
              </CardTitle>
              {mostrarContador ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
            </div>
          </CardHeader>
          {mostrarContador && (
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-green-50 border-b border-green-100">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold text-green-800 text-xs">Fecha</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-green-800 text-xs">Recibos del día</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-green-800 text-xs">Proveedores</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-green-800 text-xs">Total recibido</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-green-800 text-xs">Promedio / recibo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {contadorPorDia.map(({ fecha, cantidad, total, proveedores }) => (
                    <tr key={fecha} className="hover:bg-green-50 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-gray-800">{fecha}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-flex items-center justify-center bg-green-600 text-white text-sm font-bold rounded-full w-8 h-8">
                          {cantidad}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-gray-600">{proveedores}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-green-700">
                        ${Math.round(total).toLocaleString('es-CO')}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-500 text-xs">
                        ${Math.round(total / cantidad).toLocaleString('es-CO')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-gray-700">TOTAL</td>
                    <td className="px-4 py-2.5 text-center font-bold text-green-700">{recibos.length}</td>
                    <td className="px-4 py-2.5 text-center text-gray-500">—</td>
                    <td className="px-4 py-2.5 text-right font-bold text-green-700">
                      ${Math.round(recibos.reduce((s, r) => s + Number(r.total), 0)).toLocaleString('es-CO')}
                    </td>
                    <td className="px-4 py-2.5"></td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          )}
        </Card>
      )}

      {recibos.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <PackageCheck size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No hay recibos cargados.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{recibos.length} recibo(s)
              {marcados.size > 0 && <span className="ml-2 text-sm font-normal text-blue-600">— {marcados.size} seleccionado(s)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <button onClick={toggleTodos} className="text-blue-600">
                      {todosMarcados ? <CheckSquare size={18} /> : <Square size={18} className="text-gray-400" />}
                    </button>
                  </th>
                  {['No. Recibo','No. Factura','Proveedor','NIT','Fecha','Total','Productos',''].map(h => (
                    <th key={h} className="text-left px-3 py-3 font-medium text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recibos.map(r => (
                  <tr key={r.id} className={`transition-colors cursor-pointer ${marcados.has(r.id) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    onClick={() => toggleMarca(r.id)}>
                    <td className="px-4 py-3">
                      {marcados.has(r.id)
                        ? <CheckSquare size={18} className="text-blue-600" />
                        : <Square size={18} className="text-gray-300" />}
                    </td>
                    <td className="px-3 py-3 font-mono font-medium">{fmtRecibo(r.numeroRecibo)}</td>
                    <td className="px-3 py-3">
                      {r.numeroFacturaProveedor
                        ? <span className="bg-blue-100 text-blue-800 font-bold font-mono px-2 py-0.5 rounded text-xs">{r.numeroFacturaProveedor}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-3">{r.proveedor || '—'}</td>
                    <td className="px-3 py-3 text-gray-500 text-xs">{r.nitProveedor || '—'}</td>
                    <td className="px-3 py-3 text-gray-500">{r.fecha || '—'}</td>
                    <td className="px-3 py-3 font-medium">${Number(r.total).toLocaleString('es-CO')}</td>
                    <td className="px-3 py-3 text-gray-500">{r.productos.length} ítem(s)</td>
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setSeleccionado(r)}><Eye size={14} /></Button>
                        <Button size="sm" variant="ghost" onClick={async () => { await storeRecibos.delete(r.id); await recargar(); toast.success('Eliminado') }}>
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
      {seleccionado && <DetalleRecibo recibo={seleccionado} onClose={() => setSeleccionado(null)} />}

      {/* ── Modal de eliminación por rango de fechas ── */}
      {modalBorrar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4">
            {/* Encabezado */}
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-red-100 rounded-full">
                <CalendarX2 size={24} className="text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Eliminar Recibos por Fechas</h2>
                <p className="text-sm text-gray-500">Se eliminarán TODOS los recibos del rango seleccionado</p>
              </div>
            </div>

            {/* Calendarios */}
            <div className="space-y-4 mb-6">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <CalendarIcon size={14} className="text-red-500" /> Fecha inicial
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
                  <CalendarIcon size={14} className="text-red-500" /> Fecha final
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
                ⚠️ Se eliminarán todos los recibos del <strong>{borrarDesde}</strong> al <strong>{borrarHasta}</strong>
              </p>
              <p className="text-xs text-red-500 mt-1">Esta acción no se puede deshacer.</p>
            </div>

            {/* Botones */}
            <div className="flex gap-3">
              <button
                onClick={() => setModalBorrar(false)}
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
                {borrando ? 'Eliminando...' : 'Eliminar recibos'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
