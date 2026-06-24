/**
 * Importa recibos de mercancía desde MySQL (tab_pacardyl)
 * 1. Llama sp_crea_entradas_conta_tmp  → crea la tabla temporal
 * 2. Lee tmp_entradasconta             → convierte a recibos
 * 3. Envía cada recibo al sistema web
 * 4. Borra la tabla temporal
 */

const mysql = require('mysql2/promise')
const https = require('https')
const fs    = require('fs')
const path  = require('path')

// Cargar .env.local
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(l => {
    const [k, ...v] = l.split('=')
    if (k && v.length) process.env[k.trim()] = v.join('=').trim()
  })
}

const APP_URL = process.env.APP_URL || 'https://factura-system.vercel.app'

function log(msg) {
  const ts = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })
  console.log(`[${ts}] ${msg}`)
}

function postJSON(url, body) {
  return new Promise(resolve => {
    const data = JSON.stringify(body)
    const u = new URL(url)
    const req = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, res => {
      let b = ''; res.on('data', c => b += c)
      res.on('end', () => { try { resolve(JSON.parse(b)) } catch { resolve({ error: b }) } })
    })
    req.on('error', e => resolve({ error: e.message }))
    req.write(data); req.end()
  })
}

// Agrupa filas por número de recibo usando columnas reales de tmp_entradasconta
function construirRecibos(filas) {
  const mapa = new Map()

  for (const fila of filas) {
    const numRecibo   = String(fila.Ent_Numero   || '').trim()
    const proveedor   = String(fila.Emp_Razon    || '').trim()
    const nitProv     = String(fila.Ent_Nit      || '').trim()
    const fecha       = fila.Ent_Fecha
      ? (fila.Ent_Fecha instanceof Date
          ? fila.Ent_Fecha.toISOString().slice(0, 10)
          : String(fila.Ent_Fecha).slice(0, 10))
      : ''
    const noFactura   = String(fila.Ent_NoFactura || '').trim()
    const tipoFactura = String(fila.Ent_TipoFactura || '').trim()

    // Detalle del producto
    const codigo      = String(fila.EntDet_Barra    || '').trim()
    const descripcion = String(fila.EntDet_Articulo || '').trim()
    const cantidad    = parseFloat(fila.EntDet_CanRec  || 0)
    const precio      = parseFloat(fila.EntDet_Costo   || 0)
    const descuento1  = parseFloat(fila.EntDet_Descue01 || 0)
    const descuento2  = parseFloat(fila.EntDet_Descue02 || 0)
    const descuento3  = parseFloat(fila.EntDet_Descue03 || 0)
    const iva         = parseFloat(fila.EntDet_Iva      || 0)
    const iconsumo    = parseFloat(fila.EntDet_IConsumo || 0)
    const ibua        = parseFloat(fila.EntDet_IBUA     || 0)
    const icui        = parseFloat(fila.EntDet_ICUI     || 0)
    const costoNeto   = parseFloat(fila.EntDet_CostoNeto || 0)
    const totalNeto   = parseFloat(fila.EntDet_TotalNeto || (cantidad * costoNeto))

    if (!numRecibo) continue

    // Limpiar el número de factura: quitar ceros iniciales, dejar solo dígitos significativos
    const noFacturaLimpio = noFactura.replace(/^0+/, '') || noFactura

    if (!mapa.has(numRecibo)) {
      mapa.set(numRecibo, {
        id:                       `r-bd-${numRecibo}-${Date.now()}`,
        numeroRecibo:             numRecibo,
        proveedor,
        nitProveedor:             nitProv,
        fecha,
        numeroFacturaProveedor:   noFacturaLimpio,  // últimos dígitos del No. factura
        noFactura:                noFacturaLimpio,
        tipoFactura,
        totalEncabezado: {
          total:       parseFloat(fila.Ent_Total       || 0),
          descuentos:  parseFloat(fila.Ent_Descuentos  || 0),
          bruto:       parseFloat(fila.Ent_Bruto        || 0),
          iva:         parseFloat(fila.Ent_Iva          || 0),
          iconsumo:    parseFloat(fila.Ent_IConsumo     || 0),
          neto:        parseFloat(fila.Ent_Neto         || 0),
          vrFactura:   parseFloat(fila.Ent_VrFactura    || 0),
        },
        productos: [],
        total: 0,
        creadoEn: new Date().toISOString(),
      })
    }

    const recibo = mapa.get(numRecibo)
    if (codigo || descripcion) {
      recibo.productos.push({
        codigo,
        descripcion,
        cantidad,
        precioUnitario: costoNeto,
        descuento: descuento1 + descuento2 + descuento3,
        iva,
        iconsumo,
        ibua,
        icui,
        subtotal: totalNeto,
      })
      recibo.total += totalNeto
    }
  }

  // Usar total del encabezado si el calculado es 0
  for (const recibo of mapa.values()) {
    if (recibo.total === 0) recibo.total = recibo.totalEncabezado.neto || recibo.totalEncabezado.total
  }

  return Array.from(mapa.values())
}

async function main() {
  log('════════════════════════════════════════')
  log('Importando recibos desde MySQL tab_pacardyl')
  log('════════════════════════════════════════')

  // 1. Conectar a MySQL
  let conn
  try {
    conn = await mysql.createConnection({
      host:     process.env.DB_HOST,
      user:     process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      port:     3306,
    })
    log(`✓ Conectado a ${process.env.DB_HOST}/${process.env.DB_NAME}`)
  } catch (err) {
    log(`❌ Error conectando a MySQL: ${err.message}`)
    process.exit(1)
  }

  try {
    // Parámetros de fecha: node script.js 2026-06-01 2026-06-30
    // Si no se pasan, usa el mes actual
    const hoy        = new Date()
    const primerDia  = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    const ultimoDia  = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
    const toISO      = d => d.toISOString().slice(0, 10)

    const fechaInicio = process.argv[2] || toISO(primerDia)
    const fechaFin    = process.argv[3] || toISO(ultimoDia)

    // 2. Crear tabla temporal con el SP
    log(`Ejecutando sp_crea_entradas_conta_tmp('${fechaInicio}', '${fechaFin}')...`)
    await conn.execute('CALL sp_crea_entradas_conta_tmp(?, ?)', [fechaInicio, fechaFin])
    log('✓ Tabla temporal creada')

    // 3. Leer datos — solo entradas reales (excluir NIT internos 222222222 y 99)
    log('Leyendo tmp_entradasconta (solo proveedores reales)...')
    const [filas] = await conn.execute(
      "SELECT * FROM tmp_entradasconta WHERE Ent_Nit NOT IN ('222222222','99','0') AND (Ent_Nit IS NOT NULL AND Ent_Nit != '')"
    )
    log(`✓ ${filas.length} fila(s) obtenidas`)

    if (filas.length === 0) {
      log('Sin registros en la tabla temporal')
      await conn.execute('DROP TABLE IF EXISTS tmp_entradasconta')
      return
    }

    // Mostrar columnas disponibles para verificación
    log(`Columnas disponibles: ${Object.keys(filas[0]).join(', ')}`)

    // 4. Agrupar por recibo
    const recibos = construirRecibos(filas)
    log(`Recibos identificados: ${recibos.length}`)

    // 5. Enviar al sistema web
    let importados = 0, omitidos = 0, errores = 0
    for (const recibo of recibos) {
      const res = await postJSON(`${APP_URL}/api/recibos`, recibo)
      if (res.error) {
        log(`  ❌ ${recibo.numeroRecibo}: ${res.error}`)
        errores++
      } else {
        log(`  ✅ Recibo ${recibo.numeroRecibo} — ${recibo.proveedor} — $${recibo.total.toLocaleString('es-CO')} — ${recibo.productos.length} producto(s)`)
        importados++
      }
    }

    log(`────────────────────────────────────────`)
    log(`Importados: ${importados} | Omitidos: ${omitidos} | Errores: ${errores}`)

    // 6. Borrar tabla temporal
    log('Borrando tabla temporal...')
    await conn.execute('DROP TABLE IF EXISTS tmp_entradasconta')
    log('✓ Tabla temporal eliminada')

  } catch (err) {
    log(`❌ Error: ${err.message}`)
    // Intentar borrar la tabla temporal aunque haya error
    try { await conn.execute('DROP TABLE IF EXISTS tmp_entradasconta') } catch {}
  } finally {
    await conn.end()
    log('Conexión cerrada')
  }

  log('════════════════════════════════════════')
  log('Proceso completado')
  log('════════════════════════════════════════')
}

main().catch(err => { log(`ERROR FATAL: ${err.message}`); process.exit(1) })
