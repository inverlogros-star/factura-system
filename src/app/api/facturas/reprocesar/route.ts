import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'
import { parsearFacturaDIAN } from '@/lib/parser-dian'

// Re-parsea facturas que tienen xml_raw guardado pero total=0 o proveedor vacío
export async function POST() {
  try {
    const { rows } = await sql`
      SELECT id, numero_factura, xml_raw
      FROM facturas
      WHERE xml_raw IS NOT NULL
        AND (total = 0 OR proveedor IS NULL OR proveedor = '')
      ORDER BY creado_en DESC
      LIMIT 50
    `

    if (rows.length === 0) {
      return NextResponse.json({ ok: true, procesados: 0, mensaje: 'No hay facturas pendientes de reprocesar' })
    }

    let procesados = 0
    let errores = 0
    const detalle: string[] = []

    for (const row of rows) {
      try {
        const datos = await parsearFacturaDIAN(row.xml_raw)

        // Solo actualizar si ahora sí obtuvimos datos útiles
        if (datos.total > 0 || datos.proveedor) {
          await sql`
            UPDATE facturas SET
              proveedor        = ${datos.proveedor || null},
              nit_proveedor    = ${datos.nitProveedor || null},
              fecha            = ${datos.fecha || null},
              productos        = ${JSON.stringify(datos.productos)},
              subtotal         = ${datos.subtotal},
              impuestos        = ${datos.impuestos},
              total            = ${datos.total},
              tipo_documento   = ${datos.tipoDocumento}
            WHERE id = ${row.id}
          `
          procesados++
          detalle.push(`✓ ${row.numero_factura} → $${datos.total.toLocaleString('es-CO')} | ${datos.proveedor || '(sin proveedor)'} | ${datos.productos.length} productos`)
        } else {
          detalle.push(`⚠ ${row.numero_factura} → sigue sin datos (XML posiblemente incompleto)`)
        }
      } catch (e) {
        errores++
        detalle.push(`✗ ${row.numero_factura} → error: ${String(e).slice(0, 80)}`)
      }
    }

    return NextResponse.json({ ok: true, procesados, errores, total: rows.length, detalle })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
