import type { ReciboMercancia, ProductoRecibo } from '@/types'

function limpiarNum(str: string): number {
  return parseFloat(str.replace(/[$\s.]/g, '').replace(',', '.')) || 0
}

function esNumero(str: string): boolean {
  return /^[\d.,\s$]+$/.test(str.trim()) && str.trim().length > 0
}

export async function parsearReciboPDF(
  buffer: ArrayBuffer,
  nombreArchivo: string
): Promise<Omit<ReciboMercancia, 'id' | 'creadoEn'>> {
  // pdf-parse solo funciona en Node.js (API route), aquí preparamos el buffer
  // para enviarlo al servidor
  const formData = new FormData()
  formData.append('file', new Blob([buffer], { type: 'application/pdf' }), nombreArchivo)

  const res = await fetch('/api/recibos/parse-pdf', { method: 'POST', body: formData })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Error al procesar el PDF')
  }
  return res.json()
}
