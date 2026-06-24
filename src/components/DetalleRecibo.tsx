'use client'
import type { ReciboMercancia } from '@/types'
import { X, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

function fmt(n: number) {
  return Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function DetalleRecibo({ recibo, onClose }: { recibo: ReciboMercancia; onClose: () => void }) {

  function imprimir() {
    const ventana = window.open('', '_blank', 'width=900,height=700')
    if (!ventana) return

    const productosHTML = recibo.productos.length === 0
      ? `<tr><td colspan="5" style="text-align:center;padding:20px;color:#888">Sin líneas de detalle</td></tr>`
      : recibo.productos.map((p, i) => `
        <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
          <td style="padding:6px 8px;font-family:monospace;font-size:11px">${p.codigo || '—'}</td>
          <td style="padding:6px 8px;font-size:12px">${p.descripcion}</td>
          <td style="padding:6px 8px;text-align:right">${p.cantidad}</td>
          <td style="padding:6px 8px;text-align:right">$${fmt(p.precioUnitario)}</td>
          <td style="padding:6px 8px;text-align:right;font-weight:bold;color:#15803d">$${fmt(p.subtotal)}</td>
        </tr>`).join('')

    ventana.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Recibo ${recibo.numeroRecibo}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box }
    body { font-family: Arial, sans-serif; font-size:12px; color:#111; padding:20px }
    @media print {
      body { padding:10px }
      .no-print { display:none !important }
      @page { margin:15mm; size: A4 landscape }
    }
    .header { background:#15803d; color:#fff; padding:16px 20px; border-radius:6px; margin-bottom:16px }
    .header h1 { font-size:18px; font-weight:bold }
    .header h2 { font-size:11px; font-weight:normal; margin-top:4px; opacity:0.85 }
    .header .titulo { font-size:13px; margin-top:6px; font-weight:bold; letter-spacing:1px }
    .header .num { font-size:22px; font-weight:bold; margin-top:4px }
    .info-grid { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:12px; margin-bottom:16px }
    .info-box { background:#f1f5f9; border:1px solid #e2e8f0; border-radius:4px; padding:10px }
    .info-box .lbl { font-size:10px; color:#64748b; text-transform:uppercase; margin-bottom:3px }
    .info-box .val { font-size:13px; font-weight:bold }
    .info-box.destacado { background:#dcfce7; border-color:#86efac }
    .info-box.destacado .val { color:#15803d }
    .total-bar { background:#f0fdf4; border:2px solid #22c55e; border-radius:6px; padding:12px 20px;
                 display:flex; justify-content:space-between; align-items:center; margin-bottom:16px }
    .total-bar .lbl { font-size:14px; font-weight:bold; color:#15803d }
    .total-bar .val { font-size:26px; font-weight:bold; color:#15803d }
    table { width:100%; border-collapse:collapse; font-size:11px }
    thead th { background:#15803d; color:#fff; padding:8px; text-align:left; font-size:11px }
    thead th.r { text-align:right }
    tfoot td { background:#e2e8f0; font-weight:bold; padding:8px; border-top:2px solid #94a3b8 }
    tfoot td.r { text-align:right }
    .footer { margin-top:20px; border-top:1px solid #e2e8f0; padding-top:10px;
              display:flex; justify-content:space-between; color:#94a3b8; font-size:10px }
    .btn-print { background:#15803d; color:#fff; border:none; padding:10px 24px;
                 border-radius:6px; font-size:14px; cursor:pointer; margin-bottom:16px }
    .btn-print:hover { background:#166534 }
    .badge { background:#dcfce7; color:#15803d; border:1px solid #86efac;
             padding:3px 10px; border-radius:20px; font-size:13px; font-weight:bold; display:inline-block }
  </style>
</head>
<body>
  <button class="btn-print no-print" onclick="window.print()">🖨️ Imprimir</button>

  <div class="header">
    <h1>SUPERMERCADOS PACARDYL</h1>
    <h2>INVERSIONES LOGROS S.A. — NIT: 811.031.830-1</h2>
    <div class="titulo">RECIBO DE MERCANCÍA</div>
    <div class="num">No. ${recibo.numeroRecibo}</div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <div class="lbl">Proveedor</div>
      <div class="val">${recibo.proveedor || '—'}</div>
    </div>
    <div class="info-box">
      <div class="lbl">NIT Proveedor</div>
      <div class="val">${recibo.nitProveedor || '—'}</div>
    </div>
    <div class="info-box">
      <div class="lbl">Fecha recepción</div>
      <div class="val">${recibo.fecha || '—'}</div>
    </div>
    <div class="info-box destacado">
      <div class="lbl">No. Factura Proveedor</div>
      <div class="val"><span class="badge">${recibo.numeroFacturaProveedor || '—'}</span></div>
    </div>
  </div>

  <div class="total-bar">
    <span class="lbl">TOTAL RECIBIDO</span>
    <span class="val">$${fmt(recibo.total)}</span>
  </div>

  <table>
    <thead>
      <tr>
        <th>Código de Barras</th>
        <th>Descripción</th>
        <th class="r">Cantidad</th>
        <th class="r">Precio Unitario</th>
        <th class="r">Subtotal</th>
      </tr>
    </thead>
    <tbody>${productosHTML}</tbody>
    <tfoot>
      <tr>
        <td colspan="4" class="r">TOTAL RECIBIDO</td>
        <td class="r" style="color:#15803d">$${fmt(recibo.total)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <span>SUPERMERCADOS PACARDYL — INVERSIONES LOGROS S.A. — Recibo No. ${recibo.numeroRecibo}</span>
    <span>Factura Prov: ${recibo.numeroFacturaProveedor || '—'} | Generado: ${new Date().toLocaleString('es-CO')}</span>
  </div>
</body>
</html>`)
    ventana.document.close()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b bg-white shrink-0">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Recibo {recibo.numeroRecibo}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{recibo.proveedor} — NIT {recibo.nitProveedor}</p>
        </div>
        <div className="flex items-center gap-3">
          {recibo.numeroFacturaProveedor && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
              <span className="text-xs text-green-600 font-medium">No. Factura:</span>
              <span className="font-bold text-green-700 font-mono text-lg">{recibo.numeroFacturaProveedor}</span>
            </div>
          )}
          <Button variant="outline" onClick={imprimir} className="gap-2">
            <Printer size={16} /> Imprimir
          </Button>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-auto p-8 space-y-6 bg-gray-50">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Fecha recepción', value: recibo.fecha || '—' },
            { label: 'Proveedor', value: recibo.proveedor || '—' },
            { label: 'NIT', value: recibo.nitProveedor || '—' },
            { label: 'No. Factura Proveedor', value: recibo.numeroFacturaProveedor || '—', destacado: true },
          ].map(({ label, value, destacado }) => (
            <div key={label} className={`rounded-lg border p-4 ${destacado ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className={`font-semibold text-lg ${destacado ? 'text-green-700 font-mono' : 'text-gray-900'}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
          <span className="text-green-700 font-semibold text-lg">Total Recibido</span>
          <span className="text-3xl font-bold text-green-700">${fmt(recibo.total)}</span>
        </div>

        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="px-6 py-3 border-b bg-gray-50 flex items-center justify-between">
            <h3 className="font-semibold text-gray-700">Productos ({recibo.productos.length})</h3>
            <span className="text-sm text-gray-400">Valores en COP</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  {['Código de Barras', 'Descripción', 'Cantidad', 'Precio Unitario', 'Subtotal'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-gray-700 border-b whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recibo.productos.map((p, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white hover:bg-green-50' : 'bg-gray-50 hover:bg-green-50'}>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-600 whitespace-nowrap">{p.codigo || '—'}</td>
                    <td className="px-4 py-2.5 font-medium min-w-[200px]">{p.descripcion}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">{p.cantidad}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">${fmt(p.precioUnitario)}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-green-700 whitespace-nowrap">${fmt(p.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right font-bold text-gray-700">TOTAL RECIBIDO</td>
                  <td className="px-4 py-3 text-right font-bold text-green-700 text-base">${fmt(recibo.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
