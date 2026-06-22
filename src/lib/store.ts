import type { Factura, ReciboMercancia, ResultadoComparacion } from '@/types'

export const storeFacturas = {
  getAll: async (): Promise<Factura[]> => {
    const res = await fetch('/api/facturas')
    if (!res.ok) return []
    return res.json()
  },
  save: async (f: Factura): Promise<void> => {
    await fetch('/api/facturas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
  },
  delete: async (id: string): Promise<void> => {
    await fetch(`/api/facturas/${id}`, { method: 'DELETE' })
  },
}

export const storeRecibos = {
  getAll: async (): Promise<ReciboMercancia[]> => {
    const res = await fetch('/api/recibos')
    if (!res.ok) return []
    return res.json()
  },
  save: async (r: ReciboMercancia): Promise<void> => {
    await fetch('/api/recibos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r) })
  },
  delete: async (id: string): Promise<void> => {
    await fetch(`/api/recibos/${id}`, { method: 'DELETE' })
  },
}

export const storeComparaciones = {
  getAll: async (): Promise<ResultadoComparacion[]> => {
    const res = await fetch('/api/comparaciones')
    if (!res.ok) return []
    return res.json()
  },
  save: async (c: ResultadoComparacion): Promise<void> => {
    await fetch('/api/comparaciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) })
  },
  delete: async (id: string): Promise<void> => {
    await fetch(`/api/comparaciones/${id}`, { method: 'DELETE' })
  },
}
