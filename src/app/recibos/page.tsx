'use client'
import { useEffect, useRef, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, Trash2, PackageCheck, Eye, FileSpreadsheet, FileText, FileCode, Bug, CheckSquare, Square, Database, CalendarIcon, BarChart2, ChevronDown, ChevronUp } from 'lucide-react'
import { parsearReciboXML } from '@/lib/parser-dian'
import { parsearReciboExcel } from '@/lib/parser-recibo-excel'
import { parsearReciboPDF } from '@/lib/parser-recibo-pdf'
import { storeRecibos } from '@/lib/store'
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
  const [mostrarContador, setMostrarContador] = useState(true)

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
      .map(([fecha, data]) => ({
        fecha,
        cantidad: data.cantidad,
        total: data.total,
        proveedores: data.proveedores.size,
      }))
  }, [recibos])

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
                    <td className="px-3 py-3 font-mono font-medium">{r.numeroRecibo}</td>
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
    </div>
  )
}
