'use client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import type { Factura } from '@/types'

export default function DetalleFactura({ factura, onClose }: { factura: Factura; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Factura {factura.numeroFactura}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-500">Proveedor:</span> <span className="font-medium">{factura.proveedor}</span></div>
            <div><span className="text-gray-500">NIT:</span> <span className="font-medium">{factura.nitProveedor}</span></div>
            <div><span className="text-gray-500">Fecha:</span> <span className="font-medium">{factura.fecha}</span></div>
            <div><span className="text-gray-500">Vencimiento:</span> <span className="font-medium">{factura.fechaVencimiento || '—'}</span></div>
            <div><span className="text-gray-500">Total:</span> <span className="font-bold text-blue-700">${factura.total.toLocaleString('es-CO')}</span></div>
            <div><span className="text-gray-500">Estado:</span> <Badge>{factura.estado}</Badge></div>
          </div>
          <div>
            <h3 className="font-semibold text-sm mb-2">Productos ({factura.productos.length})</h3>
            <table className="w-full text-xs border rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  {['Código', 'Descripción', 'Cant.', 'P. Unitario', 'Subtotal', 'IVA', 'Total'].map(h => (
                    <th key={h} className="text-left px-3 py-2 font-medium text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {factura.productos.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono">{p.codigo}</td>
                    <td className="px-3 py-2">{p.descripcion}</td>
                    <td className="px-3 py-2 text-right">{p.cantidad}</td>
                    <td className="px-3 py-2 text-right">${p.precioUnitario.toLocaleString('es-CO')}</td>
                    <td className="px-3 py-2 text-right">${p.subtotal.toLocaleString('es-CO')}</td>
                    <td className="px-3 py-2 text-right">${p.impuesto.toLocaleString('es-CO')}</td>
                    <td className="px-3 py-2 text-right font-medium">${p.total.toLocaleString('es-CO')}</td>
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
