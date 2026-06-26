import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Muestra el número de recibo omitiendo los 2 primeros caracteres (año "26")
// Ej: "26176S0001" → "176S0001"
export function fmtRecibo(numero: string | undefined): string {
  if (!numero) return '—'
  return numero.length > 2 ? numero.slice(2) : numero
}
