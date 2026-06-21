'use client'
import type { ReciboMercancia } from '@/types'
import { X } from 'lucide-react'

export default function DetalleRecibo({ recibo, onClose }: { recibo: ReciboMercancia; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b bg-white shrink-0">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Recibo {recibo.numeroRecibo}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{recibo.proveedor} — NIT {recibo.nitProveedor}</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
          <X size={20} />
        </button>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-auto p-8 space-y-6 bg-gray-50">
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Fecha recepción', value: recibo.fecha },
            { label: 'Proveedor', value: recibo.proveedor || '—' },
            { label: 'NIT', value: recibo.nitProveedor || '—' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-lg border p-4">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className="font-semibold text-gray-900">{value}</p>
            </div>
          ))}
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
          <span className="text-green-700 font-semibold text-lg">Total Recibido</span>
          <span className="text-3xl font-bold text-green-700">
            ${Number(recibo.total).toLocaleString('es-CO')}
          </span>
        </div>

        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="px-6 py-3 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-700">Productos ({recibo.productos.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  {['Código', 'Descripción', 'Cantidad', 'Precio Unitario', 'Subtotal'].map(h => (
                    <th key={h} className="text-left px-6 py-3 font-semibold text-gray-700 border-b whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recibo.productos.map((p, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white hover:bg-green-50' : 'bg-gray-50 hover:bg-green-50'}>
                    <td className="px-6 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">{p.codigo}</td>
                    <td className="px-6 py-3 font-medium min-w-[200px]">{p.descripcion}</td>
                    <td className="px-6 py-3 text-right whitespace-nowrap">{p.cantidad}</td>
                    <td className="px-6 py-3 text-right whitespace-nowrap">${Number(p.precioUnitario).toLocaleString('es-CO')}</td>
                    <td className="px-6 py-3 text-right font-bold text-green-700 whitespace-nowrap">
                      ${Number(p.subtotal).toLocaleString('es-CO')}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-right font-bold text-gray-700">TOTAL RECIBIDO</td>
                  <td className="px-6 py-4 text-right font-bold text-green-700 text-base">
                    ${Number(recibo.total).toLocaleString('es-CO')}
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
