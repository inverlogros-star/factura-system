'use client'
import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronUp, Building2, Eye } from 'lucide-react'
import { storeFacturas } from '@/lib/store'
import type { Factura } from '@/types'
import DetalleFactura from '@/components/DetalleFactura'

function fmt(n: number) {
  return Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

const TIPO_COLOR: Record<string, string> = {
  factura:      'bg-blue-100 text-blue-800',
  nota_credito: 'bg-orange-100 text-orange-800',
  nota_debito:  'bg-purple-100 text-purple-800',
  otro:         'bg-gray-100 text-gray-500',
}
const TIPO_LABEL: Record<string, string> = {
  factura: 'Factura', nota_credito: 'N. Crédito', nota_debito: 'N. Débito', otro: 'Otro',
}
const ESTADO_COLOR: Record<string, string> = {
  pendiente:       'bg-yellow-100 text-yellow-800',
  conciliada:      'bg-green-100 text-green-800',
  con_diferencias: 'bg-red-100 text-red-800',
  rechazada:       'bg-gray-100 text-gray-500',
}

interface GrupoProveedor {
  proveedor: string
  nit: string
  documentos: Factura[]
  totalFacturas: number
  totalNotas: number
  totalNeto: number
  fechas: string[]
}

export default function ProveedoresPage() {
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [detalle, setDetalle] = useState<Factura | null>(null)
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'factura' | 'nota_credito' | 'nota_debito'>('todos')

  useEffect(() => { storeFacturas.getAll().then(setFacturas) }, [])

  const grupos = useMemo<GrupoProveedor[]>(() => {
    const mapa = new Map<string, Factura[]>()
    for (const f of facturas) {
      const key = f.nitProveedor || f.proveedor || 'SIN PROVEEDOR'
      if (!mapa.has(key)) mapa.set(key, [])
      mapa.get(key)!.push(f)
    }
    return Array.from(mapa.entries())
      .map(([key, docs]) => {
        const sorted = [...docs].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
        const factDocs   = sorted.filter(d => (d.tipoDocumento || 'factura') === 'factura')
        const notaDocs   = sorted.filter(d => (d.tipoDocumento || '') !== 'factura' && d.tipoDocumento !== 'otro')
        const totalF     = factDocs.reduce((s, d) => s + Number(d.total), 0)
        const totalN     = notaDocs.reduce((s, d) => s + Number(d.total), 0)
        const fechas     = [...new Set(sorted.map(d => d.fecha).filter(Boolean))]
        return {
          proveedor: sorted[0]?.proveedor || key,
          nit: key,
          documentos: sorted,
          totalFacturas: totalF,
          totalNotas: totalN,
          totalNeto: totalF - totalN,
          fechas,
        }
      })
      .sort((a, b) => b.totalFacturas - a.totalFacturas)
  }, [facturas])

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase()
    return grupos
      .map(g => ({
        ...g,
        documentos: g.documentos.filter(d => {
          const tipoOk = filtroTipo === 'todos' || (d.tipoDocumento || 'factura') === filtroTipo
          return tipoOk
        }),
      }))
      .filter(g =>
        g.documentos.length > 0 &&
        (!q || g.proveedor.toLowerCase().includes(q) || g.nit.includes(q))
      )
  }, [grupos, busqueda, filtroTipo])

  function toggle(nit: string) {
    setExpandidos(prev => {
      const n = new Set(prev)
      n.has(nit) ? n.delete(nit) : n.add(nit)
      return n
    })
  }

  const totalDocs   = filtrados.reduce((s, g) => s + g.documentos.length, 0)
  const totalGeneral = filtrados.reduce((s, g) => s + g.documentos.filter(d => (d.tipoDocumento || 'factura') === 'factura').reduce((a, d) => a + Number(d.total), 0), 0)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Building2 size={22} className="text-blue-600" /> Documentos por Proveedor
        </h1>
        <p className="text-gray-500 text-sm mt-1">Facturas y notas agrupadas por proveedor y fecha</p>
      </div>

      {/* Resumen general */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Building2 size={22} className="text-blue-600" />
            <div>
              <p className="text-2xl font-bold">{filtrados.length}</p>
              <p className="text-xs text-gray-500">Proveedores</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{totalDocs}</p>
            <p className="text-xs text-gray-500">Documentos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-blue-700">${fmt(totalGeneral)}</p>
            <p className="text-xs text-gray-500">Total facturas</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-center">
        <input
          type="text"
          placeholder="Buscar proveedor o NIT..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        {(['todos', 'factura', 'nota_credito', 'nota_debito'] as const).map(t => (
          <button key={t}
            onClick={() => setFiltroTipo(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filtroTipo === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
            {t === 'todos' ? 'Todos' : TIPO_LABEL[t]}
          </button>
        ))}
      </div>

      {/* Lista de proveedores */}
      <div className="space-y-3">
        {filtrados.length === 0 && (
          <Card><CardContent className="py-16 text-center text-gray-400">Sin resultados</CardContent></Card>
        )}
        {filtrados.map(grupo => {
          const abierto = expandidos.has(grupo.nit)
          const docsPorFecha = grupo.documentos.reduce((acc, d) => {
            const fecha = d.fecha || 'Sin fecha'
            if (!acc[fecha]) acc[fecha] = []
            acc[fecha].push(d)
            return acc
          }, {} as Record<string, Factura[]>)

          return (
            <Card key={grupo.nit} className="overflow-hidden">
              {/* Cabecera del proveedor */}
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggle(grupo.nit)}
              >
                <div className="flex items-center gap-4 flex-1">
                  <Building2 size={20} className="text-blue-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{grupo.proveedor}</p>
                    <p className="text-xs text-gray-500">NIT: {grupo.nit} · {grupo.documentos.length} doc(s) · {grupo.fechas.length} fecha(s)</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 ml-4 shrink-0">
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Facturas</p>
                    <p className="font-bold text-blue-700">${fmt(grupo.totalFacturas)}</p>
                  </div>
                  {grupo.totalNotas > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Notas</p>
                      <p className="font-bold text-orange-600">-${fmt(grupo.totalNotas)}</p>
                    </div>
                  )}
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Neto</p>
                    <p className={`font-bold text-base ${grupo.totalNeto >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                      ${fmt(grupo.totalNeto)}
                    </p>
                  </div>
                  {abierto ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                </div>
              </div>

              {/* Detalle agrupado por fecha */}
              {abierto && (
                <div className="border-t divide-y divide-gray-100">
                  {Object.entries(docsPorFecha)
                    .sort(([a], [b]) => b.localeCompare(a))
                    .map(([fecha, docs]) => {
                      const totalFecha = docs.filter(d => (d.tipoDocumento || 'factura') === 'factura').reduce((s, d) => s + Number(d.total), 0)
                      const notasFecha = docs.filter(d => (d.tipoDocumento || '') !== 'factura').reduce((s, d) => s + Number(d.total), 0)
                      return (
                        <div key={fecha}>
                          {/* Sub-cabecera de fecha */}
                          <div className="flex items-center justify-between px-5 py-2.5 bg-gray-50">
                            <span className="text-sm font-semibold text-gray-700">📅 {fecha}</span>
                            <div className="flex gap-6 text-xs">
                              <span className="text-blue-700 font-medium">${fmt(totalFecha)}</span>
                              {notasFecha > 0 && <span className="text-orange-600 font-medium">-${fmt(notasFecha)}</span>}
                              <span className="text-gray-500">{docs.length} doc(s)</span>
                            </div>
                          </div>
                          {/* Documentos de esa fecha */}
                          <table className="w-full text-sm">
                            <tbody className="divide-y divide-gray-50">
                              {docs.map(d => (
                                <tr key={d.id} className="hover:bg-blue-50 transition-colors">
                                  <td className="px-6 py-2.5 w-8">
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TIPO_COLOR[d.tipoDocumento || 'factura']}`}>
                                      {TIPO_LABEL[d.tipoDocumento || 'factura']}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5 font-mono font-medium text-gray-800">{d.numeroFactura}</td>
                                  <td className="px-3 py-2.5 text-gray-500 text-xs">
                                    {d.productos.length} producto(s)
                                  </td>
                                  <td className="px-3 py-2.5 text-right">
                                    <span className="text-gray-500 text-xs">Sub: </span>
                                    <span className="font-medium">${fmt(d.subtotal)}</span>
                                  </td>
                                  <td className="px-3 py-2.5 text-right">
                                    <span className="text-gray-500 text-xs">IVA: </span>
                                    <span className="text-purple-600 font-medium">${fmt(d.impuestos)}</span>
                                  </td>
                                  <td className="px-3 py-2.5 text-right">
                                    <span className={`font-bold text-base ${(d.tipoDocumento || 'factura') !== 'factura' ? 'text-orange-600' : 'text-blue-700'}`}>
                                      ${fmt(d.total)}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADO_COLOR[d.estado]}`}>
                                      {d.estado}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5 text-right">
                                    <button
                                      onClick={() => setDetalle(d)}
                                      className="p-1.5 rounded hover:bg-blue-100 text-blue-600 transition-colors"
                                      title="Ver detalle"
                                    >
                                      <Eye size={15} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    })}
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {detalle && <DetalleFactura factura={detalle} onClose={() => setDetalle(null)} />}
    </div>
  )
}
