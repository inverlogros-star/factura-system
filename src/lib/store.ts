'use client'
// In-memory store for demo — replace with Supabase calls in production
import type { Factura, ReciboMercancia, ResultadoComparacion } from '@/types'

const KEY_FACTURAS = 'pcardyl_facturas'
const KEY_RECIBOS = 'pcardyl_recibos'
const KEY_COMPARACIONES = 'pcardyl_comparaciones'

function load<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(key) || '[]')
  } catch {
    return []
  }
}

function save<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify(data))
}

export const storeFacturas = {
  getAll: (): Factura[] => load<Factura>(KEY_FACTURAS),
  save: (f: Factura) => {
    const all = load<Factura>(KEY_FACTURAS)
    const idx = all.findIndex(x => x.id === f.id)
    if (idx >= 0) all[idx] = f
    else all.push(f)
    save(KEY_FACTURAS, all)
  },
  delete: (id: string) => {
    save(KEY_FACTURAS, load<Factura>(KEY_FACTURAS).filter(f => f.id !== id))
  },
}

export const storeRecibos = {
  getAll: (): ReciboMercancia[] => load<ReciboMercancia>(KEY_RECIBOS),
  save: (r: ReciboMercancia) => {
    const all = load<ReciboMercancia>(KEY_RECIBOS)
    const idx = all.findIndex(x => x.id === r.id)
    if (idx >= 0) all[idx] = r
    else all.push(r)
    save(KEY_RECIBOS, all)
  },
  delete: (id: string) => {
    save(KEY_RECIBOS, load<ReciboMercancia>(KEY_RECIBOS).filter(r => r.id !== id))
  },
}

export const storeComparaciones = {
  getAll: (): ResultadoComparacion[] => load<ResultadoComparacion>(KEY_COMPARACIONES),
  save: (c: ResultadoComparacion) => {
    const all = load<ResultadoComparacion>(KEY_COMPARACIONES)
    const idx = all.findIndex(x => x.id === c.id)
    if (idx >= 0) all[idx] = c
    else all.push(c)
    save(KEY_COMPARACIONES, all)
  },
  delete: (id: string) => {
    save(KEY_COMPARACIONES, load<ResultadoComparacion>(KEY_COMPARACIONES).filter(c => c.id !== id))
  },
}
