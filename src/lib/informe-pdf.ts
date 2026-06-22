'use client'
import type { ResultadoComparacion, Diferencia } from '@/types'

const TIPO_LABEL: Record<string, string> = {
  cantidad: 'CANTIDAD',
  precio: 'PRECIO',
  presentacion: 'PRESENTACIÓN',
  codigo_producto: 'CÓDIGO',
  producto_no_encontrado: 'NO ENCONTRADO',
}

function fmt(n: number): string {
  return n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export async function generarInformePDF(resultado: ResultadoComparacion, empresa: string) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const fechaHoy = new Date().toLocaleDateString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  // ── ENCABEZADO ──────────────────────────────────────────────────────────────
  doc.setFillColor(30, 64, 175) // azul
  doc.rect(0, 0, pageW, 22, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(empresa.toUpperCase(), 14, 10)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('INFORME DE DIFERENCIAS EN FACTURACIÓN', 14, 17)

  doc.setFontSize(9)
  doc.text(`Generado: ${fechaHoy}`, pageW - 14, 17, { align: 'right' })

  // ── INFO FACTURA / RECIBO ────────────────────────────────────────────────────
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')

  const col1 = 14, col2 = 100, col3 = 190
  let y = 30

  doc.setFillColor(241, 245, 249)
  doc.rect(10, y - 5, pageW - 20, 18, 'F')
  doc.setDrawColor(200, 200, 200)
  doc.rect(10, y - 5, pageW - 20, 18, 'S')

  doc.setFont('helvetica', 'bold')
  doc.text('Proveedor:', col1, y)
  doc.setFont('helvetica', 'normal')
  doc.text(resultado.proveedor || '—', col1 + 22, y)

  doc.setFont('helvetica', 'bold')
  doc.text('No. Factura:', col2, y)
  doc.setFont('helvetica', 'normal')
  doc.text(resultado.numeroFactura, col2 + 25, y)

  doc.setFont('helvetica', 'bold')
  doc.text('No. Recibo:', col3, y)
  doc.setFont('helvetica', 'normal')
  doc.text(resultado.numeroRecibo, col3 + 22, y)

  y += 8

  doc.setFont('helvetica', 'bold')
  doc.text('Total Factura:', col1, y)
  doc.setFont('helvetica', 'normal')
  doc.text(`$${fmt(resultado.valorTotalFactura)}`, col1 + 28, y)

  doc.setFont('helvetica', 'bold')
  doc.text('Total Recibo:', col2, y)
  doc.setFont('helvetica', 'normal')
  doc.text(`$${fmt(resultado.valorTotalRecibo)}`, col2 + 25, y)

  doc.setFont('helvetica', 'bold')
  doc.text('Diferencia Total:', col3, y)
  doc.setFontSize(9)
  const diffColor = resultado.valorDiferenciaTotal !== 0 ? [185, 28, 28] : [21, 128, 61]
  doc.setTextColor(diffColor[0], diffColor[1], diffColor[2])
  doc.setFont('helvetica', 'bold')
  doc.text(`$${fmt(resultado.valorDiferenciaTotal)}`, col3 + 32, y)
  doc.setTextColor(0, 0, 0)

  y += 12

  // ── TABLA DE DIFERENCIAS ────────────────────────────────────────────────────
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(`DETALLE DE DIFERENCIAS (${resultado.diferencias.length})`, 14, y)
  y += 4

  // Acumular totales por tipo
  let totalDifCantidad = 0
  let totalDifPrecio = 0
  let totalDifPresentacion = 0
  let totalDifNoEncontrado = 0

  const rows = resultado.diferencias.map((d: Diferencia) => {
    const valDif = d.valorDiferenciaTotal ?? 0
    if (d.tipoDiferencia === 'cantidad') totalDifCantidad += valDif
    else if (d.tipoDiferencia === 'precio') totalDifPrecio += valDif
    else if (d.tipoDiferencia === 'presentacion') totalDifPresentacion += valDif
    else totalDifNoEncontrado += valDif

    // Calcular IVA estimado (19% Colombia) sobre la diferencia
    const ivaEstimado = Math.abs(valDif) * 0.19

    return [
      d.codigoFactura || d.codigoRecibo || '—',
      d.descripcion,
      TIPO_LABEL[d.tipoDiferencia] || d.tipoDiferencia,
      d.cantidadRecibida !== undefined ? String(d.cantidadRecibida) : '—',
      d.cantidadFacturada !== undefined ? String(d.cantidadFacturada) : '—',
      d.precioRecibo !== undefined ? `$${fmt(d.precioRecibo)}` : '—',
      d.precioFactura !== undefined ? `$${fmt(d.precioFactura)}` : '—',
      `$${fmt(valDif)}`,
      `$${fmt(ivaEstimado)}`,
    ]
  })

  autoTable(doc, {
    startY: y,
    head: [[
      'Cód. Producto',
      'Descripción',
      'Tipo Diferencia',
      'Cant. Recibida',
      'Cant. Facturada',
      'Precio Recibo',
      'Precio Factura',
      'Vlr. Diferencia',
      'IVA (19%) Dif.',
    ]],
    body: rows,
    styles: { fontSize: 7.5, cellPadding: 2.5, overflow: 'linebreak' },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 24, font: 'courier' },
      1: { cellWidth: 65 },
      2: { cellWidth: 26, halign: 'center' },
      3: { cellWidth: 20, halign: 'right' },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 26, halign: 'right' },
      6: { cellWidth: 26, halign: 'right' },
      7: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
      8: { cellWidth: 26, halign: 'right' },
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
      if (data.section === 'body' && data.column.index === 7) {
        const val = parseFloat(String(data.cell.raw).replace(/[$.,\s]/g, '').replace(',', '.'))
        if (val > 0) data.cell.styles.textColor = [185, 28, 28]
        else if (val < 0) data.cell.styles.textColor = [21, 128, 61]
      }
    },
    margin: { left: 10, right: 10 },
  })

  // ── TOTALES ─────────────────────────────────────────────────────────────────
  const finalY = (doc as any).lastAutoTable.finalY + 8

  // Caja de totales
  const totalGeneral = totalDifCantidad + totalDifPrecio + totalDifPresentacion + totalDifNoEncontrado
  const ivaTotal = Math.abs(totalGeneral) * 0.19

  autoTable(doc, {
    startY: finalY,
    head: [['CONCEPTO', 'VALOR DIFERENCIA', 'IVA ESTIMADO (19%)', 'TOTAL CON IVA']],
    body: [
      ['Diferencias por Cantidad', `$${fmt(totalDifCantidad)}`, `$${fmt(Math.abs(totalDifCantidad) * 0.19)}`, `$${fmt(totalDifCantidad + Math.abs(totalDifCantidad) * 0.19)}`],
      ['Diferencias por Precio', `$${fmt(totalDifPrecio)}`, `$${fmt(Math.abs(totalDifPrecio) * 0.19)}`, `$${fmt(totalDifPrecio + Math.abs(totalDifPrecio) * 0.19)}`],
      ['Diferencias por Presentación', `$${fmt(totalDifPresentacion)}`, `$${fmt(Math.abs(totalDifPresentacion) * 0.19)}`, `$${fmt(totalDifPresentacion + Math.abs(totalDifPresentacion) * 0.19)}`],
      ['Productos No Encontrados', `$${fmt(totalDifNoEncontrado)}`, `$${fmt(Math.abs(totalDifNoEncontrado) * 0.19)}`, `$${fmt(totalDifNoEncontrado + Math.abs(totalDifNoEncontrado) * 0.19)}`],
      ['TOTAL GENERAL', `$${fmt(totalGeneral)}`, `$${fmt(ivaTotal)}`, `$${fmt(totalGeneral + ivaTotal)}`],
    ],
    styles: { fontSize: 8.5, cellPadding: 3, halign: 'right' },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold', cellWidth: 80 },
      1: { cellWidth: 50 },
      2: { cellWidth: 50 },
      3: { cellWidth: 50 },
    },
    bodyStyles: { fillColor: [248, 250, 252] },
    didParseCell(data) {
      if (data.section === 'body' && data.row.index === 4) {
        data.cell.styles.fillColor = [30, 64, 175]
        data.cell.styles.textColor = [255, 255, 255]
        data.cell.styles.fontStyle = 'bold'
      }
    },
    margin: { left: 10, right: 10 },
  })

  // ── PIE DE PÁGINA ────────────────────────────────────────────────────────────
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(7.5)
    doc.setTextColor(120, 120, 120)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `${empresa} — Informe de Diferencias — Factura ${resultado.numeroFactura}`,
      14,
      doc.internal.pageSize.getHeight() - 6
    )
    doc.text(
      `Página ${i} de ${pages}`,
      pageW - 14,
      doc.internal.pageSize.getHeight() - 6,
      { align: 'right' }
    )
  }

  // ── DESCARGAR ────────────────────────────────────────────────────────────────
  const nombreArchivo = `Diferencias_${empresa.replace(/\s+/g, '_')}_${resultado.numeroFactura}_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(nombreArchivo)
}
