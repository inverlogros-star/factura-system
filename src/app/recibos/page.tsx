'use client'
import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, Trash2, PackageCheck, Eye, FileSpreadsheet, FileText, FileCode, Bug, CheckSquare, Square, Database, CalendarIcon } from 'lucide-react'
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

  // Importación desde BD
  const [fechaInicio, setFechaInicio] = useState(primerDiaMes())
  const [fechaFin, setFechaFin]       = useState(hoy())
  const [importandoBD, setImportandoBD] = useState(false)
  const [resultadoBD, setResultadoBD] = useState<string | null>(null)

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

  const scriptPath = 'C:\\Users\\SPalacio\\Documents\\PROYECTO PCARDYL\\factura-system\\scripts\\importar-recibos-bd.js'

  async function importarDesdeBD() {
    if (!fechaInicio || !fechaFin) { toast.error('Selecciona ambas fechas'); return }
    if (fechaInicio > fechaFin) { toast.error('La fecha inicial no puede ser mayor a la final'); return }
    const cmd = `node "${scriptPath}" ${fechaInicio} ${fechaFin}`
    try {
      await navigator.clipboard.writeText(cmd)
      toast.success('Comando copiado al portapapeles — pégalo en CMD o PowerShell')
    } catch {
      toast.info('Copia el comando manualmente')
    }
    setResultadoBD(cmd)
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
              disabled={importandoBD}
              className="bg-blue-700 hover:bg-blue-800"
            >
              <Database size={16} className="mr-2" />
              {importandoBD ? 'Generando...' : 'Generar comando'}
            </Button>

            {/* Resultado */}
            {resultadoBD && (
              <div className="w-full mt-2">
                <p className="text-xs text-gray-500 mb-1">Ejecuta este comando en tu PC (CMD o PowerShell):</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-gray-900 text-green-400 text-xs px-3 py-2 rounded font-mono break-all">
                    {resultadoBD}
                  </code>
                  <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(resultadoBD).then(() => toast.success('Copiado'))}>
                    Copiar
                  </Button>
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            ℹ️ El MySQL está en la red local (192.168.11.251) — el comando se ejecuta desde tu PC, los datos se suben automáticamente al sistema.
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
