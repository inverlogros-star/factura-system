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

// Calcula grupos IVA de la factura
function calcularIvaFactura(factura: Factura) {
  let base5 = 0, iva5 = 0, base19 = 0, iva19 = 0, base0 = 0
  for (const p of factura.productos) {
    const ivaV = (p as any).ivaValor ?? p.impuesto
    let tasa = (p as any).tasaIva ?? 0
    if (tasa === 0 && ivaV > 0 && p.subtotal > 0) {
      const c = Math.round((ivaV / p.subtotal) * 100)
      if (c >= 4 && c <= 6) tasa = 5
      else if (c >= 17 && c <= 21) tasa = 19
    }
    if (tasa === 5)       { base5  += p.subtotal; iva5  += ivaV }
    else if (tasa === 19) { base19 += p.subtotal; iva19 += ivaV }
    else                  { base0  += p.subtotal }
  }
  return { base5, iva5, base19, iva19, base0 }
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

  // ── INFO FACTURA / RECIBO — tabla de cabecera legible ────────────────────────
  doc.setTextColor(0, 0, 0)

  // Redondear recibo al peso en el informe
  const totalReciboRedondeado = Math.round(Number(resultado.valorTotalRecibo))
  const diferenciaReal        = Number(factura.total) - totalReciboRedondeado
  const difColor = Math.abs(diferenciaReal) >= 1
    ? [185, 28, 28] : [21, 128, 61]

  // Tabla de cabecera con autoTable — dos secciones (identificación + valores)
  autoTable(doc, {
    startY: 31,
    head: [['Proveedor', 'NIT Proveedor', 'No. Factura', 'Fecha del Recibo', 'No. Recibo']],
    body: [[
      resultado.proveedor || '—',
      nitProveedor,
      resultado.numeroFactura,
      fechaRecibo,
      resultado.numeroRecibo,
    ]],
    columnStyles: { 0:{cellWidth:72}, 1:{cellWidth:40}, 2:{cellWidth:40}, 3:{cellWidth:40,fontStyle:'bold',textColor:[21,128,61]}, 4:{cellWidth:40} },
    headStyles: { fillColor: [220,225,240], textColor:[60,60,80], fontStyle:'bold', fontSize:7.5 },
    bodyStyles: { fontStyle:'bold', fontSize:9, fillColor:[245,247,252] },
    styles: { overflow:'linebreak', cellPadding:3 },
    margin: { left:10, right:10 },
  })

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 2,
    head: [['Subtotal sin IVA', 'IVA Facturado', 'Total Factura', 'Total Recibo', 'Diferencia Total']],
    body: [[
      `$${fmt(factura.subtotal)}`,
      `$${fmt(factura.impuestos)}`,
      `$${fmt(factura.total)}`,
      `$${fmt(totalReciboRedondeado)}`,
      `$${fmt(diferenciaReal)}`,
    ]],
    columnStyles: {
      0:{cellWidth:72}, 1:{cellWidth:40},
      2:{cellWidth:40, fontStyle:'bold', textColor:[30,64,175]},
      3:{cellWidth:40},
      4:{cellWidth:40, fontStyle:'bold', textColor: difColor as [number,number,number]},
    },
    headStyles: { fillColor:[220,225,240], textColor:[60,60,80], fontStyle:'bold', fontSize:7.5 },
    bodyStyles: { fontStyle:'bold', fontSize:10, fillColor:[245,247,252] },
    styles: { overflow:'linebreak', cellPadding:3 },
    margin: { left:10, right:10 },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 4) {
        data.cell.styles.fontSize = 12
      }
    }
  })

  let y = (doc as any).lastAutoTable.finalY + 6
  const diffColor = difColor as [number, number, number]

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
  // Valores del recibo — siempre redondeado al peso
  const totalRecibo     = totalReciboRedondeado
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

  // ── CUADRO CONTABLE DE IMPUESTOS ─────────────────────────────────────────────
  const y2 = (doc as any).lastAutoTable.finalY + 8

  // Calcular grupos de IVA de la factura
  const ivaF = calcularIvaFactura(factura)
  const ivaRec    = Math.round(recibo?.totales?.iva       ?? 0)
  const iconsRec  = Math.round(recibo?.totales?.iconsumo  ?? 0)
  const ibuaRec   = Math.round(recibo?.totales?.ibua      ?? 0)
  const icuiRec   = Math.round(recibo?.totales?.icui      ?? 0)
  const brutoRec  = Math.round(recibo?.totales?.bruto     ?? 0)
  const netoRec   = Math.round(recibo?.totales?.subtotalNeto ?? 0)

  // Distribución proporcional del IVA del recibo según tasas de la factura
  const totalIvaFact = Math.round(ivaF.iva5 + ivaF.iva19) || 1
  const ivaRec5   = ivaRec > 0 && ivaF.iva5  > 0 ? Math.round(ivaRec * (ivaF.iva5  / totalIvaFact)) : 0
  const ivaRec19  = ivaRec > 0 && ivaF.iva19 > 0 ? Math.round(ivaRec * (ivaF.iva19 / totalIvaFact)) : 0
  const base5Rec  = ivaRec5  > 0 ? Math.round(ivaRec5  / 0.05) : (netoRec > 0 && ivaF.base5  > 0 ? Math.round(netoRec * (ivaF.base5  / (ivaF.base5+ivaF.base19+ivaF.base0||1))) : 0)
  const base19Rec = ivaRec19 > 0 ? Math.round(ivaRec19 / 0.19) : (netoRec > 0 && ivaF.base19 > 0 ? Math.round(netoRec * (ivaF.base19 / (ivaF.base5+ivaF.base19+ivaF.base0||1))) : 0)

  const difIvaTotal = Math.round(ivaF.iva5 + ivaF.iva19) - ivaRec

  const filasContables = [
    ['14351015', 'Base gravable IVA 5%',          `$${fmt(Math.round(ivaF.base5))}`,           base5Rec  > 0 ? `$${fmt(base5Rec)}`  : '—', base5Rec  > 0 ? `$${fmt(Math.round(ivaF.base5) - base5Rec)}`  : `$${fmt(Math.round(ivaF.base5))}`],
    ['24081015', 'IVA 5%',                        `$${fmt(Math.round(ivaF.iva5))}`,            ivaRec5   > 0 ? `$${fmt(ivaRec5)}`   : '—', `$${fmt(Math.round(ivaF.iva5) - ivaRec5)}`],
    ['14351007', 'Base gravable IVA 19%',         `$${fmt(Math.round(ivaF.base19))}`,          base19Rec > 0 ? `$${fmt(base19Rec)}` : '—', base19Rec > 0 ? `$${fmt(Math.round(ivaF.base19) - base19Rec)}` : `$${fmt(Math.round(ivaF.base19))}`],
    ['24081007', 'IVA 19%',                       `$${fmt(Math.round(ivaF.iva19))}`,           ivaRec19  > 0 ? `$${fmt(ivaRec19)}`  : '—', `$${fmt(Math.round(ivaF.iva19) - ivaRec19)}`],
    ['14351011', 'Base Impoconsumo',              '—',                                         iconsRec  > 0 ? `$${fmt(iconsRec)}` : '$0', iconsRec > 0 ? `-$${fmt(iconsRec)}` : '$0'],
    ['14351012', 'Base IBUA',                     '—',                                         ibuaRec   > 0 ? `$${fmt(ibuaRec)}`  : '$0', ibuaRec  > 0 ? `-$${fmt(ibuaRec)}`  : '$0'],
    ['14351013', 'Base ICUI',                     '—',                                         icuiRec   > 0 ? `$${fmt(icuiRec)}`  : '$0', icuiRec  > 0 ? `-$${fmt(icuiRec)}`  : '$0'],
    ['240803',   'Total IVA',                     `$${fmt(Math.round(ivaF.iva5+ivaF.iva19))}`, `$${fmt(ivaRec)}`,   `$${fmt(difIvaTotal)}`],
    ['220505',   'TOTAL A PAGAR',                 `$${fmt(totalFactura)}`,                     `$${fmt(totalRecibo)}`, `$${fmt(difTotal)}`],
  ].filter(f => {
    const v2 = String(f[2]).replace(/[$,.\s\-+]/g, '')
    const v3 = String(f[3]).replace(/[$,.\s\-+]/g, '')
    return v2 !== '0' || (v3 !== '0' && v3 !== '—')
  })

  if (filasContables.length > 0) {
    doc.setFontSize(9); doc.setFont('helvetica', 'bold')
    doc.text('CUADRO CONTABLE DE IMPUESTOS', 14, y2)

    autoTable(doc, {
      startY: y2 + 3,
      head: [['Cuenta Contable', 'Concepto', 'Factura', 'Recibo', 'Diferencia']],
      body: filasContables,
      styles: { fontSize: 8, cellPadding: 2.5, halign: 'right' },
      headStyles: { fillColor: [67, 56, 202], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 30, font: 'courier', halign: 'center' },
        1: { cellWidth: 80, halign: 'left', fontStyle: 'bold' },
        2: { cellWidth: 38, textColor: [30, 64, 175] },
        3: { cellWidth: 38, textColor: [21, 128, 61] },
        4: { cellWidth: 38, fontStyle: 'bold' },
      },
      alternateRowStyles: { fillColor: [238, 242, 255] },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 4) {
          const raw = String(data.cell.raw).replace(/[$.,\s]/g, '').replace('-', '')
          const val = parseFloat(String(data.cell.raw).replace(/[$.\s]/g, '').replace(',', '.'))
          if (Math.abs(val) >= 1) data.cell.styles.textColor = val > 0 ? [185, 28, 28] : [21, 128, 61]
          else data.cell.styles.textColor = [21, 128, 61]
        }
        // Fila Total IVA en destaque (índice 7 = fila 240803)
        if (data.section === 'body' && data.row.index === 7) {
          data.cell.styles.fillColor = [224, 231, 255]
          data.cell.styles.fontStyle = 'bold'
        }
        // Fila Total a Pagar 220505 en azul oscuro (última fila)
        if (data.section === 'body' && data.row.index === 8) {
          data.cell.styles.fillColor = [30, 64, 175]
          data.cell.styles.textColor = [255, 255, 255]
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fontSize = 9
        }
      },
      margin: { left: 10, right: 10 },
    })
  }

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
