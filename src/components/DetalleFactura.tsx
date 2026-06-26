'use client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Factura } from '@/types'
import { X, Printer } from 'lucide-react'

function fmt(n: number) {
  return Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const TIPO_LABEL: Record<string, string> = {
  factura: 'FACTURA ELECTRÓNICA DE VENTA',
  nota_credito: 'NOTA CRÉDITO ELECTRÓNICA',
  nota_debito: 'NOTA DÉBITO ELECTRÓNICA',
  otro: 'DOCUMENTO ELECTRÓNICO',
}

export default function DetalleFactura({ factura, onClose }: { factura: Factura; onClose: () => void }) {
  const tipo = factura.tipoDocumento || 'factura'
  const tituloDoc = TIPO_LABEL[tipo] || 'DOCUMENTO'

  function imprimir() {
    const ventana = window.open('', '_blank', 'width=900,height=700')
    if (!ventana) return

    const productosHTML = factura.productos.length === 0
      ? `<tr><td colspan="9" style="text-align:center;padding:20px;color:#888">Sin líneas de detalle</td></tr>`
      : factura.productos.map((p, i) => {
        // Calcular tasa IVA usando ivaValor (IVA puro, sin otros impuestos)
        const ivaV = (p as any).ivaValor ?? p.impuesto
        let tasa = (p as any).tasaIva ?? 0
        if (tasa === 0 && ivaV > 0 && p.subtotal > 0) {
          const c = Math.round((ivaV / p.subtotal) * 100)
          if (c >= 4 && c <= 6)       tasa = 5
          else if (c >= 17 && c <= 21) tasa = 19
        }
        return `
        <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
          <td style="padding:6px 8px;font-family:monospace;font-size:11px">${p.codigo || '—'}</td>
          <td style="padding:6px 8px;font-size:12px">${p.descripcion}</td>
          <td style="padding:6px 8px;text-align:right">${p.cantidad}</td>
          <td style="padding:6px 8px;text-align:right">$${fmt(p.precioUnitario)}</td>
          <td style="padding:6px 8px;text-align:right;color:#c05000">${p.descuento > 0 ? `-$${fmt(p.descuento)}` : '—'}</td>
          <td style="padding:6px 8px;text-align:right">$${fmt(p.subtotal)}</td>
          <td style="padding:6px 8px;text-align:right;color:#6d28d9;font-weight:bold">${tasa > 0 ? tasa+'%' : '0%'}</td>
          <td style="padding:6px 8px;text-align:right;color:#6d28d9">$${fmt(ivaV)}</td>
          <td style="padding:6px 8px;text-align:right;font-weight:bold;color:#1e40af">$${fmt(p.total)}</td>
        </tr>`
      }).join('')

    ventana.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${tituloDoc} ${factura.numeroFactura}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box }
    body { font-family: Arial, sans-serif; font-size:12px; color:#111; padding:20px }
    @media print {
      body { padding:10px }
      .no-print { display:none !important }
      @page { size: landscape; margin: 12mm }
    }
    /* Forzar horizontal en pantalla también */
    @page { size: landscape; margin: 12mm }
    .header { background:#1e40af; color:#fff; padding:16px 20px; border-radius:6px; margin-bottom:16px }
    .header h1 { font-size:18px; font-weight:bold }
    .header h2 { font-size:11px; font-weight:normal; margin-top:4px; opacity:0.85 }
    .header .tipo { font-size:13px; margin-top:6px; font-weight:bold; letter-spacing:1px }
    .header .num { font-size:22px; font-weight:bold; margin-top:4px }
    .info-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:16px }
    .info-box { background:#f1f5f9; border:1px solid #e2e8f0; border-radius:4px; padding:10px }
    .info-box .lbl { font-size:10px; color:#64748b; text-transform:uppercase; margin-bottom:3px }
    .info-box .val { font-size:13px; font-weight:bold }
    .total-bar { background:#eff6ff; border:2px solid #3b82f6; border-radius:6px; padding:12px 20px;
                 display:flex; justify-content:space-between; align-items:center; margin-bottom:16px }
    .total-bar .lbl { font-size:14px; font-weight:bold; color:#1e40af }
    .total-bar .val { font-size:26px; font-weight:bold; color:#1e40af }
    table { width:100%; border-collapse:collapse; font-size:11px }
    thead th { background:#1e40af; color:#fff; padding:8px; text-align:left; font-size:11px }
    thead th.r { text-align:right }
    tfoot td { background:#e2e8f0; font-weight:bold; padding:8px; border-top:2px solid #94a3b8 }
    tfoot td.r { text-align:right }
    .footer { margin-top:20px; border-top:1px solid #e2e8f0; padding-top:10px;
              display:flex; justify-content:space-between; color:#94a3b8; font-size:10px }
    .btn-print { background:#1e40af; color:#fff; border:none; padding:10px 24px;
                 border-radius:6px; font-size:14px; cursor:pointer; margin-bottom:16px }
    .btn-print:hover { background:#1e3a8a }
  </style>
</head>
<body>
  <button class="btn-print no-print" onclick="window.print()">🖨️ Imprimir (Horizontal)</button>

  <div class="header">
    <h1>SUPERMERCADOS PACARDYL</h1>
    <h2>INVERSIONES LOGROS S.A. — NIT: 811.031.830-1</h2>
    <div class="tipo">${tituloDoc}</div>
    <div class="num">No. ${factura.numeroFactura}</div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <div class="lbl">Proveedor</div>
      <div class="val">${factura.proveedor || '—'}</div>
    </div>
    <div class="info-box">
      <div class="lbl">NIT Proveedor</div>
      <div class="val">${factura.nitProveedor || '—'}</div>
    </div>
    <div class="info-box">
      <div class="lbl">Fecha emisión</div>
      <div class="val">${factura.fecha || '—'}</div>
    </div>
    <div class="info-box">
      <div class="lbl">Fecha vencimiento</div>
      <div class="val">${factura.fechaVencimiento || '—'}</div>
    </div>
    <div class="info-box">
      <div class="lbl">Subtotal (sin IVA)</div>
      <div class="val">$${fmt(factura.subtotal)}</div>
    </div>
    <div class="info-box">
      <div class="lbl">IVA Total</div>
      <div class="val" style="color:#6d28d9">$${fmt(factura.impuestos)}</div>
    </div>
  </div>

  <div class="total-bar">
    <span class="lbl">TOTAL ${tituloDoc}</span>
    <span class="val">$${fmt(factura.total)}</span>
  </div>

  <table>
    <thead>
      <tr>
        <th>Código</th>
        <th>Descripción</th>
        <th class="r">Cant.</th>
        <th class="r">Precio Unit.</th>
        <th class="r">Descuento</th>
        <th class="r">Subtotal</th>
        <th class="r">% IVA</th>
        <th class="r">IVA</th>
        <th class="r">Total Línea</th>
      </tr>
    </thead>
    <tbody>${productosHTML}</tbody>
    <tfoot>
      <tr>
        <td colspan="5" class="r">TOTALES</td>
        <td class="r">$${fmt(factura.subtotal)}</td>
        <td></td>
        <td class="r" style="color:#6d28d9">$${fmt(factura.impuestos)}</td>
        <td class="r" style="color:#1e40af">$${fmt(factura.total)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <span>SUPERMERCADOS PACARDYL — INVERSIONES LOGROS S.A.</span>
    <span>Documento: ${factura.numeroFactura} | Generado: ${new Date().toLocaleString('es-CO')}</span>
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
          <h2 className="text-xl font-bold text-gray-900">
            {tituloDoc} {factura.numeroFactura}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">{factura.proveedor} — NIT {factura.nitProveedor}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={factura.estado === 'conciliada' ? 'default' : factura.estado === 'con_diferencias' ? 'destructive' : 'secondary'}>
            {factura.estado}
          </Badge>
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
            { label: 'Fecha emisión', value: factura.fecha },
            { label: 'Fecha vencimiento', value: factura.fechaVencimiento || '—' },
            { label: 'Subtotal (sin IVA)', value: `$${fmt(factura.subtotal)}` },
            { label: 'IVA facturado', value: `$${fmt(factura.impuestos)}` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-lg border p-4">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className="font-semibold text-gray-900">{value}</p>
            </div>
          ))}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <span className="text-blue-700 font-semibold text-lg">Total {tituloDoc}</span>
          <span className="text-3xl font-bold text-blue-700">${fmt(factura.total)}</span>
        </div>

        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="px-6 py-3 border-b bg-gray-50 flex items-center justify-between">
            <h3 className="font-semibold text-gray-700">Productos / Servicios ({factura.productos.length})</h3>
            <span className="text-sm text-gray-400">Valores en COP</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  {['Código', 'Descripción', 'Cantidad', 'Precio Unit.', 'Descuento', 'Subtotal', '% IVA', 'IVA', 'Total Línea'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-gray-700 border-b whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {factura.productos.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Sin líneas de detalle</td></tr>
                ) : factura.productos.map((p, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'}>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-600 whitespace-nowrap">{p.codigo || '—'}</td>
                    <td className="px-4 py-2.5 font-medium min-w-[200px]">{p.descripcion}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">{p.cantidad}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">${fmt(p.precioUnitario)}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap text-orange-600">{p.descuento > 0 ? `-$${fmt(p.descuento)}` : '—'}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">${fmt(p.subtotal)}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap font-bold text-purple-700">
                      {(() => {
                        let tasa = (p as any).tasaIva ?? 0
                        // Usar ivaValor (IVA puro) para calcular la tasa — NO impuesto que incluye otros tributos
                        const ivaP = (p as any).ivaValor ?? p.impuesto
                        if (tasa === 0 && ivaP > 0 && p.subtotal > 0) {
                          const c = Math.round((ivaP / p.subtotal) * 100)
                          if (c >= 4 && c <= 6)       tasa = 5
                          else if (c >= 17 && c <= 21) tasa = 19
                        }
                        return tasa > 0 ? `${tasa}%` : '0%'
                      })()}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap text-purple-600">
                      ${fmt((p as any).ivaValor ?? p.impuesto)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-blue-700 whitespace-nowrap">${fmt(p.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-right font-bold text-gray-600">Subtotal</td>
                  <td className="px-4 py-3 text-right font-bold">${fmt(factura.subtotal)}</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-right font-bold text-purple-600">${fmt(factura.impuestos)}</td>
                  <td className="px-4 py-3 text-right font-bold text-blue-700 text-base">${fmt(factura.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── Resumen de impuestos agrupado por tasa ── */}
        {(() => {
          const grupos: Record<number, { base: number; iva: number }> = {}
          for (const p of factura.productos) {
            let tasa = (p as any).tasaIva ?? 0
            const ivaP = (p as any).ivaValor ?? p.impuesto
            // Usar ivaValor (IVA puro) para calcular la tasa
            if (tasa === 0 && ivaP > 0 && p.subtotal > 0) {
              const c = Math.round((ivaP / p.subtotal) * 100)
              if (c >= 4 && c <= 6)       tasa = 5
              else if (c >= 17 && c <= 21) tasa = 19
            }
            if (!grupos[tasa]) grupos[tasa] = { base: 0, iva: 0 }
            grupos[tasa].base += p.subtotal
            grupos[tasa].iva  += ivaP  // usar ivaValor, no impuesto total
          }
          const tasas = Object.entries(grupos).sort(([a], [b]) => Number(a) - Number(b))
          if (tasas.length === 0) return null
          return (
            <div className="flex justify-end">
              <div className="bg-white rounded-lg border overflow-hidden w-full max-w-lg">
                <div className="px-5 py-2.5 bg-gray-50 border-b">
                  <h3 className="font-semibold text-gray-700 text-sm">Liquidación de Impuestos</h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Concepto</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Base gravable</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">% IVA</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Valor IVA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tasas.map(([tasa, d]) => (
                      <tr key={tasa} className="hover:bg-purple-50">
                        <td className="px-4 py-2.5 text-gray-700 font-medium">
                          {Number(tasa) === 0 ? 'Exento / No gravado' : `Gravado IVA ${tasa}%`}
                        </td>
                        <td className="px-4 py-2.5 text-right">${fmt(d.base)}</td>
                        <td className="px-4 py-2.5 text-right text-purple-600 font-bold">{tasa}%</td>
                        <td className="px-4 py-2.5 text-right font-bold text-purple-700">${fmt(d.iva)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-200">
                    <tr className="bg-gray-50">
                      <td className="px-4 py-2.5 font-bold text-gray-700">Subtotal mercancía</td>
                      <td className="px-4 py-2.5 text-right font-bold">${fmt(factura.subtotal)}</td>
                      <td></td>
                      <td></td>
                    </tr>
                    <tr className="bg-purple-50">
                      <td className="px-4 py-2.5 font-bold text-purple-700">Total IVA</td>
                      <td></td>
                      <td></td>
                      <td className="px-4 py-2.5 text-right font-bold text-purple-700">${fmt(factura.impuestos)}</td>
                    </tr>
                    <tr className="bg-blue-600 text-white">
                      <td className="px-4 py-3 font-bold text-base" colSpan={3}>TOTAL A PAGAR</td>
                      <td className="px-4 py-3 text-right font-bold text-xl">${fmt(factura.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
