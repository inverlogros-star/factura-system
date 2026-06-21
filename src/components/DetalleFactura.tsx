'use client'
import { Badge } from '@/components/ui/badge'
import type { Factura } from '@/types'
import { X } from 'lucide-react'

export default function DetalleFactura({ factura, onClose }: { factura: Factura; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b bg-white shrink-0">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Factura {factura.numeroFactura}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{factura.proveedor} — NIT {factura.nitProveedor}</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant={factura.estado === 'conciliada' ? 'default' : factura.estado === 'con_diferencias' ? 'destructive' : 'secondary'}>
            {factura.estado}
          </Badge>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Contenido scrollable */}
      <div className="flex-1 overflow-auto p-8 space-y-6 bg-gray-50">
        {/* Tarjetas resumen */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Fecha emisión', value: factura.fecha },
            { label: 'Fecha vencimiento', value: factura.fechaVencimiento || '—' },
            { label: 'Subtotal', value: `$${Number(factura.subtotal).toLocaleString('es-CO')}` },
            { label: 'IVA', value: `$${Number(factura.impuestos).toLocaleString('es-CO')}` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-lg border p-4">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className="font-semibold text-gray-900">{value}</p>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <span className="text-blue-700 font-semibold text-lg">Total Factura</span>
          <span className="text-3xl font-bold text-blue-700">
            ${Number(factura.total).toLocaleString('es-CO')}
          </span>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="px-6 py-3 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-700">Productos ({factura.productos.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  {['Código', 'Descripción', 'Cantidad', 'Precio Unitario', 'Subtotal', 'IVA', 'Total'].map(h => (
                    <th key={h} className="text-left px-6 py-3 font-semibold text-gray-700 border-b whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {factura.productos.map((p, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'}>
                    <td className="px-6 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">{p.codigo}</td>
                    <td className="px-6 py-3 font-medium min-w-[200px]">{p.descripcion}</td>
                    <td className="px-6 py-3 text-right whitespace-nowrap">{p.cantidad}</td>
                    <td className="px-6 py-3 text-right whitespace-nowrap">${Number(p.precioUnitario).toLocaleString('es-CO')}</td>
                    <td className="px-6 py-3 text-right whitespace-nowrap">${Number(p.subtotal).toLocaleString('es-CO')}</td>
                    <td className="px-6 py-3 text-right whitespace-nowrap">${Number(p.impuesto).toLocaleString('es-CO')}</td>
                    <td className="px-6 py-3 text-right font-bold text-blue-700 whitespace-nowrap">
                      ${Number(p.total).toLocaleString('es-CO')}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-right font-bold text-gray-700">TOTAL FACTURA</td>
                  <td className="px-6 py-4 text-right font-bold text-blue-700 text-base">
                    ${Number(factura.total).toLocaleString('es-CO')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
