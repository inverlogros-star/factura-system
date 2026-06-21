'use client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import type { Factura } from '@/types'

export default function DetalleFactura({ factura, onClose }: { factura: Factura; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-screen h-screen max-w-none max-h-none m-0 rounded-none flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b bg-white shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg">Factura {factura.numeroFactura}</DialogTitle>
              <p className="text-sm text-gray-500 mt-0.5">{factura.proveedor} — NIT {factura.nitProveedor}</p>
            </div>
            <Badge>{factura.estado}</Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Encabezado */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Fecha emisión', value: factura.fecha },
              { label: 'Fecha vencimiento', value: factura.fechaVencimiento || '—' },
              { label: 'Subtotal', value: `$${Number(factura.subtotal).toLocaleString('es-CO')}` },
              { label: 'IVA', value: `$${Number(factura.impuestos).toLocaleString('es-CO')}` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">{label}</p>
                <p className="font-semibold text-sm mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 rounded-lg p-4 flex items-center justify-between">
            <span className="text-blue-700 font-semibold">Total Factura</span>
            <span className="text-2xl font-bold text-blue-700">
              ${Number(factura.total).toLocaleString('es-CO')}
            </span>
          </div>

          {/* Tabla de productos */}
          <div>
            <h3 className="font-semibold mb-3">Productos ({factura.productos.length})</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    {['Código', 'Descripción', 'Cantidad', 'Precio Unitario', 'Subtotal', 'IVA', 'Total'].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-semibold text-gray-700 border-b">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {factura.productos.map((p, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.codigo}</td>
                      <td className="px-4 py-3 font-medium">{p.descripcion}</td>
                      <td className="px-4 py-3 text-right">{p.cantidad}</td>
                      <td className="px-4 py-3 text-right">${Number(p.precioUnitario).toLocaleString('es-CO')}</td>
                      <td className="px-4 py-3 text-right">${Number(p.subtotal).toLocaleString('es-CO')}</td>
                      <td className="px-4 py-3 text-right">${Number(p.impuesto).toLocaleString('es-CO')}</td>
                      <td className="px-4 py-3 text-right font-semibold text-blue-700">
                        ${Number(p.total).toLocaleString('es-CO')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100 font-semibold border-t-2">
                  <tr>
                    <td colSpan={6} className="px-4 py-3 text-right">TOTAL FACTURA</td>
                    <td className="px-4 py-3 text-right text-blue-700">
                      ${Number(factura.total).toLocaleString('es-CO')}
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
