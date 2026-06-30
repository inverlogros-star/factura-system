'use client'
import type { Factura, ReciboMercancia } from '@/types'
import { fmtRecibo } from '@/lib/utils'

function fmt(n: number): string {
  return Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const TIPO_LABEL: Record<string, string> = {
  factura: 'Factura', nota_credito: 'Nota Crédito',
  nota_debito: 'Nota Débito', otro: 'Otro doc.',
}

export async function generarInformeFacturasPDF(
  facturas: Factura[],
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
  doc.setFillColor(37, 99, 235)
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
  doc.text('INFORME DE FACTURAS, NOTAS CRÉDITO Y NOTAS DÉBITO', 14, 23)

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.text(`Generado: ${fechaHoy} ${horaHoy}`, pageW - 14, 17, { align: 'right' })
  doc.text(`Período: ${desde} al ${hasta}`, pageW - 14, 23, { align: 'right' })

  doc.setTextColor(0, 0, 0)

  // ── Mapa recibo asociado ──────────────────────────────────────────────────
  const recibosPorId = new Map(recibos.map(r => [r.id, r]))

  // ── ORDENAR por fecha ────────────────────────────────────────────────────────
  const ordenados = [...facturas].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))

  // ── TABLA ───────────────────────────────────────────────────────────────────
  const filas = ordenados.map(f => {
    const recibo = f.reciboAsociadoId ? recibosPorId.get(f.reciboAsociadoId) : undefined
    const tipo = TIPO_LABEL[f.tipoDocumento || 'factura'] || f.tipoDocumento || 'Factura'
    return [
      f.fecha || '—',
      tipo,
      f.numeroFactura || '—',
      recibo ? fmtRecibo(recibo.numeroRecibo) : '—',
      f.proveedor || '—',
      f.nitProveedor || '—',
      `$${fmt(f.total)}`,
    ]
  })

  const totalFacturas     = ordenados.filter(f => (f.tipoDocumento || 'factura') === 'factura')
  const totalNotasCredito = ordenados.filter(f => f.tipoDocumento === 'nota_credito')
  const totalNotasDebito  = ordenados.filter(f => f.tipoDocumento === 'nota_debito')
  const totalGeneral = ordenados.reduce((s, f) => s + Number(f.total || 0), 0)

  autoTable(doc, {
    startY: 32,
    head: [['Fecha', 'Tipo', 'No. Factura/Nota', 'No. Recibo', 'Proveedor', 'NIT Proveedor', 'Valor Total']],
    body: filas,
    foot: [['', '', '', '', '', 'TOTAL GENERAL', `$${fmt(totalGeneral)}`]],
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
    footStyles: { fillColor: [219, 234, 254], textColor: [29, 78, 216], fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 7.8 },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 24 },
      2: { cellWidth: 30 },
      3: { cellWidth: 26, fontStyle: 'bold' },
      4: { cellWidth: 'auto' },
      5: { cellWidth: 30 },
      6: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
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
  doc.setTextColor(29, 78, 216)
  doc.text(`Total documentos: ${ordenados.length}`, 14, finalY)
  doc.text(`Facturas: ${totalFacturas.length}  |  Notas Crédito: ${totalNotasCredito.length}  |  Notas Débito: ${totalNotasDebito.length}`, 14, finalY + 6)
  doc.text(`Valor total: $${fmt(totalGeneral)}`, 14, finalY + 12)

  const nombreArchivo = `Informe_Facturas_${desde}_a_${hasta}.pdf`
  doc.save(nombreArchivo)
}
