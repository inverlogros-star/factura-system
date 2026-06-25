'use client'
import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trash2, Eye, CheckSquare, Square, Search, X, Receipt, AlertCircle } from 'lucide-react'
import { storeFacturas } from '@/lib/store'
import type { Factura } from '@/types'
import { toast } from 'sonner'
import DetalleFactura from '@/components/DetalleFactura'

function fmt(n: number) {
  return Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

// Misma función del comparador para identificar notas crédito POS
function esNotaCreditoPOS(f: Factura): boolean {
  if (f.tipoDocumento !== 'nota_credito') return false
  const prov = (f.proveedor || '').toLowerCase()
  const nit  = (f.nitProveedor || '').replace(/\D/g, '')
  const num  = (f.numeroFactura || '').toLowerCase()
  if (nit === '222222222' || nit === '99' || nit === '0') return true
  if (prov.includes('lista de costos') || prov.includes('pos ') || prov.includes(' pos')) return true
  if (num.includes('pos') || num.startsWith('nc') || num.startsWith('pos')) return true
  if (!f.nitProveedor && !f.proveedor) return true
  return false
}

export default function NotasPOSPage() {
  const [facturas, setFacturas]     = useState<Factura[]>([])
  const [marcadas, setMarcadas]     = useState<Set<string>>(new Set())
  const [busqueda, setBusqueda]     = useState('')
  const [seleccionada, setSeleccionada] = useState<Factura | null>(null)

  const recargar = async () => {
    const all = await storeFacturas.getAll()
    // Todas las notas crédito y débito van a este módulo — no al de comparación
    setFacturas(all.filter(f =>
      f.tipoDocumento === 'nota_credito' || f.tipoDocumento === 'nota_debito'
    ))
    setMarcadas(new Set())
  }
  useEffect(() => { recargar() }, [])

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return facturas
    return facturas.filter(f =>
      f.numeroFactura.toLowerCase().includes(q) ||
      (f.proveedor || '').toLowerCase().includes(q) ||
      (f.nitProveedor || '').replace(/[.\-\s]/g, '').includes(q.replace(/[.\-\s]/g, ''))
    )
  }, [facturas, busqueda])

  function toggleMarca(id: string) {
    setMarcadas(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleTodas() {
    setMarcadas(marcadas.size === filtradas.length ? new Set() : new Set(filtradas.map(f => f.id)))
  }

  async function eliminarMarcadas() {
    for (const id of marcadas) await storeFacturas.delete(id)
    toast.success(`${marcadas.size} nota(s) eliminada(s)`)
    await recargar()
  }

  const totalNotas = filtradas.length
  const totalValor = filtradas.reduce((s, f) => s + Number(f.total), 0)
  const todasMarcadas = filtradas.length > 0 && marcadas.size === filtradas.length

  // Agrupar por mes para estadísticas
  const porMes = useMemo(() => {
    const map = new Map<string, { count: number; valor: number }>()
    for (const f of filtradas) {
      const mes = (f.fecha || '').slice(0, 7) || 'Sin fecha'
      const m = map.get(mes) || { count: 0, valor: 0 }
      m.count++
      m.valor += Number(f.total)
      map.set(mes, m)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6)
  }, [filtradas])

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt size={24} className="text-orange-600" />
            Notas Crédito y Débito
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Notas crédito/débito de proveedores y POS — <strong>no se comparan con recibos de mercancía</strong>
          </p>
        </div>
        {marcadas.size > 0 && (
          <Button variant="destructive" onClick={eliminarMarcadas}>
            <Trash2 size={15} className="mr-1.5" /> Eliminar ({marcadas.size})
          </Button>
        )}
      </div>

      {/* Aviso informativo */}
      <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-lg p-4">
        <AlertCircle size={18} className="text-orange-600 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-orange-800">Módulo exclusivo — sin comparación con proveedores</p>
          <p className="text-orange-700 mt-1">
            Estas notas crédito son generadas por el sistema POS para ajustes internos (devoluciones en venta,
            costos de inventario, etc.). Están separadas del módulo de Comparación y no aparecerán en él.
          </p>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-orange-600">{totalNotas}</p>
            <p className="text-xs text-gray-500">Total notas POS</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-700">${fmt(totalValor)}</p>
            <p className="text-xs text-gray-500">Valor total</p>
          </CardContent>
        </Card>
        {porMes.slice(0, 2).map(([mes, data]) => (
          <Card key={mes}>
            <CardContent className="p-4 text-center">
              <p className="text-xl font-bold text-gray-700">{data.count}</p>
              <p className="text-xs text-gray-500">{mes}</p>
              <p className="text-xs text-orange-600 font-medium">${fmt(data.valor)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabla */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-base">
              {filtradas.length} nota(s) POS
              {marcadas.size > 0 && <span className="ml-2 text-sm font-normal text-orange-600">— {marcadas.size} seleccionada(s)</span>}
              {busqueda && <span className="ml-2 text-sm font-normal text-gray-400">de {facturas.length} total</span>}
            </CardTitle>
            <div className="relative min-w-[280px]">
              <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por número, proveedor o NIT..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="w-full pl-8 pr-7 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-gray-50"
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
          {filtradas.length === 0 ? (
            <div className="py-16 text-center">
              <Receipt size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">
                {facturas.length === 0 ? 'No hay notas crédito POS en el sistema.' : 'Sin resultados para la búsqueda.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-orange-50 border-b border-orange-100">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <button onClick={toggleTodas} className="text-orange-600">
                        {todasMarcadas ? <CheckSquare size={17} /> : <Square size={17} className="text-gray-400" />}
                      </button>
                    </th>
                    {['No. Nota','Proveedor / Concepto','NIT','Fecha','Total','Estado',''].map(h => (
                      <th key={h} className="text-left px-3 py-3 font-medium text-gray-600 text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtradas.map(f => (
                    <tr key={f.id}
                      className={`transition-colors cursor-pointer ${marcadas.has(f.id) ? 'bg-orange-50' : 'hover:bg-gray-50'}`}
                      onClick={() => toggleMarca(f.id)}>
                      <td className="px-4 py-2.5">
                        {marcadas.has(f.id)
                          ? <CheckSquare size={16} className="text-orange-600" />
                          : <Square size={16} className="text-gray-300" />}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-medium text-sm">{f.numeroFactura}</td>
                      <td className="px-3 py-2.5 text-gray-600 max-w-[200px]">
                        <span className="block truncate" title={f.proveedor}>{f.proveedor || '— POS —'}</span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs">{f.nitProveedor || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs whitespace-nowrap">{f.fecha}</td>
                      <td className="px-3 py-2.5 font-medium whitespace-nowrap text-orange-700">
                        ${fmt(f.total)}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge className="bg-orange-100 text-orange-700 text-xs">N.C. POS</Badge>
                      </td>
                      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setSeleccionada(f)}>
                            <Eye size={14} className="text-gray-500" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={async () => {
                            await storeFacturas.delete(f.id)
                            await recargar()
                            toast.success('Nota eliminada')
                          }}>
                            <Trash2 size={14} className="text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {seleccionada && <DetalleFactura factura={seleccionada} onClose={() => setSeleccionada(null)} />}
    </div>
  )
}
