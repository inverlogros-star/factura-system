'use client'
import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Upload, Trash2, FileText, Eye, CheckSquare, Square } from 'lucide-react'
import { parsearFacturaDIAN } from '@/lib/parser-dian'
import { storeFacturas } from '@/lib/store'
import type { Factura } from '@/types'
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

export default function FacturasPage() {
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [cargando, setCargando] = useState(false)
  const [seleccionada, setSeleccionada] = useState<Factura | null>(null)
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)

  const recargar = async () => { setFacturas(await storeFacturas.getAll()); setMarcadas(new Set()) }
  useEffect(() => { recargar() }, [])

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

  const todasMarcadas = facturas.length > 0 && marcadas.size === facturas.length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Facturas Electrónicas</h1>
          <p className="text-gray-500 text-sm mt-1">Importa XML DIAN para conciliar con recibos</p>
        </div>
        <div className="flex gap-2">
          {marcadas.size > 0 && (
            <Button variant="destructive" onClick={eliminarMarcadas}>
              <Trash2 size={15} className="mr-1.5" />
              Eliminar ({marcadas.size})
            </Button>
          )}
          <Button onClick={() => inputRef.current?.click()} disabled={cargando}>
            <Upload size={16} className="mr-2" />
            {cargando ? 'Importando...' : 'Subir XML'}
          </Button>
        </div>
        <input ref={inputRef} type="file" accept=".xml" multiple className="hidden"
          onChange={e => handleArchivos(e.target.files)} />
      </div>

      {facturas.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No hay facturas cargadas.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{facturas.length} factura(s)
              {marcadas.size > 0 && <span className="ml-2 text-sm font-normal text-blue-600">— {marcadas.size} seleccionada(s)</span>}
            </CardTitle>
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
                  {['No. Factura','Proveedor','NIT','Fecha','Total','Estado','Correo origen',''].map(h => (
                    <th key={h} className="text-left px-3 py-3 font-medium text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {facturas.map(f => (
                  <tr key={f.id} className={`transition-colors cursor-pointer ${marcadas.has(f.id) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    onClick={() => toggleMarca(f.id)}>
                    <td className="px-4 py-3" onClick={e => { e.stopPropagation(); toggleMarca(f.id) }}>
                      {marcadas.has(f.id)
                        ? <CheckSquare size={18} className="text-blue-600" />
                        : <Square size={18} className="text-gray-300" />}
                    </td>
                    <td className="px-3 py-3 font-mono font-medium">{f.numeroFactura}</td>
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
    </div>
  )
}
