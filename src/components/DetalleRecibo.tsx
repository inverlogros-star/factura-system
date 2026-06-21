'use client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { ReciboMercancia } from '@/types'

export default function DetalleRecibo({ recibo, onClose }: { recibo: ReciboMercancia; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-screen h-screen max-w-none max-h-none m-0 rounded-none flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b bg-white shrink-0">
          <div>
            <DialogTitle className="text-lg">Recibo {recibo.numeroRecibo}</DialogTitle>
            <p className="text-sm text-gray-500 mt-0.5">{recibo.proveedor} — NIT {recibo.nitProveedor}</p>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Fecha recepción', value: recibo.fecha },
              { label: 'Proveedor', value: recibo.proveedor || '—' },
              { label: 'NIT', value: recibo.nitProveedor || '—' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">{label}</p>
                <p className="font-semibold text-sm mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          <div className="bg-green-50 rounded-lg p-4 flex items-center justify-between">
            <span className="text-green-700 font-semibold">Total Recibido</span>
            <span className="text-2xl font-bold text-green-700">
              ${Number(recibo.total).toLocaleString('es-CO')}
            </span>
          </div>

          <div>
            <h3 className="font-semibold mb-3">Productos ({recibo.productos.length})</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    {['Código', 'Descripción', 'Cantidad', 'Precio Unitario', 'Subtotal'].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-semibold text-gray-700 border-b">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recibo.productos.map((p, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white hover:bg-green-50' : 'bg-gray-50 hover:bg-green-50'}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.codigo}</td>
                      <td className="px-4 py-3 font-medium">{p.descripcion}</td>
                      <td className="px-4 py-3 text-right">{p.cantidad}</td>
                      <td className="px-4 py-3 text-right">${Number(p.precioUnitario).toLocaleString('es-CO')}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-700">
                        ${Number(p.subtotal).toLocaleString('es-CO')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100 font-semibold border-t-2">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-right">TOTAL RECIBIDO</td>
                    <td className="px-4 py-3 text-right text-green-700">
                      ${Number(recibo.total).toLocaleString('es-CO')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
