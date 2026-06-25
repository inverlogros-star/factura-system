'use client'
import type { ResultadoComparacion, Diferencia, Factura, ReciboMercancia } from '@/types'

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
  factura: Factura,
  recibo?: ReciboMercancia
) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()

  // Fecha y hora de generación
  const ahora = new Date()
  const fechaHoy = ahora.toLocaleDateString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Bogota'
  })
  const horaHoy = ahora.toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Bogota'
  })

  // Fecha del recibo de mercancía
  const fechaRecibo = recibo?.fecha || '—'
  const nitProveedor = factura.nitProveedor || recibo?.nitProveedor || resultado.proveedor || '—'

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
  doc.text(`Generado: ${fechaHoy} ${horaHoy}`, pageW - 14, 17, { align: 'right' })
  doc.text(`Proveedor: ${resultado.proveedor || '—'} | NIT: ${nitProveedor}`, pageW - 14, 23, { align: 'right' })

  // ── INFO FACTURA / RECIBO ────────────────────────────────────────────────────
  doc.setTextColor(0, 0, 0)
  let y = 33

  doc.setFillColor(241, 245, 249)
  doc.rect(10, y - 4, pageW - 20, 26, 'F')
  doc.setDrawColor(200, 210, 230)
  doc.rect(10, y - 4, pageW - 20, 26, 'S')

  const col1 = 14, col2 = 95, col3 = 180, col4 = 240

  doc.setFontSize(8.5)

  // Fila 1
  doc.setFont('helvetica', 'bold'); doc.text('Proveedor:', col1, y)
  doc.setFont('helvetica', 'normal'); doc.text(resultado.proveedor || '—', col1 + 22, y)

  doc.setFont('helvetica', 'bold'); doc.text('NIT:', col2, y)
  doc.setFont('helvetica', 'normal'); doc.text(nitProveedor, col2 + 10, y)

  doc.setFont('helvetica', 'bold'); doc.text('No. Factura:', col3, y)
  doc.setFont('helvetica', 'normal'); doc.text(resultado.numeroFactura, col3 + 24, y)

  doc.setFont('helvetica', 'bold'); doc.text('Últ. 4:', col4, y)
  doc.setFont('helvetica', 'normal'); doc.text(resultado.numeroFactura.replace(/\D/g,'').slice(-4), col4 + 14, y)

  // Fila 2
  doc.setFont('helvetica', 'bold'); doc.text('📅 Fecha Recibo:', col1, y + 7)
  doc.setTextColor(21, 128, 61); doc.setFont('helvetica', 'bold')
  doc.text(fechaRecibo, col1 + 32, y + 7)
  doc.setTextColor(0, 0, 0)

  doc.setFont('helvetica', 'bold'); doc.text('No. Recibo:', col2, y + 7)
  doc.setFont('helvetica', 'normal'); doc.text(resultado.numeroRecibo, col2 + 22, y + 7)

  doc.setFont('helvetica', 'bold'); doc.text('IVA Facturado:', col3, y + 7)
  doc.setFont('helvetica', 'normal'); doc.text(`$${fmt(factura.impuestos)}`, col3 + 28, y + 7)

  doc.setFont('helvetica', 'bold'); doc.text('Total Fact.:', col4, y + 7)
  doc.setTextColor(30, 64, 175); doc.setFont('helvetica', 'bold')
  doc.text(`$${fmt(factura.total)}`, col4 + 22, y + 7)
  doc.setTextColor(0, 0, 0)

  // Fila 3
  doc.setFont('helvetica', 'bold'); doc.text('Total Mercancía (sin IVA):', col1, y + 14)
  doc.setFont('helvetica', 'normal'); doc.text(`$${fmt(factura.subtotal)}`, col1 + 48, y + 14)

  doc.setFont('helvetica', 'bold'); doc.text('Total Recibo:', col2, y + 14)
  doc.setFont('helvetica', 'normal'); doc.text(`$${fmt(resultado.valorTotalRecibo)}`, col2 + 26, y + 14)

  doc.setFont('helvetica', 'bold'); doc.text('Diferencia Total:', col3, y + 14)
  const diffColor = resultado.valorDiferenciaTotal !== 0 ? [185, 28, 28] as const : [21, 128, 61] as const
  doc.setTextColor(diffColor[0], diffColor[1], diffColor[2])
  doc.setFont('helvetica', 'bold')
  doc.text(`$${fmt(resultado.valorDiferenciaTotal)}`, col3 + 32, y + 14)
  doc.setTextColor(0, 0, 0)

  doc.setFont('helvetica', 'bold'); doc.text('Generado:', col4, y + 14)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5)
  doc.text(`${fechaHoy} ${horaHoy}`, col4 + 19, y + 14)
  doc.setFontSize(8.5)

  y += 30

  // ── TABLA DETALLE ────────────────────────────────────────────────────────────
  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'bold')
  doc.text(`DIFERENCIAS POR CÓDIGO DE PRODUCTO (${resultado.diferencias.length})`, 14, y)
  y += 3

  // Conteo por tipo de diferencia
  let cantDifCantidad = 0, cantDifPrecio = 0, cantDifPresentacion = 0, cantDifNoEncontrado = 0

  const rows = resultado.diferencias.map((d: Diferencia) => {
    const valDif = d.valorDiferenciaTotal ?? 0
    if (d.tipoDiferencia === 'cantidad') cantDifCantidad++
    else if (d.tipoDiferencia === 'precio') cantDifPrecio++
    else if (d.tipoDiferencia === 'presentacion') cantDifPresentacion++
    else cantDifNoEncontrado++

    return [
      d.codigoFactura || d.codigoRecibo || '—',
      d.descripcion,
      TIPO_LABEL[d.tipoDiferencia] || d.tipoDiferencia,
      d.cantidadRecibida !== undefined ? String(d.cantidadRecibida) : '—',
      d.cantidadFacturada !== undefined ? String(d.cantidadFacturada) : '—',
      d.precioRecibo !== undefined ? `$${fmt(d.precioRecibo)}` : '—',
      d.precioFactura !== undefined ? `$${fmt(d.precioFactura)}` : '—',
      `$${fmt(valDif)}`,
    ]
  })

  autoTable(doc, {
    startY: y,
    head: [[
      'Código', 'Descripción', 'Tipo', 'Cant.\nRecibida', 'Cant.\nFacturada',
      'Precio\nRecibo', 'Precio\nFactura', 'Vlr. Diferencia',
    ]],
    body: rows,
    styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
    columnStyles: {
      0: { cellWidth: 30, font: 'courier', fontSize: 6.5 },
      1: { cellWidth: 80 },
      2: { cellWidth: 28, halign: 'center', fontStyle: 'bold' },
      3: { cellWidth: 20, halign: 'right' },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 28, halign: 'right' },
      6: { cellWidth: 28, halign: 'right' },
      7: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
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
        const raw = String(data.cell.raw).replace(/[$.,\s]/g, '')
        const val = parseFloat(raw)
        if (val > 0) data.cell.styles.textColor = [185, 28, 28]
        else if (val < 0) data.cell.styles.textColor = [21, 128, 61]
      }
    },
    margin: { left: 10, right: 10 },
  })

  // ── TOTALES — tomados directamente de factura y recibo ───────────────────────
  const finalY = (doc as any).lastAutoTable.finalY + 6

  // Valores reales de la factura
  const subtotalFactura = Number(factura.subtotal)
  const ivaFactura      = Number(factura.impuestos)
  const totalFactura    = Number(factura.total)
  // Valores del recibo
  const totalRecibo     = Number(resultado.valorTotalRecibo)
  // Diferencia neta
  const difTotal        = totalFactura - totalRecibo

  autoTable(doc, {
    startY: finalY,
    head: [['CONCEPTO', 'FACTURA', 'RECIBO', 'DIFERENCIA']],
    body: [
      ['Subtotal mercancía (sin IVA)', `$${fmt(subtotalFactura)}`, '—', '—'],
      ['IVA facturado',                `$${fmt(ivaFactura)}`,      '—', '—'],
      ['Total con IVA / Total recibo', `$${fmt(totalFactura)}`,    `$${fmt(totalRecibo)}`, `$${fmt(difTotal)}`],
      [`Diferencias encontradas: ${resultado.diferencias.length}  |  Por cantidad: ${cantDifCantidad}  |  Por precio: ${cantDifPrecio}  |  Presentación: ${cantDifPresentacion}  |  No encontrados: ${cantDifNoEncontrado}`, '', '', ''],
    ],
    styles: { fontSize: 8.5, cellPadding: 3, halign: 'right' },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold', cellWidth: 120 },
      1: { cellWidth: 50 },
      2: { cellWidth: 50 },
      3: { cellWidth: 50 },
    },
    bodyStyles: { fillColor: [248, 250, 252] },
    didParseCell(data) {
      // Fila "Total con IVA" en azul
      if (data.section === 'body' && data.row.index === 2) {
        data.cell.styles.fillColor = [30, 64, 175]
        data.cell.styles.textColor = [255, 255, 255]
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fontSize = 9
      }
      // Fila resumen de conteos en gris claro
      if (data.section === 'body' && data.row.index === 3) {
        data.cell.styles.fillColor = [226, 232, 240]
        data.cell.styles.fontSize = 7.5
        data.cell.styles.textColor = [50, 50, 80]
        data.cell.styles.halign = 'left'
      }
      // Colorear diferencia
      if (data.section === 'body' && data.row.index === 2 && data.column.index === 3) {
        if (difTotal > 0) data.cell.styles.textColor = [255, 200, 200]
        else if (difTotal < 0) data.cell.styles.textColor = [200, 255, 200]
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
    doc.text(`PACARDYL — NIT Prov: ${nitProveedor} — Factura ${resultado.numeroFactura} — Recibo ${resultado.numeroRecibo} — Fecha Recibo: ${fechaRecibo} — Generado: ${fechaHoy}`, 14, ph - 5)
    doc.text(`Página ${i} de ${pages}`, pageW - 14, ph - 5, { align: 'right' })
  }

  const nombreArchivo = `Diferencias_PACARDYL_${resultado.numeroFactura.slice(-4)}_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(nombreArchivo)
}
