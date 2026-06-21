'use client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { ReciboMercancia } from '@/types'

export default function DetalleRecibo({ recibo, onClose }: { recibo: ReciboMercancia; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Recibo {recibo.numeroRecibo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-500">Proveedor:</span> <span className="font-medium">{recibo.proveedor}</span></div>
            <div><span className="text-gray-500">NIT:</span> <span className="font-medium">{recibo.nitProveedor}</span></div>
            <div><span className="text-gray-500">Fecha:</span> <span className="font-medium">{recibo.fecha}</span></div>
            <div><span className="text-gray-500">Total:</span> <span className="font-bold text-green-700">${recibo.total.toLocaleString('es-CO')}</span></div>
          </div>
          <div>
            <h3 className="font-semibold text-sm mb-2">Productos ({recibo.productos.length})</h3>
            <table className="w-full text-xs border rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  {['Código', 'Descripción', 'Cantidad', 'P. Unitario', 'Subtotal'].map(h => (
                    <th key={h} className="text-left px-3 py-2 font-medium text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recibo.productos.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono">{p.codigo}</td>
                    <td className="px-3 py-2">{p.descripcion}</td>
                    <td className="px-3 py-2 text-right">{p.cantidad}</td>
                    <td className="px-3 py-2 text-right">${p.precioUnitario.toLocaleString('es-CO')}</td>
                    <td className="px-3 py-2 text-right font-medium">${p.subtotal.toLocaleString('es-CO')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
