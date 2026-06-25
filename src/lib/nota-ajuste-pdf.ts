'use client'
import type { NotaAjustePrecio } from '@/lib/comparador'

function fmt(n: number) {
  return Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export async function generarNotaAjustePDF(nota: NotaAjustePrecio) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const fechaHoy = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })

  // ── ENCABEZADO ──────────────────────────────────────────────────────────────
  doc.setFillColor(180, 60, 20)  // naranja oscuro
  doc.rect(0, 0, pageW, 26, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(15); doc.setFont('helvetica', 'bold')
  doc.text('SUPERMERCADOS PACARDYL', 14, 10)
  doc.setFontSize(10); doc.setFont('helvetica', 'normal')
  doc.text('INVERSIONES LOGROS S.A. — NIT: 811.031.830-1', 14, 17)
  doc.setFontSize(12); doc.setFont('helvetica', 'bold')
  doc.text('NOTA POR AJUSTE EN PRECIO', 14, 23)
  doc.setFontSize(8); doc.setFont('helvetica', 'normal')
  doc.text(`Generada: ${fechaHoy}`, pageW - 14, 23, { align: 'right' })

  // ── DATOS ────────────────────────────────────────────────────────────────────
  doc.setTextColor(0, 0, 0)
  let y = 32
  doc.setFillColor(241, 245, 249)
  doc.rect(10, y - 4, pageW - 20, 18, 'F')
  doc.setDrawColor(200, 210, 220)
  doc.rect(10, y - 4, pageW - 20, 18, 'S')

  const col = [14, 90, 165, 220]
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.text('Proveedor:', col[0], y); doc.setFont('helvetica', 'normal'); doc.text(nota.proveedor, col[0] + 22, y)
  doc.setFont('helvetica', 'bold')
  doc.text('NIT:', col[1], y); doc.setFont('helvetica', 'normal'); doc.text(nota.nitProveedor, col[1] + 10, y)
  doc.setFont('helvetica', 'bold')
  doc.text('Factura:', col[2], y); doc.setFont('helvetica', 'normal'); doc.text(nota.numeroFactura, col[2] + 18, y)
  doc.setFont('helvetica', 'bold')
  doc.text('Recibo:', col[3], y); doc.setFont('helvetica', 'normal'); doc.text(nota.numeroRecibo, col[3] + 16, y)

  y += 7
  doc.setFont('helvetica', 'bold')
  doc.text('Total Factura:', col[0], y); doc.setFont('helvetica', 'normal')
  doc.text(`$${fmt(nota.totalFactura)}`, col[0] + 28, y)
  doc.setFont('helvetica', 'bold')
  doc.text('Total Recibo:', col[1], y); doc.setFont('helvetica', 'normal')
  doc.text(`$${fmt(nota.totalRecibo)}`, col[1] + 26, y)
  doc.setFont('helvetica', 'bold')
  doc.text('Diferencia Neta:', col[2], y)
  doc.setTextColor(nota.diferenciaNeta > 0 ? 185 : 21, nota.diferenciaNeta > 0 ? 28 : 128, 60)
  doc.setFont('helvetica', 'bold')
  doc.text(`$${fmt(nota.diferenciaNeta)}`, col[2] + 32, y)
  doc.setTextColor(0, 0, 0)

  y += 12

  // ── TEXTO DE GLOSA ─────────────────────────────────────────────────────────
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('GLOSA:', 14, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  const glosa = `Se presenta nota de ajuste en precio por diferencias encontradas entre la factura No. ${nota.numeroFactura} del proveedor ${nota.proveedor} y el recibo de mercancía No. ${nota.numeroRecibo}. El valor total de la factura ($${fmt(nota.totalFactura)}) no coincide con el total del recibo ($${fmt(nota.totalRecibo)}), generando una diferencia neta de $${fmt(nota.diferenciaNeta)}. A continuación se detallan los productos con diferencias:`
  const lineasGlosa = doc.splitTextToSize(glosa, pageW - 28)
  doc.text(lineasGlosa, 14, y + 5)
  y += 5 + (lineasGlosa.length * 5) + 4

  // ── TABLA DETALLE ───────────────────────────────────────────────────────────
  const criterioLabel: Record<string, string> = { ean: 'EAN', descripcion: 'Desc.', no_encontrado: 'N/E' }

  const rows = nota.lineas.map(l => [
    l.codigoEAN || '—',
    criterioLabel[l.criterioMatch] || '—',
    l.descripcionFactura !== '—' ? l.descripcionFactura : l.descripcionRecibo,
    l.cantFacturada > 0 ? String(l.cantFacturada) : '—',
    l.cantRecibida > 0 ? String(l.cantRecibida) : '—',
    l.difCantidad !== 0 ? String(l.difCantidad) : '—',
    l.precioFactura > 0 ? `$${fmt(l.precioFactura)}` : '—',
    l.precioRecibo > 0 ? `$${fmt(l.precioRecibo)}` : '—',
    l.difPrecio !== 0 ? `$${fmt(l.difPrecio)}` : '—',
    l.difIva !== 0 ? `$${fmt(l.difIva)}` : '—',
    l.difIconsumo !== 0 ? `$${fmt(l.difIconsumo)}` : '—',
    l.difIbua !== 0 ? `$${fmt(l.difIbua)}` : '—',
    l.difIcui !== 0 ? `$${fmt(l.difIcui)}` : '—',
    l.difDescuento !== 0 ? `$${fmt(l.difDescuento)}` : '—',
    `$${fmt(l.diferenciaNeta)}`,
  ])

  autoTable(doc, {
    startY: y,
    head: [[
      'Código EAN', 'Match', 'Descripción',
      'Cant.Fact', 'Cant.Rec', 'Dif.Cant',
      'P.Fact', 'P.Rec', 'Dif.Precio',
      'Dif.IVA', 'Dif.Impc.', 'Dif.IBUA', 'Dif.ICUI', 'Dif.Desc.',
      'DIFERENCIA',
    ]],
    body: rows,
    styles: { fontSize: 6.5, cellPadding: 1.8, overflow: 'linebreak' },
    headStyles: { fillColor: [180, 60, 20], textColor: 255, fontStyle: 'bold', fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 22, font: 'courier' },
      1: { cellWidth: 12, halign: 'center' },
      2: { cellWidth: 52 },
      3: { cellWidth: 14, halign: 'right' },
      4: { cellWidth: 14, halign: 'right' },
      5: { cellWidth: 14, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 20, halign: 'right' },
      7: { cellWidth: 20, halign: 'right' },
      8: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
      9: { cellWidth: 16, halign: 'right' },
      10: { cellWidth: 16, halign: 'right' },
      11: { cellWidth: 14, halign: 'right' },
      12: { cellWidth: 14, halign: 'right' },
      13: { cellWidth: 16, halign: 'right' },
      14: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: [255, 247, 237] },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 14) {
        const raw = String(data.cell.raw).replace(/[$.,\s]/g, '')
        const val = parseFloat(raw)
        data.cell.styles.textColor = val > 0 ? [185, 28, 28] : val < 0 ? [21, 128, 61] : [0, 0, 0]
      }
    },
    margin: { left: 10, right: 10 },
  })

  // ── TOTALES RESUMEN ─────────────────────────────────────────────────────────
  const finalY = (doc as any).lastAutoTable.finalY + 5

  autoTable(doc, {
    startY: finalY,
    head: [['CONCEPTO', 'VALOR']],
    body: [
      ['Diferencia por cantidades', `$${fmt(nota.difCantidades)}`],
      ['Diferencia por precios', `$${fmt(nota.difPrecios)}`],
      ['Diferencia por impuestos (IVA, Impoconsumo, IBUA, ICUI)', `$${fmt(nota.difImpuestos)}`],
      ['Diferencia por descuentos', `$${fmt(nota.difDescuentos)}`],
      ['DIFERENCIA NETA TOTAL', `$${fmt(nota.diferenciaNeta)}`],
    ],
    styles: { fontSize: 9, cellPadding: 3, halign: 'right' },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { halign: 'left', cellWidth: 140 }, 1: { cellWidth: 50 } },
    bodyStyles: { fillColor: [255, 247, 237] },
    didParseCell(data) {
      if (data.section === 'body' && data.row.index === 4) {
        data.cell.styles.fillColor = [180, 60, 20]
        data.cell.styles.textColor = [255, 255, 255]
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fontSize = 10
      }
    },
    margin: { left: 10, right: 10 },
  })

  // ── PIE ──────────────────────────────────────────────────────────────────────
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(7); doc.setTextColor(130, 130, 130)
    const ph = doc.internal.pageSize.getHeight()
    doc.text(`PACARDYL — INVERSIONES LOGROS S.A. — Nota de Ajuste — Factura ${nota.numeroFactura} — Recibo ${nota.numeroRecibo}`, 14, ph - 5)
    doc.text(`Página ${i} de ${pages}`, pageW - 14, ph - 5, { align: 'right' })
  }

  const nombre = `NotaAjuste_PACARDYL_${nota.numeroFactura}_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(nombre)
}
