'use client'
import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CalendarIcon, PackageCheck, FileText, AlertTriangle, CheckCircle2, BarChart3, Search, PieChart } from 'lucide-react'
import { storeFacturas, storeRecibos, storeComparaciones } from '@/lib/store'
import type { Factura, ReciboMercancia, ResultadoComparacion } from '@/types'
import Link from 'next/link'

function fmt(n: number) {
  return Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtVal(n: number) {
  return Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function hoy() { return new Date().toISOString().slice(0, 10) }
function primerDiaMes() {
  const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10)
}

export default function ReportePage() {
  const [facturas, setFacturas]       = useState<Factura[]>([])
  const [recibos, setRecibos]         = useState<ReciboMercancia[]>([])
  const [comparaciones, setComparaciones] = useState<ResultadoComparacion[]>([])
  const [desde, setDesde]             = useState(primerDiaMes())
  const [hasta, setHasta]             = useState(hoy())
  const [cargando, setCargando]       = useState(true)

  useEffect(() => {
    Promise.all([
      storeFacturas.getAll(),
      storeRecibos.getAll(),
      storeComparaciones.getAll(),
    ]).then(([f, r, c]) => {
      setFacturas(f); setRecibos(r); setComparaciones(c)
      setCargando(false)
    })
  }, [])

  const data = useMemo(() => {
    if (cargando) return null
    const d1 = desde, d2 = hasta + 'T23:59:59'

    // Normalizar fechas para comparación segura
    const normalize = (fecha: string) => (fecha || '').slice(0, 10)

    // ── RECIBOS DE MERCANCÍA (de MySQL) ──────────────────────────────
    const recibosRango  = recibos.filter(r => {
      const f = normalize(r.fecha)
      return f >= d1 && f <= hasta
    })
    const totalRecibido = recibosRango.reduce((s, r) => s + Number(r.total), 0)

    // ── FACTURAS ELECTRÓNICAS (de DIAN) ──────────────────────────────
    const facturasRango = facturas.filter(f => {
      const fecha = normalize(f.fecha)
      return fecha >= d1 && fecha <= hasta
    })
    const facturasPendientes = facturasRango.filter(f => f.estado === 'pendiente')
    const factConDif         = facturasRango.filter(f => f.estado === 'con_diferencias')
    const factSinDif         = facturasRango.filter(f => f.estado === 'conciliada')
    const totalFacturado     = facturasRango.reduce((s, f) => s + Number(f.total), 0)

    // Por tipo de documento
    const soloFacturas = facturasRango.filter(f => (f.tipoDocumento || 'factura') === 'factura')
    const notasCredito = facturasRango.filter(f => f.tipoDocumento === 'nota_credito')
    const notasDebito  = facturasRango.filter(f => f.tipoDocumento === 'nota_debito')

    // ── COMPARACIONES ────────────────────────────────────────────────
    const compRango  = comparaciones.filter(c => normalize(c.fechaComparacion) >= d1 && normalize(c.fechaComparacion) <= hasta)
    const compConDif = compRango.filter(c => c.tieneDiferencias)
    const compSinDif = compRango.filter(c => !c.tieneDiferencias)
    const difTotal   = compRango.reduce((s, c) => s + Math.abs(Number(c.valorDiferenciaTotal)), 0)

    // Facturas sin comparar (pendiente con recibo disponible)
    const facturasComparadas = facturasRango.filter(f => f.estado !== 'pendiente')

    // Top proveedores con más diferencias
    const provMap = new Map<string, { nombre: string; facturas: number; conDif: number; valorDif: number }>()
    for (const f of facturasRango) {
      const k = f.nitProveedor || f.proveedor || '—'
      if (!provMap.has(k)) provMap.set(k, { nombre: f.proveedor || k, facturas: 0, conDif: 0, valorDif: 0 })
      const p = provMap.get(k)!
      p.facturas++
      if (f.estado === 'con_diferencias') {
        p.conDif++
        const comp = comparaciones.find(c => c.facturaId === f.id)
        if (comp) p.valorDif += Math.abs(Number(comp.valorDiferenciaTotal))
      }
    }
    const topProveedores = [...provMap.values()]
      .filter(p => p.conDif > 0)
      .sort((a, b) => b.valorDif - a.valorDif)
      .slice(0, 10)

    return {
      facturasRango, facturasPendientes, facturasComparadas,
      factConDif, factSinDif, totalFacturado,
      soloFacturas, notasCredito, notasDebito,
      recibosRango, totalRecibido,
      compRango, compConDif, compSinDif, difTotal,
      topProveedores,
    }
  }, [facturas, recibos, comparaciones, desde, hasta, cargando])

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 p-6 shadow-lg">
        <PieChart size={140} className="absolute -right-4 -bottom-8 text-white/10 z-0" />
        <div className="relative z-10">
          <h1 className="text-2xl font-extrabold text-white drop-shadow-sm flex items-center gap-2">
            <BarChart3 size={24} /> Reporte por Rango de Fechas
          </h1>
          <p className="text-cyan-100 text-sm mt-1">Resumen de facturas, recibos y comparaciones en el período seleccionado</p>
        </div>
      </div>

      {/* Selector de fechas */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardContent className="p-5">
          <div className="flex flex-wrap gap-6 items-end">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                <CalendarIcon size={12} /> Fecha inicial
              </label>
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white cursor-pointer" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                <CalendarIcon size={12} /> Fecha final
              </label>
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white cursor-pointer" />
            </div>
            <div className="text-sm text-gray-500">
              {data && <span className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full font-medium">
                {data.facturasRango.length + data.recibosRango.length} documentos en el período
              </span>}
            </div>
          </div>
        </CardContent>
      </Card>

      {cargando ? (
        <div className="text-center py-16 text-gray-400">Cargando datos...</div>
      ) : data && (
        <>
          {/* ── INDICADORES PRINCIPALES ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                icon: <PackageCheck size={22} className="text-green-600" />,
                bg: 'bg-green-50', label: 'Recibos de Mercancía', value: data.recibosRango.length,
                sub: `Total recibido: $${fmt(data.totalRecibido)}`, color: 'text-green-700',
              },
              {
                icon: <FileText size={22} className="text-blue-600" />,
                bg: 'bg-blue-50', label: 'Facturas Electrónicas DIAN', value: data.facturasRango.length,
                sub: `Facturas: ${data.soloFacturas.length} | N.Créd: ${data.notasCredito.length} | Total: $${fmt(data.totalFacturado)}`, color: 'text-blue-700',
              },
              {
                icon: <AlertTriangle size={22} className="text-red-600" />,
                bg: 'bg-red-50', label: 'Facturas con Diferencia', value: data.factConDif.length,
                sub: `Valor diferencias: $${fmt(data.difTotal)}`, color: 'text-red-700',
              },
              {
                icon: <CheckCircle2 size={22} className="text-emerald-600" />,
                bg: 'bg-emerald-50', label: 'Facturas Sin Diferencia', value: data.factSinDif.length,
                sub: `Pendientes: ${data.facturasPendientes.length}`, color: 'text-emerald-700',
              },
            ].map(({ icon, bg, label, value, sub, color }) => (
              <Card key={label} className="overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-lg ${bg} shrink-0`}>{icon}</div>
                    <div>
                      <p className={`text-3xl font-bold ${color}`}>{value}</p>
                      <p className="text-xs font-semibold text-gray-700 mt-0.5">{label}</p>
                      <p className="text-xs text-gray-400 mt-1">{sub}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ── DETALLE FACTURAS ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Desglose de documentos recibidos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'Facturas de venta',      value: data.soloFacturas.length,  color: 'bg-blue-500' },
                  { label: 'Notas Crédito',           value: data.notasCredito.length,  color: 'bg-orange-500' },
                  { label: 'Notas Débito',            value: data.notasDebito.length,   color: 'bg-purple-500' },
                  { label: 'Recibos de mercancía',    value: data.recibosRango.length,  color: 'bg-green-500' },
                ].map(({ label, value, color }) => {
                  const total = data.soloFacturas.length + data.notasCredito.length + data.notasDebito.length + data.recibosRango.length
                  const pct = total > 0 ? Math.round((value / total) * 100) : 0
                  return (
                    <div key={label} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">{label}</span>
                        <span className="font-bold">{value}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Estado de comparaciones en el período</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-2xl font-bold text-blue-700">{data.compRango.length}</p>
                    <p className="text-xs text-gray-500">Total comparadas</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3">
                    <p className="text-2xl font-bold text-red-700">{data.compConDif.length}</p>
                    <p className="text-xs text-gray-500">Con diferencia</p>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-3">
                    <p className="text-2xl font-bold text-emerald-700">{data.compSinDif.length}</p>
                    <p className="text-xs text-gray-500">Sin diferencia</p>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 flex justify-between items-center">
                  <span className="text-sm text-gray-600">Valor total diferencias</span>
                  <span className={`text-lg font-bold ${data.difTotal > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    ${fmtVal(data.difTotal)}
                  </span>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 flex justify-between items-center">
                  <span className="text-sm text-gray-600">Sin comparar</span>
                  <span className="text-lg font-bold text-yellow-600">{data.facturasPendientes.length}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── PROVEEDORES CON DIFERENCIAS ── */}
          {data.topProveedores.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle size={15} className="text-red-500" />
                  Proveedores con diferencias en el período
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {['Proveedor', 'Facturas', 'Con diferencia', '% Diferencia', 'Valor diferencia'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 font-medium text-gray-600 text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.topProveedores.map((p, i) => (
                      <tr key={i} className="hover:bg-red-50">
                        <td className="px-4 py-2.5 font-medium">{p.nombre}</td>
                        <td className="px-4 py-2.5 text-center">{p.facturas}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-bold">
                            {p.conDif}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center text-gray-500">
                          {Math.round((p.conDif / p.facturas) * 100)}%
                        </td>
                        <td className="px-4 py-2.5 font-bold text-red-600">${fmt(p.valorDif)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Acciones */}
          <div className="flex gap-3">
            <Link href="/comparacion">
              <Button variant="outline" className="gap-2">
                <Search size={15} /> Ver comparaciones
              </Button>
            </Link>
            <Link href="/facturas">
              <Button variant="outline" className="gap-2">
                <FileText size={15} /> Ver facturas
              </Button>
            </Link>
            <Link href="/recibos">
              <Button variant="outline" className="gap-2">
                <PackageCheck size={15} /> Ver recibos
              </Button>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
