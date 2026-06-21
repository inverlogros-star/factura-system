'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, PackageCheck, AlertTriangle, Clock, CheckCircle2, XCircle } from 'lucide-react'
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

  const pendientes = facturas.filter(f => f.estado === 'pendiente').length
  const conDiferencias = facturas.filter(f => f.estado === 'con_diferencias').length
  const conciliadas = facturas.filter(f => f.estado === 'conciliada').length
  const rechazadas = facturas.filter(f => f.estado === 'rechazada').length

  const stats = [
    { label: 'Total Facturas', value: facturas.length, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Recibos Cargados', value: recibos.length, icon: PackageCheck, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Pendientes', value: pendientes, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'Con Diferencias', value: conDiferencias, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Conciliadas', value: conciliadas, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Rechazadas', value: rechazadas, icon: XCircle, color: 'text-gray-600', bg: 'bg-gray-100' },
  ]

  const recientes = comparaciones.slice(0, 5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Resumen del sistema de conciliación de facturas</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`p-3 rounded-lg ${bg}`}>
                <Icon className={color} size={22} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-sm text-gray-500">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Acciones rápidas</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Link href="/facturas" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 border border-gray-200 transition-colors">
              <FileText size={18} className="text-blue-600" />
              <span className="text-sm font-medium">Subir facturas XML DIAN</span>
            </Link>
            <Link href="/recibos" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 border border-gray-200 transition-colors">
              <PackageCheck size={18} className="text-green-600" />
              <span className="text-sm font-medium">Cargar recibos de mercancía</span>
            </Link>
            <Link href="/comparacion" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 border border-gray-200 transition-colors">
              <AlertTriangle size={18} className="text-orange-600" />
              <span className="text-sm font-medium">Ejecutar comparación</span>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Comparaciones recientes</CardTitle></CardHeader>
          <CardContent>
            {recientes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Sin comparaciones aún</p>
            ) : (
              <div className="space-y-2">
                {recientes.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
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
