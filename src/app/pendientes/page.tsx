'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, AlertCircle } from 'lucide-react'
import { storeFacturas } from '@/lib/store'
import type { Factura } from '@/types'

export default function PendientesPage() {
  const [pendientes, setPendientes] = useState<Factura[]>([])

  useEffect(() => {
    storeFacturas.getAll().then(all => setPendientes(all.filter(f => f.estado === 'pendiente')))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Facturas Pendientes</h1>
        <p className="text-gray-500 text-sm mt-1">Facturas sin recibo de mercancía asociado</p>
      </div>

      {pendientes.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Clock size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No hay facturas pendientes.</p>
            <p className="text-sm text-gray-400">Todas las facturas han sido conciliadas.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertCircle size={18} className="text-yellow-600" />
            <p className="text-sm text-yellow-800 font-medium">
              {pendientes.length} factura(s) esperando recibo de mercancía
            </p>
          </div>
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['No. Factura','Proveedor','NIT','Fecha','Total','Estado','Días en espera'].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pendientes.map(f => {
                    const dias = Math.floor((Date.now() - new Date(f.creadoEn).getTime()) / 86400000)
                    return (
                      <tr key={f.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono font-medium">{f.numeroFactura}</td>
                        <td className="px-4 py-3">{f.proveedor || '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{f.nitProveedor || '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{f.fecha}</td>
                        <td className="px-4 py-3 font-medium">${Number(f.total).toLocaleString('es-CO')}</td>
                        <td className="px-4 py-3"><Badge variant="secondary">Pendiente</Badge></td>
                        <td className="px-4 py-3">
                          <span className={`font-medium ${dias > 7 ? 'text-red-600' : dias > 3 ? 'text-yellow-600' : 'text-gray-600'}`}>
                            {dias} día(s)
                          </span>
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
