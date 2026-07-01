'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, PackageCheck, AlertTriangle, Clock, CheckCircle2, XCircle, GitCompareArrows, ShieldCheck, Calculator, PieChart as PieChartIcon, TrafficCone } from 'lucide-react'
import { storeFacturas, storeRecibos, storeComparaciones } from '@/lib/store'
import type { Factura, ReciboMercancia, ResultadoComparacion } from '@/types'
import Link from 'next/link'

export default function Dashboard() {
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [recibos, setRecibos] = useState<ReciboMercancia[]>([])
  const [comparaciones, setComparaciones] = useState<ResultadoComparacion[]>([])

  useEffect(() => {
    storeFacturas.getAll().then(setFacturas)
    storeRecibos.getAll().then(setRecibos)
    storeComparaciones.getAll().then(setComparaciones)
  }, [])

  const pendientes      = facturas.filter(f => f.estado === 'pendiente').length

  // Fuente única: tabla comparaciones
  const totalComparadas = comparaciones.length
  const compConDif      = comparaciones.filter(c => c.tieneDiferencias).length
  const compSinDif      = comparaciones.filter(c => !c.tieneDiferencias).length
  // Pendientes = facturas aún no comparadas
  const sinComparar     = facturas.length - totalComparadas

  const stats = [
    { label: 'Total Facturas',           value: facturas.length,  icon: FileText,         color: 'text-blue-600',    bg: 'bg-blue-50',    ring: 'border-blue-200',    href: '/facturas' },
    { label: 'Recibos Cargados',         value: recibos.length,   icon: PackageCheck,     color: 'text-green-600',   bg: 'bg-green-50',   ring: 'border-green-200',   href: '/recibos' },
    { label: 'Sin comparar',             value: sinComparar,      icon: Clock,            color: 'text-amber-600',   bg: 'bg-amber-50',   ring: 'border-amber-200',   href: '/pendientes' },
    { label: 'Total Comparadas',         value: totalComparadas,  icon: GitCompareArrows, color: 'text-indigo-700',  bg: 'bg-indigo-50',  ring: 'border-indigo-200',  href: '/comparacion' },
    { label: 'Comparadas CON diferencia',value: compConDif,       icon: AlertTriangle,    color: 'text-rose-600',    bg: 'bg-rose-50',    ring: 'border-rose-200',    href: '/comparacion' },
    { label: 'Comparadas SIN diferencia',value: compSinDif,       icon: ShieldCheck,      color: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'border-emerald-200', href: '/comparacion' },
  ]

  const recientes = comparaciones.slice(0, 5)

  // Distribución para el gráfico circular (dona) del dashboard
  const totalFacturas = facturas.length || 1
  const pctConDif  = (compConDif  / totalFacturas) * 100
  const pctSinComp = (sinComparar / totalFacturas) * 100
  const corteConDif  = pctConDif
  const corteSinComp = pctConDif + pctSinComp
  const donaEstilo = facturas.length === 0
    ? { background: '#e5e7eb' }
    : { background: `conic-gradient(#ef4444 0% ${corteConDif}%, #f59e0b ${corteConDif}% ${corteSinComp}%, #10b981 ${corteSinComp}% 100%)` }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-6 shadow-lg">
        <Calculator size={140} className="absolute -right-4 -bottom-8 text-white/10 z-0" />
        <div className="relative z-10">
          <h1 className="text-3xl font-extrabold text-white drop-shadow-sm">Dashboard</h1>
          <p className="text-blue-100 text-sm mt-1">Resumen del sistema de conciliación de facturas</p>
        </div>
      </div>

      {/* Verificación: Total = Sin comparar + Con dif + Sin dif */}
      <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-lg px-4 py-2 text-xs text-indigo-700 flex gap-6">
        <span>Total: <b>{facturas.length}</b></span>
        <span>=</span>
        <span>Sin comparar: <b>{sinComparar}</b></span>
        <span>+</span>
        <span>Con diferencia: <b>{compConDif}</b></span>
        <span>+</span>
        <span>Sin diferencia: <b>{compSinDif}</b></span>
        <span className={facturas.length === sinComparar + compConDif + compSinDif ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'}>
          {facturas.length === sinComparar + compConDif + compSinDif ? '✓ Cuadra' : '⚠ No cuadra'}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg, ring, href }) => (
          <Link key={label} href={href}>
            <Card className={`hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer border-2 ${ring}`}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2.5 rounded-lg ${bg} shrink-0`}>
                  <Icon className={color} size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-500 leading-tight">{label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-2 border-fuchsia-200 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-fuchsia-50 to-pink-50">
            <CardTitle className="text-base text-fuchsia-800 flex items-center gap-2">
              <PieChartIcon size={16} className="text-fuchsia-600" /> Distribución de facturas
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5 flex items-center justify-center gap-8">
            <div className="w-32 h-32 rounded-full shrink-0" style={donaEstilo}>
              <div className="w-full h-full rounded-full bg-white/95 flex flex-col items-center justify-center scale-[0.7] shadow-inner">
                <span className="text-2xl font-bold text-gray-900">{facturas.length}</span>
                <span className="text-[10px] text-gray-500 leading-tight">facturas</span>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" /> Con diferencias: <b>{compConDif}</b></p>
              <p className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" /> Sin comparar: <b>{sinComparar}</b></p>
              <p className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" /> Sin diferencias: <b>{compSinDif}</b></p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-slate-300 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-100 to-gray-100">
            <CardTitle className="text-base text-slate-800 flex items-center gap-2">
              <TrafficCone size={16} className="text-slate-600" /> Semáforo de estado
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5 flex items-center justify-center gap-8">
            <div className="flex flex-col items-center gap-3 bg-slate-800 rounded-2xl p-3 shadow-inner">
              <div className={`w-9 h-9 rounded-full ${compConDif > 0 ? 'bg-red-500 shadow-[0_0_14px_4px_rgba(239,68,68,0.6)]' : 'bg-red-950'}`} />
              <div className={`w-9 h-9 rounded-full ${sinComparar > 0 ? 'bg-amber-400 shadow-[0_0_14px_4px_rgba(251,191,36,0.6)]' : 'bg-amber-950'}`} />
              <div className={`w-9 h-9 rounded-full ${compSinDif > 0 ? 'bg-emerald-500 shadow-[0_0_14px_4px_rgba(16,185,129,0.6)]' : 'bg-emerald-950'}`} />
            </div>
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" /> Con diferencias: <b>{compConDif}</b></p>
              <p className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" /> Sin comparar: <b>{sinComparar}</b></p>
              <p className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" /> Sin diferencias: <b>{compSinDif}</b></p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-2 border-violet-200 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-violet-50 to-indigo-50">
            <CardTitle className="text-base text-violet-800">Acciones rápidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-4">
            <Link href="/facturas" className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 border border-blue-200 transition-colors">
              <FileText size={18} className="text-blue-600" />
              <span className="text-sm font-medium">Subir facturas XML DIAN</span>
            </Link>
            <Link href="/recibos" className="flex items-center gap-3 p-3 rounded-lg hover:bg-green-50 border border-green-200 transition-colors">
              <PackageCheck size={18} className="text-green-600" />
              <span className="text-sm font-medium">Cargar recibos de mercancía</span>
            </Link>
            <Link href="/comparacion" className="flex items-center gap-3 p-3 rounded-lg hover:bg-orange-50 border border-orange-200 transition-colors">
              <AlertTriangle size={18} className="text-orange-600" />
              <span className="text-sm font-medium">Ejecutar comparación</span>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-2 border-sky-200 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-sky-50 to-emerald-50">
            <CardTitle className="text-base text-sky-800">Comparaciones recientes</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {recientes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Sin comparaciones aún</p>
            ) : (
              <div className="space-y-2">
                {recientes.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-gray-50 to-sky-50/50 border border-gray-100">
                    <div>
                      <p className="text-sm font-medium">{c.numeroFactura}</p>
                      <p className="text-xs text-gray-500">{c.proveedor}</p>
                    </div>
                    <Badge variant={c.estado === 'ok' ? 'default' : 'destructive'}>
                      {c.estado === 'ok' ? 'OK' : `${c.diferencias.length} dif.`}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
