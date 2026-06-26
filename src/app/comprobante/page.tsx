'use client'
import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CalendarIcon, Printer, BookOpen, CheckCircle2, AlertTriangle } from 'lucide-react'
import { storeFacturas } from '@/lib/store'
import type { Factura } from '@/types'

function fmt(n: number) {
  return Math.round(n || 0).toLocaleString('es-CO')
}
function fmtD(n: number) {
  return Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function hoy()        { return new Date().toISOString().slice(0, 10) }
function primerDia()  { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }

interface LineaContable {
  factura: Factura
  base5:   number   // base imponible IVA 5%
  iva5:    number   // valor IVA 5%
  base19:  number   // base imponible IVA 19%
  iva19:   number   // valor IVA 19%
  base0:   number   // base exenta / 0%
  impo:    number   // impoconsumo
  ibua:    number   // IBUA
  icui:    number   // ICUI
  neto:    number   // CRÉDITO — total a pagar
  debito:  number   // suma de todos los débitos
}

function calcularLinea(f: Factura): LineaContable {
  let base5 = 0, iva5 = 0, base19 = 0, iva19 = 0, base0 = 0
  let impo = 0, ibua = 0, icui = 0

  for (const p of f.productos) {
    const tasa = (p as any).tasaIva ?? 0
    const ivaP = p.impuesto || 0
    const sub  = p.subtotal || 0
    if (tasa === 5)       { base5  += sub; iva5  += ivaP }
    else if (tasa === 19) { base19 += sub; iva19 += ivaP }
    else                  { base0  += sub }
    impo += (p as any).iconsumo || 0
    ibua += (p as any).ibua    || 0
    icui += (p as any).icui    || 0
  }

  // Si no hay desglose por producto, usar los totales de la factura
  if (f.productos.length === 0) {
    base19 = f.subtotal || 0
    iva19  = f.impuestos || 0
  }

  const neto   = Math.round(f.total)
  const debito = Math.round(base5 + iva5 + base19 + iva19 + base0 + impo + ibua + icui)
  return { factura: f, base5, iva5, base19, iva19, base0, impo, ibua, icui, neto, debito }
}

export default function ComprobantePage() {
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [desde, setDesde]       = useState(primerDia())
  const [hasta, setHasta]       = useState(hoy())

  useEffect(() => { storeFacturas.getAll().then(setFacturas) }, [])

  const lineas = useMemo<LineaContable[]>(() => {
    return facturas
      .filter(f => {
        const fecha = (f.fecha || '').slice(0, 10)
        const tipo  = f.tipoDocumento || 'factura'
        return fecha >= desde && fecha <= hasta && tipo === 'factura'
      })
      .map(calcularLinea)
      .sort((a, b) => (a.factura.fecha || '').localeCompare(b.factura.fecha || ''))
  }, [facturas, desde, hasta])

  // Totales
  const totBase5  = lineas.reduce((s, l) => s + l.base5,  0)
  const totIva5   = lineas.reduce((s, l) => s + l.iva5,   0)
  const totBase19 = lineas.reduce((s, l) => s + l.base19, 0)
  const totIva19  = lineas.reduce((s, l) => s + l.iva19,  0)
  const totBase0  = lineas.reduce((s, l) => s + l.base0,  0)
  const totImpo   = lineas.reduce((s, l) => s + l.impo,   0)
  const totIbua   = lineas.reduce((s, l) => s + l.ibua,   0)
  const totIcui   = lineas.reduce((s, l) => s + l.icui,   0)
  const totDebito = lineas.reduce((s, l) => s + l.debito, 0)
  const totNeto   = lineas.reduce((s, l) => s + l.neto,   0)
  const diferencia = totNeto - totDebito
  const cuadra     = Math.abs(diferencia) < 2

  function imprimir() {
    const filas = lineas.map(l => `
      <tr>
        <td>${l.factura.fecha}</td>
        <td>${l.factura.numeroFactura}</td>
        <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis">${l.factura.proveedor || '—'}</td>
        <td>${l.factura.nitProveedor || '—'}</td>
        <td class="r">${l.base5  > 0 ? fmt(l.base5)  : '—'}</td>
        <td class="r">${l.iva5   > 0 ? fmt(l.iva5)   : '—'}</td>
        <td class="r">${l.base19 > 0 ? fmt(l.base19) : '—'}</td>
        <td class="r">${l.iva19  > 0 ? fmt(l.iva19)  : '—'}</td>
        <td class="r">${l.impo   > 0 ? fmt(l.impo)   : '—'}</td>
        <td class="r">${l.ibua   > 0 ? fmt(l.ibua)   : '—'}</td>
        <td class="r">${l.icui   > 0 ? fmt(l.icui)   : '—'}</td>
        <td class="r deb">${fmt(l.debito)}</td>
        <td class="r cre">${fmt(l.neto)}</td>
      </tr>`).join('')

    const w = window.open('', '_blank', 'width=1200,height=800')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Comprobante Contable ${desde} al ${hasta}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:10px;color:#111;padding:15px}
  @page{size:landscape;margin:10mm}
  @media print{.no-print{display:none!important}}
  h1{font-size:15px;font-weight:bold;color:#1e3a8a}
  h2{font-size:11px;color:#475569;margin-top:3px}
  .periodo{font-size:10px;color:#64748b;margin-top:2px}
  table{width:100%;border-collapse:collapse;margin-top:12px;font-size:9px}
  thead th{background:#1e3a8a;color:#fff;padding:5px 4px;text-align:left;white-space:nowrap}
  thead th.r{text-align:right}
  thead .deb{background:#1e40af}
  thead .cre{background:#166534}
  tbody tr:nth-child(even){background:#f8fafc}
  tbody td{padding:3px 4px;border-bottom:1px solid #e2e8f0}
  .r{text-align:right}
  .deb{color:#1e3a8a;font-weight:bold}
  .cre{color:#15803d;font-weight:bold}
  tfoot td{background:#0f172a;color:#fff;font-weight:bold;padding:5px 4px;font-size:9.5px}
  tfoot .deb{background:#1e40af;color:#fff}
  tfoot .cre{background:#166534;color:#fff}
  .estado{margin-top:10px;padding:8px 14px;border-radius:6px;font-size:11px;font-weight:bold}
  .ok{background:#dcfce7;color:#166534;border:1px solid #86efac}
  .err{background:#fee2e2;color:#991b1b;border:1px solid #fca5a5}
  .btn{background:#1e3a8a;color:#fff;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;font-size:12px;margin-bottom:12px}
  .seccion{font-size:8px;font-weight:bold;text-transform:uppercase;color:#94a3b8;padding:2px 4px}
</style></head><body>
<button class="btn no-print" onclick="window.print()">🖨️ Imprimir</button>
<h1>SUPERMERCADOS PACARDYL — INVERSIONES LOGROS S.A.</h1>
<h2>COMPROBANTE CONTABLE — FACTURAS DE COMPRA</h2>
<p class="periodo">Período: ${desde} al ${hasta} &nbsp;|&nbsp; ${lineas.length} facturas &nbsp;|&nbsp; Generado: ${new Date().toLocaleString('es-CO')}</p>
<table>
  <thead>
    <tr>
      <th rowspan="2">Fecha</th>
      <th rowspan="2">No. Factura</th>
      <th rowspan="2">Proveedor</th>
      <th rowspan="2">NIT</th>
      <th colspan="2" class="r deb" style="text-align:center">IVA 5%</th>
      <th colspan="2" class="r deb" style="text-align:center">IVA 19%</th>
      <th rowspan="2" class="r deb">Impoconsumo</th>
      <th rowspan="2" class="r deb">IBUA</th>
      <th rowspan="2" class="r deb">ICUI</th>
      <th rowspan="2" class="r deb">DÉBITO TOTAL</th>
      <th rowspan="2" class="r cre">CRÉDITO<br>Neto a Pagar</th>
    </tr>
    <tr>
      <th class="r deb">Base 5%</th>
      <th class="r deb">IVA 5%</th>
      <th class="r deb">Base 19%</th>
      <th class="r deb">IVA 19%</th>
    </tr>
  </thead>
  <tbody>${filas}</tbody>
  <tfoot>
    <tr>
      <td colspan="4" style="text-align:right">TOTALES</td>
      <td class="r deb">${fmt(totBase5)}</td>
      <td class="r deb">${fmt(totIva5)}</td>
      <td class="r deb">${fmt(totBase19)}</td>
      <td class="r deb">${fmt(totIva19)}</td>
      <td class="r deb">${fmt(totImpo)}</td>
      <td class="r deb">${fmt(totIbua)}</td>
      <td class="r deb">${fmt(totIcui)}</td>
      <td class="r deb" style="font-size:11px">$${fmt(totDebito)}</td>
      <td class="r cre" style="font-size:11px">$${fmt(totNeto)}</td>
    </tr>
  </tfoot>
</table>
<div class="estado ${cuadra ? 'ok' : 'err'}">
  ${cuadra
    ? `✅ CUADRE CONTABLE CORRECTO — Débito $${fmt(totDebito)} = Crédito $${fmt(totNeto)}`
    : `⚠️ DIFERENCIA: Débito $${fmt(totDebito)} — Crédito $${fmt(totNeto)} = $${fmtD(diferencia)}`}
</div>
</body></html>`)
    w.document.close()
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BookOpen size={24} className="text-blue-700" /> Comprobante Contable
        </h1>
        <p className="text-gray-500 text-sm mt-1">Facturas de compra con desglose de IVA, impuestos y valor a pagar</p>
      </div>

      {/* Filtros */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardContent className="p-5">
          <div className="flex flex-wrap gap-6 items-end">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 flex items-center gap-1"><CalendarIcon size={12} /> Fecha inicial</label>
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 flex items-center gap-1"><CalendarIcon size={12} /> Fecha final</label>
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
            </div>
            <Button onClick={imprimir} className="bg-blue-700 hover:bg-blue-800 gap-2">
              <Printer size={16} /> Imprimir / PDF
            </Button>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold ${cuadra ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {cuadra ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              {cuadra ? 'Cuadre correcto' : `Diferencia: $${fmtD(diferencia)}`}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla contable */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">{lineas.length} facturas — {desde} al {hasta}</CardTitle>
            <div className="flex gap-4 text-xs">
              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded font-semibold">DÉBITO: ${fmt(totDebito)}</span>
              <span className="bg-green-100 text-green-700 px-2 py-1 rounded font-semibold">CRÉDITO: ${fmt(totNeto)}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {lineas.length === 0 ? (
            <p className="text-center text-gray-400 py-10 text-sm">Sin facturas en el período seleccionado.</p>
          ) : (
            <table className="w-full text-xs" style={{ minWidth: 1100 }}>
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Fecha</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">No. Factura</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 max-w-[160px]">Proveedor</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">NIT</th>
                  {/* DÉBITOS */}
                  <th colSpan={8} className="px-3 py-1 text-center font-bold text-blue-700 bg-blue-50 border-l border-blue-200">
                    DÉBITOS
                  </th>
                  {/* CRÉDITO */}
                  <th className="px-3 py-1 text-center font-bold text-green-700 bg-green-50 border-l border-green-200">
                    CRÉDITO
                  </th>
                </tr>
                <tr className="bg-gray-50 border-b text-gray-500">
                  <th colSpan={4}></th>
                  <th className="px-2 py-2 text-right bg-blue-50 text-blue-700">Base 5%</th>
                  <th className="px-2 py-2 text-right bg-blue-50 text-blue-700">IVA 5%</th>
                  <th className="px-2 py-2 text-right bg-blue-50 text-blue-700">Base 19%</th>
                  <th className="px-2 py-2 text-right bg-blue-50 text-blue-700">IVA 19%</th>
                  <th className="px-2 py-2 text-right bg-blue-50 text-blue-700">Impocons.</th>
                  <th className="px-2 py-2 text-right bg-blue-50 text-blue-700">IBUA</th>
                  <th className="px-2 py-2 text-right bg-blue-50 text-blue-700">ICUI</th>
                  <th className="px-2 py-2 text-right bg-blue-100 text-blue-800 font-bold">Total Déb.</th>
                  <th className="px-2 py-2 text-right bg-green-100 text-green-800 font-bold border-l border-green-200">Neto a Pagar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lineas.map((l, i) => (
                  <tr key={l.factura.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{l.factura.fecha}</td>
                    <td className="px-3 py-2 font-mono font-semibold">{l.factura.numeroFactura}</td>
                    <td className="px-3 py-2 max-w-[160px] truncate" title={l.factura.proveedor}>{l.factura.proveedor || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{l.factura.nitProveedor || '—'}</td>
                    <td className="px-2 py-2 text-right bg-blue-50">{l.base5  > 0 ? fmt(l.base5)  : <span className="text-gray-300">—</span>}</td>
                    <td className="px-2 py-2 text-right bg-blue-50 text-blue-700">{l.iva5   > 0 ? fmt(l.iva5)   : <span className="text-gray-300">—</span>}</td>
                    <td className="px-2 py-2 text-right bg-blue-50">{l.base19 > 0 ? fmt(l.base19) : <span className="text-gray-300">—</span>}</td>
                    <td className="px-2 py-2 text-right bg-blue-50 text-blue-700">{l.iva19  > 0 ? fmt(l.iva19)  : <span className="text-gray-300">—</span>}</td>
                    <td className="px-2 py-2 text-right bg-blue-50 text-orange-600">{l.impo   > 0 ? fmt(l.impo)   : <span className="text-gray-300">—</span>}</td>
                    <td className="px-2 py-2 text-right bg-blue-50 text-orange-600">{l.ibua   > 0 ? fmt(l.ibua)   : <span className="text-gray-300">—</span>}</td>
                    <td className="px-2 py-2 text-right bg-blue-50 text-orange-600">{l.icui   > 0 ? fmt(l.icui)   : <span className="text-gray-300">—</span>}</td>
                    <td className="px-2 py-2 text-right font-bold text-blue-700 bg-blue-100">{fmt(l.debito)}</td>
                    <td className="px-2 py-2 text-right font-bold text-green-700 bg-green-100 border-l border-green-200">{fmt(l.neto)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-300">
                <tr className="font-bold text-xs">
                  <td colSpan={4} className="px-3 py-3 text-right text-gray-700">TOTALES</td>
                  <td className="px-2 py-3 text-right bg-blue-50">{fmt(totBase5)}</td>
                  <td className="px-2 py-3 text-right bg-blue-50 text-blue-700">{fmt(totIva5)}</td>
                  <td className="px-2 py-3 text-right bg-blue-50">{fmt(totBase19)}</td>
                  <td className="px-2 py-3 text-right bg-blue-50 text-blue-700">{fmt(totIva19)}</td>
                  <td className="px-2 py-3 text-right bg-blue-50 text-orange-600">{fmt(totImpo)}</td>
                  <td className="px-2 py-3 text-right bg-blue-50 text-orange-600">{fmt(totIbua)}</td>
                  <td className="px-2 py-3 text-right bg-blue-50 text-orange-600">{fmt(totIcui)}</td>
                  <td className="px-2 py-3 text-right text-blue-800 bg-blue-100 text-sm">${fmt(totDebito)}</td>
                  <td className="px-2 py-3 text-right text-green-800 bg-green-100 border-l border-green-200 text-sm">${fmt(totNeto)}</td>
                </tr>
                <tr>
                  <td colSpan={13} className="px-3 py-2">
                    <div className={`flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg ${cuadra ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {cuadra
                        ? <><CheckCircle2 size={16} /> CUADRE CORRECTO — Débito ${fmt(totDebito)} = Crédito ${fmt(totNeto)}</>
                        : <><AlertTriangle size={16} /> DIFERENCIA: ${fmtD(Math.abs(diferencia))} — Revisar bases de impuestos</>}
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
