'use client'
import type { ResultadoComparacion, Diferencia, Factura } from '@/types'

function fmt(n: number): string {
  return Number(n).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const TIPO_LABEL: Record<string, string> = {
  cantidad: 'CANTIDAD',
  precio: 'PRECIO',
  presentacion: 'PRESENTACIÓN',
  codigo_producto: 'CÓDIGO',
  producto_no_encontrado: 'NO ENCONTRADO',
}

export async function generarInformePDF(
  resultado: ResultadoComparacion,
  factura: Factura
) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const fechaHoy = new Date().toLocaleDateString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  // ── ENCABEZADO ──────────────────────────────────────────────────────────────
  doc.setFillColor(30, 64, 175)
  doc.rect(0, 0, pageW, 26, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.text('SUPERMERCADOS PACARDYL', 14, 10)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('INVERSIONES LOGROS S.A.', 14, 17)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('INFORME DE DIFERENCIAS EN FACTURACIÓN', 14, 23)

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.text(`Generado: ${fechaHoy}`, pageW - 14, 17, { align: 'right' })
  doc.text(`Proveedor: ${resultado.proveedor || '—'}`, pageW - 14, 23, { align: 'right' })

  // ── INFO FACTURA / RECIBO ────────────────────────────────────────────────────
  doc.setTextColor(0, 0, 0)
  let y = 33

  doc.setFillColor(241, 245, 249)
  doc.rect(10, y - 4, pageW - 20, 20, 'F')
  doc.setDrawColor(200, 210, 230)
  doc.rect(10, y - 4, pageW - 20, 20, 'S')

  const col1 = 14, col2 = 95, col3 = 180

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.text('No. Factura:', col1, y)
  doc.setFont('helvetica', 'normal')
  doc.text(resultado.numeroFactura, col1 + 24, y)

  doc.setFont('helvetica', 'bold')
  doc.text('Últimos 4 dígitos:', col1, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.text(resultado.numeroFactura.slice(-4), col1 + 34, y + 6)

  doc.setFont('helvetica', 'bold')
  doc.text('No. Recibo:', col2, y)
  doc.setFont('helvetica', 'normal')
  doc.text(resultado.numeroRecibo, col2 + 22, y)

  doc.setFont('helvetica', 'bold')
  doc.text('Total Mercancía Factura:', col2, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.text(`$${fmt(factura.subtotal)}`, col2 + 46, y + 6)

  doc.setFont('helvetica', 'bold')
  doc.text('IVA Facturado:', col3, y)
  doc.setFont('helvetica', 'normal')
  doc.text(`$${fmt(factura.impuestos)}`, col3 + 28, y)

  doc.setFont('helvetica', 'bold')
  doc.text('Total Factura:', col3, y + 6)
  doc.setFontSize(9)
  doc.setTextColor(30, 64, 175)
  doc.setFont('helvetica', 'bold')
  doc.text(`$${fmt(factura.total)}`, col3 + 27, y + 6)
  doc.setTextColor(0, 0, 0)

  y += 6
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.text('Total Recibo:', col1, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.text(`$${fmt(resultado.valorTotalRecibo)}`, col1 + 25, y + 6)

  doc.setFont('helvetica', 'bold')
  doc.text('Diferencia Total:', col2, y + 6)
  const diffColor = resultado.valorDiferenciaTotal !== 0 ? [185, 28, 28] as const : [21, 128, 61] as const
  doc.setTextColor(diffColor[0], diffColor[1], diffColor[2])
  doc.setFont('helvetica', 'bold')
  doc.text(`$${fmt(resultado.valorDiferenciaTotal)}`, col2 + 32, y + 6)
  doc.setTextColor(0, 0, 0)

  y += 18

  // ── TABLA DETALLE ────────────────────────────────────────────────────────────
  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'bold')
  doc.text(`DIFERENCIAS POR CÓDIGO DE PRODUCTO (${resultado.diferencias.length})`, 14, y)
  y += 3

  // Totales por tipo
  let totalDifCantidad = 0, ivasDifCantidad = 0
  let totalDifPrecio = 0, ivasDifPrecio = 0
  let totalDifPresentacion = 0, ivasDifPresentacion = 0
  let totalDifNoEncontrado = 0, ivasDifNoEncontrado = 0

  const rows = resultado.diferencias.map((d: Diferencia) => {
    const valDif = d.valorDiferenciaTotal ?? 0
    // IVA real: buscar en la factura el producto por código
    const prodFactura = factura.productos.find(p => p.codigo === d.codigoFactura)
    const ivaReal = prodFactura
      ? (prodFactura.impuesto / (prodFactura.cantidad || 1)) * (d.cantidadFacturada ?? prodFactura.cantidad)
      : 0

    if (d.tipoDiferencia === 'cantidad') { totalDifCantidad += valDif; ivasDifCantidad += ivaReal }
    else if (d.tipoDiferencia === 'precio') { totalDifPrecio += valDif; ivasDifPrecio += ivaReal }
    else if (d.tipoDiferencia === 'presentacion') { totalDifPresentacion += valDif; ivasDifPresentacion += ivaReal }
    else { totalDifNoEncontrado += valDif; ivasDifNoEncontrado += ivaReal }

    const totalConIva = valDif + ivaReal

    return [
      d.codigoFactura || d.codigoRecibo || '—',
      d.descripcion,
      TIPO_LABEL[d.tipoDiferencia] || d.tipoDiferencia,
      d.cantidadRecibida !== undefined ? String(d.cantidadRecibida) : '—',
      d.cantidadFacturada !== undefined ? String(d.cantidadFacturada) : '—',
      d.precioRecibo !== undefined ? `$${fmt(d.precioRecibo)}` : '—',
      d.precioFactura !== undefined ? `$${fmt(d.precioFactura)}` : '—',
      `$${fmt(valDif)}`,
      `$${fmt(ivaReal)}`,
      `$${fmt(totalConIva)}`,
    ]
  })

  autoTable(doc, {
    startY: y,
    head: [[
      'Código', 'Descripción', 'Tipo', 'Cant.\nRecibida', 'Cant.\nFacturada',
      'Precio\nRecibo', 'Precio\nFactura', 'Vlr. Diferencia', 'IVA\nFacturado', 'Total\nDif. + IVA',
    ]],
    body: rows,
    styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
    columnStyles: {
      0: { cellWidth: 26, font: 'courier', fontSize: 6.5 },
      1: { cellWidth: 60 },
      2: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
      3: { cellWidth: 18, halign: 'right' },
      4: { cellWidth: 18, halign: 'right' },
      5: { cellWidth: 24, halign: 'right' },
      6: { cellWidth: 24, halign: 'right' },
      7: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
      8: { cellWidth: 22, halign: 'right' },
      9: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 2) {
        const tipo = String(data.cell.raw)
        if (tipo === 'CANTIDAD') data.cell.styles.textColor = [180, 100, 0]
        else if (tipo === 'PRECIO') data.cell.styles.textColor = [185, 28, 28]
        else if (tipo === 'PRESENTACIÓN') data.cell.styles.textColor = [109, 40, 217]
        else if (tipo === 'NO ENCONTRADO') data.cell.styles.textColor = [220, 38, 38]
      }
      if (data.section === 'body' && (data.column.index === 7 || data.column.index === 9)) {
        const raw = String(data.cell.raw).replace(/[$.,\s]/g, '')
        const val = parseFloat(raw)
        if (val > 0) data.cell.styles.textColor = [185, 28, 28]
        else if (val < 0) data.cell.styles.textColor = [21, 128, 61]
      }
    },
    margin: { left: 10, right: 10 },
  })

  // ── TOTALES ─────────────────────────────────────────────────────────────────
  const finalY = (doc as any).lastAutoTable.finalY + 6

  const totalDif = totalDifCantidad + totalDifPrecio + totalDifPresentacion + totalDifNoEncontrado
  const totalIva = ivasDifCantidad + ivasDifPrecio + ivasDifPresentacion + ivasDifNoEncontrado

  autoTable(doc, {
    startY: finalY,
    head: [['CONCEPTO', 'VALOR DIFERENCIA MERCANCÍA', 'IVA FACTURADO', 'TOTAL (MERCANCÍA + IVA)']],
    body: [
      ['Diferencias por Cantidad',    `$${fmt(totalDifCantidad)}`,     `$${fmt(ivasDifCantidad)}`,     `$${fmt(totalDifCantidad + ivasDifCantidad)}`],
      ['Diferencias por Precio',      `$${fmt(totalDifPrecio)}`,       `$${fmt(ivasDifPrecio)}`,       `$${fmt(totalDifPrecio + ivasDifPrecio)}`],
      ['Diferencias por Presentación',`$${fmt(totalDifPresentacion)}`, `$${fmt(ivasDifPresentacion)}`, `$${fmt(totalDifPresentacion + ivasDifPresentacion)}`],
      ['Productos No Encontrados',    `$${fmt(totalDifNoEncontrado)}`, `$${fmt(ivasDifNoEncontrado)}`, `$${fmt(totalDifNoEncontrado + ivasDifNoEncontrado)}`],
      ['TOTAL GENERAL',               `$${fmt(totalDif)}`,            `$${fmt(totalIva)}`,            `$${fmt(totalDif + totalIva)}`],
    ],
    styles: { fontSize: 8.5, cellPadding: 3, halign: 'right' },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold', cellWidth: 80 },
      1: { cellWidth: 60 },
      2: { cellWidth: 50 },
      3: { cellWidth: 60 },
    },
    bodyStyles: { fillColor: [248, 250, 252] },
    didParseCell(data) {
      if (data.section === 'body' && data.row.index === 4) {
        data.cell.styles.fillColor = [30, 64, 175]
        data.cell.styles.textColor = [255, 255, 255]
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fontSize = 9
      }
    },
    margin: { left: 10, right: 10 },
  })

  // ── PIE ──────────────────────────────────────────────────────────────────────
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(130, 130, 130)
    doc.setFont('helvetica', 'normal')
    const ph = doc.internal.pageSize.getHeight()
    doc.text(`SUPERMERCADOS PACARDYL — INVERSIONES LOGROS S.A. — Factura ${resultado.numeroFactura} — Recibo ${resultado.numeroRecibo}`, 14, ph - 5)
    doc.text(`Página ${i} de ${pages}`, pageW - 14, ph - 5, { align: 'right' })
  }

  const nombreArchivo = `Diferencias_PACARDYL_${resultado.numeroFactura.slice(-4)}_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(nombreArchivo)
}
