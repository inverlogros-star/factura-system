import { sql } from '@vercel/postgres'

export async function inicializarDB() {
  await sql`
    CREATE TABLE IF NOT EXISTS facturas (
      id TEXT PRIMARY KEY,
      numero_factura TEXT NOT NULL,
      proveedor TEXT,
      nit_proveedor TEXT,
      fecha TEXT,
      fecha_vencimiento TEXT,
      productos JSONB NOT NULL DEFAULT '[]',
      subtotal NUMERIC NOT NULL DEFAULT 0,
      impuestos NUMERIC NOT NULL DEFAULT 0,
      total NUMERIC NOT NULL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'pendiente',
      recibo_asociado_id TEXT,
      xml_raw TEXT,
      correo_origen TEXT,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  // Migración: agregar columna correo_origen si no existe
  await sql`ALTER TABLE facturas ADD COLUMN IF NOT EXISTS correo_origen TEXT`

  await sql`
    CREATE TABLE IF NOT EXISTS recibos (
      id TEXT PRIMARY KEY,
      numero_recibo TEXT NOT NULL,
      proveedor TEXT,
      nit_proveedor TEXT,
      fecha TEXT,
      productos JSONB NOT NULL DEFAULT '[]',
      total NUMERIC NOT NULL DEFAULT 0,
      xml_raw TEXT,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS comparaciones (
      id TEXT PRIMARY KEY,
      factura_id TEXT NOT NULL,
      recibo_id TEXT NOT NULL,
      numero_factura TEXT,
      numero_recibo TEXT,
      proveedor TEXT,
      diferencias JSONB NOT NULL DEFAULT '[]',
      tiene_diferencias BOOLEAN NOT NULL DEFAULT false,
      valor_total_factura NUMERIC NOT NULL DEFAULT 0,
      valor_total_recibo NUMERIC NOT NULL DEFAULT 0,
      valor_diferencia_total NUMERIC NOT NULL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'ok',
      fecha_comparacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
}
