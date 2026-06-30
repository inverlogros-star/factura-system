'use client'
import type { ReciboMercancia } from '@/types'
import { fmtRecibo } from '@/lib/utils'

function fmt(n: number): string {
  return Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export async function generarInformeRecibosPDF(
  recibos: ReciboMercancia[],
  desde: string,
  hasta: string
) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()

  const ahora = new Date()
  const fechaHoy = ahora.toLocaleDateString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Bogota'
  })
  const horaHoy = ahora.toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Bogota'
  })

  // ── ENCABEZADO ──────────────────────────────────────────────────────────────
  doc.setFillColor(21, 128, 61)
  doc.rect(0, 0, pageW, 26, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.text('SUPERMERCADOS PACARDYL', 14, 10)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('INVERSIONES LOGROS S.A. — NIT: 811.031.830-1', 14, 17)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('INFORME DE RECIBOS DE MERCANCÍA', 14, 23)

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.text(`Generado: ${fechaHoy} ${horaHoy}`, pageW - 14, 17, { align: 'right' })
  doc.text(`Período: ${desde} al ${hasta}`, pageW - 14, 23, { align: 'right' })

  doc.setTextColor(0, 0, 0)

  // ── ORDENAR por fecha ────────────────────────────────────────────────────────
  const ordenados = [...recibos].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))

  // ── TABLA ───────────────────────────────────────────────────────────────────
  const filas = ordenados.map(r => [
    r.fecha || '—',
    fmtRecibo(r.numeroRecibo || ''),
    r.numeroFacturaProveedor || '—',
    r.proveedor || '—',
    r.nitProveedor || '—',
    `$${fmt(r.total)}`,
  ])

  const totalGeneral = ordenados.reduce((s, r) => s + Number(r.total || 0), 0)

  autoTable(doc, {
    startY: 32,
    head: [['Fecha', 'No. Recibo', 'No. Factura', 'Proveedor', 'NIT Proveedor', 'Valor Total']],
    body: filas,
    foot: [['', '', '', '', 'TOTAL GENERAL', `$${fmt(totalGeneral)}`]],
    theme: 'grid',
    headStyles: { fillColor: [21, 128, 61], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
    footStyles: { fillColor: [220, 252, 231], textColor: [21, 128, 61], fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 28, fontStyle: 'bold' },
      2: { cellWidth: 28 },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 32 },
      5: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
    didDrawPage: () => {
      const pageCount = doc.getNumberOfPages()
      doc.setFontSize(8)
      doc.setTextColor(150)
      doc.text(
        `Página ${doc.getCurrentPageInfo().pageNumber} de ${pageCount}`,
        pageW - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' }
      )
    },
  })

  // ── RESUMEN FINAL ───────────────────────────────────────────────────────────
  const finalY = (doc as any).lastAutoTable.finalY + 8
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(21, 128, 61)
  doc.text(`Total de recibos: ${ordenados.length}`, 14, finalY)
  doc.text(`Valor total recibido: $${fmt(totalGeneral)}`, 14, finalY + 6)

  const nombreArchivo = `Informe_Recibos_${desde}_a_${hasta}.pdf`
  doc.save(nombreArchivo)
}
