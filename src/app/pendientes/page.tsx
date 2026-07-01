'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, AlertCircle, Trash2, CheckSquare, Square, Hourglass } from 'lucide-react'
import { storeFacturas } from '@/lib/store'
import type { Factura } from '@/types'
import { toast } from 'sonner'

export default function PendientesPage() {
  const [pendientes, setPendientes] = useState<Factura[]>([])
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())

  const recargar = async () => {
    const all = await storeFacturas.getAll()
    setPendientes(all.filter(f => f.estado === 'pendiente'))
    setMarcadas(new Set())
  }
  useEffect(() => { recargar() }, [])

  function toggleMarca(id: string) {
    setMarcadas(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleTodas() {
    setMarcadas(marcadas.size === pendientes.length ? new Set() : new Set(pendientes.map(f => f.id)))
  }

  async function eliminarMarcadas() {
    for (const id of marcadas) await storeFacturas.delete(id)
    toast.success(`${marcadas.size} factura(s) eliminada(s)`)
    await recargar()
  }

  const todasMarcadas = pendientes.length > 0 && marcadas.size === pendientes.length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Hourglass size={22} className="text-amber-500" /> Facturas Pendientes
          </h1>
          <p className="text-gray-500 text-sm mt-1">Facturas sin recibo de mercancía asociado</p>
        </div>
        {marcadas.size > 0 && (
          <Button variant="destructive" onClick={eliminarMarcadas}>
            <Trash2 size={15} className="mr-1.5" />
            Eliminar ({marcadas.size})
          </Button>
        )}
      </div>

      {pendientes.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Clock size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No hay facturas pendientes.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertCircle size={18} className="text-yellow-600" />
            <p className="text-sm text-yellow-800 font-medium">
              {pendientes.length} factura(s) esperando recibo
              {marcadas.size > 0 && <span className="ml-2 text-blue-600">— {marcadas.size} seleccionada(s)</span>}
            </p>
          </div>
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <button onClick={toggleTodas} className="text-blue-600">
                        {todasMarcadas ? <CheckSquare size={18} /> : <Square size={18} className="text-gray-400" />}
                      </button>
                    </th>
                    {['No. Factura','Proveedor','NIT','Fecha','Total','Días en espera',''].map(h => (
                      <th key={h} className="text-left px-3 py-3 font-medium text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pendientes.map(f => {
                    const dias = Math.floor((Date.now() - new Date(f.creadoEn).getTime()) / 86400000)
                    return (
                      <tr key={f.id} className={`transition-colors cursor-pointer ${marcadas.has(f.id) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                        onClick={() => toggleMarca(f.id)}>
                        <td className="px-4 py-3">
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
                          <span className={`font-medium ${dias > 7 ? 'text-red-600' : dias > 3 ? 'text-yellow-600' : 'text-gray-600'}`}>
                            {dias} día(s)
                          </span>
                        </td>
                        <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                          <Button size="sm" variant="ghost" onClick={async () => { await storeFacturas.delete(f.id); await recargar(); toast.success('Eliminada') }}>
                            <Trash2 size={14} className="text-red-500" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
