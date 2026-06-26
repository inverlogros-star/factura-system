'use client'
import type { ReciboMercancia } from '@/types'
import { X, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fmtRecibo } from '@/lib/utils'

function fmt(n: number | undefined) {
  return Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtN(n: number | undefined) {
  if (!n || n === 0) return null
  return fmt(n)
}

export default function DetalleRecibo({ recibo, onClose }: { recibo: ReciboMercancia; onClose: () => void }) {
  const t = recibo.totales

  // Fecha y hora del recibo (tal como viene del sistema)
  const fechaRecibo = recibo.fecha || '—'
  // Fecha y hora de generación del documento
  const ahora = new Date()
  const fechaGeneracion = ahora.toLocaleDateString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'America/Bogota'
  })
  const horaGeneracion = ahora.toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: 'America/Bogota'
  })

  // Agrupar IVA por tasa desde productos (EntDet_Iva = tasa %, TotalVrIva = valor)
  const prods = recibo.productos as any[]
  const tasas5    = prods.filter(p => Number(p.tasaIva) === 5)
  const tasas19   = prods.filter(p => Number(p.tasaIva) === 19)
  // Valor IVA: usar TotalVrIva (p.iva) si > 0, si no calcular desde base
  const ivaTotal5  = tasas5.reduce((s, p)  => s + (Number(p.iva) > 0 ? Number(p.iva) : Number(p.baseIva || 0) * 0.05), 0)
  const ivaTotal19 = tasas19.reduce((s, p) => s + (Number(p.iva) > 0 ? Number(p.iva) : Number(p.baseIva || 0) * 0.19), 0)
  // Si no hay desglose por tasa, usar header total
  const ivaHeaderTotal = Math.round(t?.iva ?? 0)
  const ivaTotal5Final  = Math.round(ivaTotal5)
  const ivaTotal19Final = Math.round(ivaTotal19)
  // Si la suma de 5%+19% no cuadra con header, repartir proporcional
  const ivaLineasTotal = ivaTotal5Final + ivaTotal19Final
  const ivaFinal5  = ivaHeaderTotal > 0 && ivaLineasTotal === 0
    ? Math.round(ivaHeaderTotal * (tasas5.length  / (prods.length || 1)))
    : ivaTotal5Final
  const ivaFinal19 = ivaHeaderTotal > 0 && ivaLineasTotal === 0
    ? ivaHeaderTotal - ivaFinal5
    : ivaTotal19Final
  // Totales de impuestos
  const totalIbua = Math.round(t?.ibua ?? prods.reduce((s, p) => s + (Number(p.ibua) || 0), 0))
  const totalIcui = Math.round(t?.icui ?? prods.reduce((s, p) => s + (Number(p.icui) || 0), 0))
  const totalIconsumo = Math.round(t?.iconsumo ?? prods.reduce((s, p) => s + (Number(p.iconsumo) || 0), 0))
  const totalDescuentos = Math.round(t?.descuentos ?? prods.reduce((s, p) => s + (Number(p.descuento) || 0), 0))
  const totalBruto = Math.round(t?.bruto ?? prods.reduce((s, p) => s + (Number(p.totalBruto) || 0), 0))
  const subtotalNeto = Math.round(t?.subtotalNeto ?? (totalBruto - totalDescuentos))

  function imprimir() {
    const ventana = window.open('', '_blank', 'width=1000,height=700')
    if (!ventana) return

    const impuestosFilas = [
      t?.descuentos  ? `<tr><td>(-) Descuentos proveedores</td><td style="color:#c05000">-$${fmt(t.descuentos)}</td></tr>` : '',
      ivaTotal5  > 0 ? `<tr><td>IVA 5%</td><td>$${fmt(ivaTotal5)}</td></tr>` : '',
      ivaTotal19 > 0 ? `<tr><td>IVA 19%</td><td>$${fmt(ivaTotal19)}</td></tr>` : '',
      t?.iconsumo ? `<tr><td>Impoconsumo</td><td>$${fmt(t.iconsumo)}</td></tr>` : '',
      t?.ibua     ? `<tr><td>IBUA</td><td>$${fmt(t.ibua)}</td></tr>` : '',
      t?.icui     ? `<tr><td>ICUI</td><td>$${fmt(t.icui)}</td></tr>` : '',
      t?.estampillas ? `<tr><td>Estampillas</td><td>$${fmt(t.estampillas)}</td></tr>` : '',
    ].filter(Boolean).join('')

    const productosHTML = recibo.productos.map((p: any, i: number) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
        <td style="padding:5px 6px;font-family:monospace;font-size:10px">${p.codigo || '—'}</td>
        <td style="padding:5px 6px;font-size:11px">${p.descripcion}</td>
        <td style="padding:5px 6px;text-align:right;color:#94a3b8">${p.cantidadPedida || '—'}</td>
        <td style="padding:5px 6px;text-align:right;font-weight:bold;color:#15803d">${p.cantidad}</td>
        <td style="padding:5px 6px;text-align:right">$${fmt(p.totalBruto ?? p.cantidad * p.costoBruto)}</td>
        <td style="padding:5px 6px;text-align:right;color:#c05000">${p.descuento > 0 ? `-$${fmt(p.descuento)}` : '—'}</td>
        <td style="padding:5px 6px;text-align:right">$${fmt(p.baseIva ?? (p.totalBruto - p.descuento))}</td>
        <td style="padding:5px 6px;text-align:right">${p.tasaIva > 0 ? p.tasaIva+'%' : '—'}</td>
        <td style="padding:5px 6px;text-align:right;color:#7c3aed">${fmtN(p.iva) ? '$'+fmt(p.iva) : '—'}</td>
        <td style="padding:5px 6px;text-align:right;color:#0369a1">${fmtN(p.iconsumo) ? '$'+fmt(p.iconsumo) : '—'}</td>
        <td style="padding:5px 6px;text-align:right;color:#0369a1">${fmtN(p.ibua) ? '$'+fmt(p.ibua) : '—'}</td>
        <td style="padding:5px 6px;text-align:right;color:#0369a1">${fmtN(p.icui) ? '$'+fmt(p.icui) : '—'}</td>
        <td style="padding:5px 6px;text-align:right;font-weight:bold;color:#15803d">$${fmt(p.subtotal)}</td>
      </tr>`).join('')

    ventana.document.write(`<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<title>Recibo ${recibo.numeroRecibo.slice(2)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:15px}
  @page{size:landscape;margin:12mm}
  @media print{body{padding:8px}.no-print{display:none!important}@page{size:landscape;margin:12mm}}
  .hdr{background:#15803d;color:#fff;padding:12px 16px;border-radius:6px;margin-bottom:12px}
  .hdr h1{font-size:16px}.hdr h2{font-size:10px;opacity:.85;margin-top:3px}
  .hdr .t{font-size:12px;margin-top:5px;font-weight:bold}.hdr .n{font-size:20px;font-weight:bold}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
  .box{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:4px;padding:8px}
  .box .l{font-size:9px;color:#64748b;text-transform:uppercase}.box .v{font-size:12px;font-weight:bold}
  .box.hl{background:#dcfce7;border-color:#86efac}.box.hl .v{color:#15803d;font-size:15px}
  table{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:12px}
  thead th{background:#15803d;color:#fff;padding:6px;text-align:left}
  thead th.r{text-align:right}
  tfoot td{background:#f1f5f9;font-weight:bold;padding:6px;border-top:2px solid #94a3b8}
  .res{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .res table{font-size:11px}
  .res table td{padding:5px 8px;border-bottom:1px solid #f1f5f9}
  .res table td:last-child{text-align:right;font-weight:bold}
  .total-row td{background:#dcfce7;color:#15803d;font-weight:bold;font-size:13px}
  .btn{background:#15803d;color:#fff;border:none;padding:8px 20px;border-radius:6px;font-size:13px;cursor:pointer;margin-bottom:12px}
  .ftr{margin-top:12px;border-top:1px solid #e2e8f0;padding-top:8px;display:flex;justify-content:space-between;color:#94a3b8;font-size:9px}
</style></head><body>
<button class="btn no-print" onclick="window.print()">🖨️ Imprimir (Horizontal)</button>
<div class="hdr">
  <h1>SUPERMERCADOS PACARDYL</h1>
  <h2>INVERSIONES LOGROS S.A. — NIT: 811.031.830-1</h2>
  <div class="t">RECIBO DE MERCANCÍA</div>
  <div class="n">No. ${recibo.numeroRecibo.slice(2)}</div>
</div>
<div class="grid">
  <div class="box"><div class="l">Proveedor</div><div class="v">${recibo.proveedor || '—'}</div></div>
  <div class="box"><div class="l">NIT Proveedor</div><div class="v">${recibo.nitProveedor || '—'}</div></div>
  <div class="box hl"><div class="l">📅 Fecha del Recibo</div><div class="v" style="color:#15803d;font-size:15px">${fechaRecibo}</div></div>
  <div class="box hl"><div class="l">No. Factura Proveedor</div><div class="v">${recibo.numeroFacturaProveedor || '—'}</div></div>
</div>
<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:5px;padding:7px 14px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
  <span style="color:#15803d;font-size:12px"><b>Fecha del Recibo de Mercancía:</b>&nbsp;${fechaRecibo}</span>
  <span style="color:#94a3b8;font-size:11px"><b>Documento generado:</b>&nbsp;${fechaGeneracion},&nbsp;${horaGeneracion}</span>
</div>
<table>
  <thead><tr>
    <th>Código</th><th>Descripción</th><th class="r">Cant.Ped.</th><th class="r">Cant.Rec.</th>
    <th class="r">P. Bruto</th><th class="r">Descuento</th><th class="r">Base IVA</th>
    <th class="r">% IVA</th><th class="r">IVA</th>
    <th class="r">Impocons.</th><th class="r">IBUA</th><th class="r">ICUI</th>
    <th class="r">Total Neto</th>
  </tr></thead>
  <tbody>${productosHTML}</tbody>
  <tfoot><tr>
    <td colspan="12" style="text-align:right">SUBTOTAL NETO</td>
    <td style="text-align:right;color:#15803d">$${fmt(t?.subtotalNeto ?? recibo.total)}</td>
  </tr></tfoot>
</table>
<div class="res">
  <div></div>
  <table>
    <tr><td>Subtotal bruto</td><td>$${fmt(t?.bruto ?? 0)}</td></tr>
    ${t?.descuentos ? `<tr><td style="color:#c05000">(-) Descuentos</td><td style="color:#c05000">-$${fmt(t.descuentos)}</td></tr>` : ''}
    <tr><td>Subtotal neto</td><td>$${fmt(t?.subtotalNeto ?? 0)}</td></tr>
    ${impuestosFilas}
    <tr class="total-row"><td>TOTAL A PAGAR</td><td>$${fmt(recibo.total)}</td></tr>
  </table>
</div>
<div class="ftr">
  <span>SUPERMERCADOS PACARDYL — Recibo No. ${recibo.numeroRecibo.slice(2)} — Factura: ${recibo.numeroFacturaProveedor || '—'}</span>
  <span>Generado: ${new Date().toLocaleString('es-CO')}</span>
</div>
</body></html>`)
    ventana.document.close()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b bg-white shrink-0">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Recibo {fmtRecibo(recibo.numeroRecibo)}</h2>
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
        {/* Info principal */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: '📅 Fecha del Recibo',    value: fechaRecibo,                           destacado: true },
            { label: 'Proveedor',              value: recibo.proveedor || '—' },
            { label: 'NIT',                    value: recibo.nitProveedor || '—' },
            { label: 'No. Factura Proveedor',  value: recibo.numeroFacturaProveedor || '—', destacado: true },
          ].map(({ label, value, destacado }) => (
            <div key={label} className={`rounded-lg border p-4 ${destacado ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className={`font-semibold text-lg ${destacado ? 'text-green-700 font-mono' : 'text-gray-900'}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Tabla de productos */}
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="px-6 py-3 border-b bg-gray-50 flex items-center justify-between">
            <h3 className="font-semibold text-gray-700">Productos ({recibo.productos.length})</h3>
            <span className="text-xs text-gray-400">Valores en COP</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-100">
                <tr>
                  {['Código', 'Descripción', 'C.Ped', 'C.Rec', 'SubTotal Bruto', 'Desc.', '%IVA', 'IVA', 'IBUA', 'ICUI', 'Total Neto'].map(h => (
                    <th key={h} className="text-left px-2 py-2.5 font-semibold text-gray-700 border-b whitespace-nowrap text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recibo.productos.map((p: any, i: number) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white hover:bg-green-50' : 'bg-gray-50 hover:bg-green-50'}>
                    <td className="px-2 py-2 font-mono text-gray-600 whitespace-nowrap text-xs">{p.codigo || '—'}</td>
                    <td className="px-2 py-2 font-medium min-w-[160px] text-xs">{p.descripcion}</td>
                    {/* Cant. Pedida (EntDet_CanPed) */}
                    <td className="px-2 py-2 text-right text-gray-400 text-xs">{p.cantidadPedida > 0 ? p.cantidadPedida : '—'}</td>
                    {/* Cant. Recibida (EntDet_CanRec) */}
                    <td className="px-2 py-2 text-right font-bold text-green-700 text-xs">{p.cantidad}</td>
                    {/* SubTotal Bruto (EntDet_TotalBruto) */}
                    <td className="px-2 py-2 text-right text-xs">${fmt(Number(p.totalBruto) || p.cantidad * (Number(p.costoBruto) || 0))}</td>
                    {/* Descuento */}
                    <td className="px-2 py-2 text-right text-orange-600 text-xs">{Number(p.descuento) > 0 ? `-$${fmt(p.descuento)}` : '—'}</td>
                    {/* %IVA (EntDet_Iva = tasa) */}
                    <td className="px-2 py-2 text-right font-bold text-purple-700 text-xs">{Number(p.tasaIva) > 0 ? `${p.tasaIva}%` : '0%'}</td>
                    {/* IVA valor (TotalVrIva) */}
                    <td className="px-2 py-2 text-right text-purple-600 text-xs">{Number(p.iva) > 0 ? `$${fmt(p.iva)}` : '—'}</td>
                    {/* IBUA (TotalVrIBUA) */}
                    <td className="px-2 py-2 text-right text-blue-600 text-xs">{Number(p.ibua) > 0 ? `$${fmt(p.ibua)}` : '—'}</td>
                    {/* ICUI (TotalVrICUI) */}
                    <td className="px-2 py-2 text-right text-blue-600 text-xs">{Number(p.icui) > 0 ? `$${fmt(p.icui)}` : '—'}</td>
                    {/* Total Neto (EntDet_TotalNeto) */}
                    <td className="px-2 py-2 text-right font-bold text-green-700 text-xs">${fmt(p.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                <tr>
                  <td colSpan={11} className="px-3 py-3 text-right font-bold text-gray-600">Subtotal Neto</td>
                  <td className="px-3 py-3 text-right font-bold text-green-700">${fmt(t?.subtotalNeto ?? recibo.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Resumen de liquidación por renglones separados */}
        <div className="flex justify-end">
          <div className="bg-white rounded-lg border overflow-hidden w-full max-w-lg">
            <div className="px-5 py-2.5 bg-gray-50 border-b">
              <h3 className="font-semibold text-gray-700 text-sm">Liquidación del Recibo</h3>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                {/* Subtotal Bruto */}
                <tr>
                  <td className="px-5 py-2 text-gray-600 text-xs font-semibold uppercase tracking-wide">SubTotal Bruto</td>
                  <td className="px-5 py-2 text-right font-bold">${fmt(totalBruto)}</td>
                </tr>
                {/* Descuentos */}
                {totalDescuentos > 0 && (
                  <tr>
                    <td className="px-5 py-2 text-orange-600">(-) Descuentos proveedores</td>
                    <td className="px-5 py-2 text-right font-medium text-orange-600">-${fmt(totalDescuentos)}</td>
                  </tr>
                )}
                {/* Subtotal Neto */}
                <tr className="bg-gray-50">
                  <td className="px-5 py-2 font-semibold text-gray-700">SubTotal Neto</td>
                  <td className="px-5 py-2 text-right font-semibold">${fmt(subtotalNeto)}</td>
                </tr>
                {/* IVA 5% - renglón separado */}
                {(ivaFinal5 > 0 || tasas5.length > 0) && (
                  <tr>
                    <td className="px-5 py-2 text-purple-700 font-medium">
                      IVA 5%
                      {tasas5.length > 0 && <span className="text-xs text-gray-400 ml-2">({tasas5.length} producto(s))</span>}
                    </td>
                    <td className="px-5 py-2 text-right font-bold text-purple-700">${fmt(ivaFinal5)}</td>
                  </tr>
                )}
                {/* IVA 19% - renglón separado */}
                {(ivaFinal19 > 0 || tasas19.length > 0) && (
                  <tr>
                    <td className="px-5 py-2 text-purple-700 font-medium">
                      IVA 19%
                      {tasas19.length > 0 && <span className="text-xs text-gray-400 ml-2">({tasas19.length} producto(s))</span>}
                    </td>
                    <td className="px-5 py-2 text-right font-bold text-purple-700">${fmt(ivaFinal19)}</td>
                  </tr>
                )}
                {/* Si hay IVA total pero sin desglose por tasa */}
                {ivaHeaderTotal > 0 && ivaFinal5 === 0 && ivaFinal19 === 0 && (
                  <tr>
                    <td className="px-5 py-2 text-purple-700 font-medium">IVA Total</td>
                    <td className="px-5 py-2 text-right font-bold text-purple-700">${fmt(ivaHeaderTotal)}</td>
                  </tr>
                )}
                {/* Impoconsumo */}
                {totalIconsumo > 0 && (
                  <tr>
                    <td className="px-5 py-2 text-blue-600">Impoconsumo</td>
                    <td className="px-5 py-2 text-right font-medium text-blue-600">${fmt(totalIconsumo)}</td>
                  </tr>
                )}
                {/* IBUA - renglón separado */}
                {totalIbua > 0 && (
                  <tr>
                    <td className="px-5 py-2 text-blue-600">IBUA</td>
                    <td className="px-5 py-2 text-right font-medium text-blue-600">${fmt(totalIbua)}</td>
                  </tr>
                )}
                {/* ICUI - renglón separado */}
                {totalIcui > 0 && (
                  <tr>
                    <td className="px-5 py-2 text-blue-600">ICUI</td>
                    <td className="px-5 py-2 text-right font-medium text-blue-600">${fmt(totalIcui)}</td>
                  </tr>
                )}
                {/* Estampillas */}
                {(t?.estampillas ?? 0) > 0 && (
                  <tr>
                    <td className="px-5 py-2 text-blue-600">Estampillas</td>
                    <td className="px-5 py-2 text-right font-medium text-blue-600">${fmt(t?.estampillas)}</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-green-700 text-white">
                  <td className="px-5 py-3 font-bold text-base">TOTAL A PAGAR</td>
                  <td className="px-5 py-3 text-right font-bold text-2xl">${fmt(recibo.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        {/* Pie con fechas */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t rounded-b-lg text-xs text-gray-500">
          <span>
            📅 <span className="font-semibold text-green-700">Fecha del Recibo:</span> {fechaRecibo}
          </span>
          <span>
            🖨️ <span className="font-semibold">Generado:</span> {fechaGeneracion}, {horaGeneracion}
          </span>
        </div>
      </div>
    </div>
  )
}
