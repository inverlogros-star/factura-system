/**
 * Servidor local PACARDYL — corre en tu PC en http://localhost:3002
 * Recibe peticiones del navegador, conecta a MySQL y sube a Vercel Postgres
 * Inicia con: node scripts/servidor-local.js
 * O doble clic en: scripts/iniciar-servidor.bat
 */

const http    = require('http')
const mysql   = require('mysql2/promise')
const https   = require('https')
const fs      = require('fs')
const path    = require('path')
const url     = require('url')

// Cargar .env.local
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(l => {
    const [k, ...v] = l.split('=')
    if (k && v.length) process.env[k.trim()] = v.join('=').trim()
  })
}

const PUERTO  = 3002
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
    }, res => { let b = ''; res.on('data', c => b += c); res.on('end', () => { try { resolve(JSON.parse(b)) } catch { resolve({}) } }) })
    req.on('error', () => resolve({}))
    req.write(data); req.end()
  })
}

async function importarRecibos(fechaInicio, fechaFin) {
  log(`Iniciando importación ${fechaInicio} → ${fechaFin}`)
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, user: process.env.DB_USER,
    password: process.env.DB_PASS, database: process.env.DB_NAME, port: 3306,
  })

  await conn.execute('CALL sp_crea_entradas_conta_tmp(?, ?)', [fechaInicio, fechaFin])
  log('Tabla temporal creada')

  const [filas] = await conn.execute(
    "SELECT * FROM tmp_entradasconta WHERE Ent_Nit NOT IN ('222222222','99','0') AND Ent_Nit IS NOT NULL AND Ent_Nit != ''"
  )
  log(`${filas.length} filas obtenidas`)
  await conn.execute('DROP TABLE IF EXISTS tmp_entradasconta')
  await conn.end()

  if (!filas.length) return { importados: 0, duplicados: 0, errores: 0 }

  // Agrupar por recibo
  const mapa = new Map()
  for (const f of filas) {
    const num = String(f.Ent_Numero || '').trim()
    if (!num) continue
    const noFactura = String(f.Ent_NoFactura || '').replace(/^0+/, '') || ''
    if (!mapa.has(num)) {
      mapa.set(num, {
        id: `r-bd-${num}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        numeroRecibo:          num,
        proveedor:             String(f.Emp_Razon       || '').trim(),
        nitProveedor:          String(f.Ent_Nit         || '').trim(),
        fecha:                 f.Ent_Fecha instanceof Date
                                 ? f.Ent_Fecha.toISOString().slice(0, 10)
                                 : String(f.Ent_Fecha   || '').slice(0, 10),
        numeroFacturaProveedor: noFactura,
        tipoFactura:           String(f.Ent_TipoFactura || '').trim(),
        noCompra:              String(f.Ent_NoCompra    || '').trim(),
        comentario:            String(f.Ent_Comentario  || '').trim(),
        entTipo:               String(f.Ent_Tipo        || '').trim(),
        // Totales del encabezado (Ent_*)
        entNeto:               Math.round(Number(f.Ent_Neto        || 0)),   // total a pagar (redondeado al peso)
        entBruto:              Math.round(Number(f.Ent_Bruto       || 0)),
        entDescuentos:         Math.round(Number(f.Ent_Descuentos  || 0)),
        entIva:                Math.round(Number(f.Ent_Iva         || 0)),
        entIconsumo:           Math.round(Number(f.Ent_IConsumo    || 0)),
        entEstampillas:        Math.round(Number(f.Ent_Estampillas || 0)),
        entVrFactura:          Math.round(Number(f.Ent_VrFactura   || 0)),
        productos: [], total: 0,
        creadoEn: new Date().toISOString(),
      })
    }
    const r = mapa.get(num)
    // ── Mapeo correcto de campos MySQL → ProductoRecibo ──────────────────────
    const cantPedida  = Number(f.EntDet_CanPed       || 0)  // cant. pedida
    const cantidad    = Number(f.EntDet_CanRec        || 0)  // cant. RECIBIDA
    const cantAdi     = Number(f.EntDet_CanAdi        || 0)  // adicional
    const precioLista = Number(f.EntDet_Costo         || 0)  // precio lista
    const costoBruto  = Number(f.EntDet_CostoBruto    || 0)  // precio bruto unitario
    const costoNeto   = Number(f.EntDet_CostoNeto     || 0)  // precio neto unitario (después de descuentos)
    const descPct1    = Number(f.EntDet_Descue01      || 0)  // % descuento 1
    const descPct2    = Number(f.EntDet_Descue02      || 0)  // % descuento 2
    const descPct3    = Number(f.EntDet_Descue03      || 0)  // % descuento 3
    // Redondear al peso — el recibo no maneja centavos
    const totalBruto  = Math.round(Number(f.EntDet_TotalBruto    || cantidad * costoBruto))
    const totalNeto   = Math.round(Number(f.EntDet_TotalNeto     || cantidad * costoNeto))
    const descuento   = Math.max(0, totalBruto - totalNeto)

    // TASAS (%) de impuestos
    const tasaIva     = Number(f.EntDet_Iva           || 0)  // tasa IVA %
    const tasaIcui    = Number(f.EntDet_ICUI          || 0)  // tasa ICUI %
    const tasaIbua    = Number(f.EntDet_IBUA          || 0)  // tasa IBUA %
    const tasaIconsumo= Number(f.EntDet_IConsumo      || 0)  // tasa Impoconsumo %

    // VALORES reales de impuestos — redondeados al peso
    const ivaValor    = Math.round(Number(f.TotalVrIva           || 0))
    const icuiValor   = Math.round(Number(f.TotalVrICUI          || 0))
    const ibuaValor   = Math.round(Number(f.TotalVrIBUA          || 0))
    const iconsumoValor = Math.round(Number(f.EntDet_IConsumo > 1 ? 0 : f.EntDet_IConsumo || 0))
    const estampillas = Math.round(Number(f.EntDet_Estampillas   || 0))
    const otros       = Math.round(Number(f.EntDet_Otros         || 0))

    if (String(f.EntDet_Barra||'').trim() || String(f.EntDet_Articulo||'').trim()) {
      r.productos.push({
        codigo:          String(f.EntDet_Barra    || '').trim(),
        descripcion:     String(f.EntDet_Articulo || '').trim(),
        cantidadPedida:  cantPedida,
        cantidad,                          // EntDet_CanRec
        cantidadAdicional: cantAdi,
        precioLista,                       // EntDet_Costo
        costoBruto,                        // EntDet_CostoBruto
        precioUnitario:  costoNeto,        // EntDet_CostoNeto ← usado para comparación
        descPct1, descPct2, descPct3,
        descuento,                         // valor calculado
        tasaIva,                           // EntDet_Iva (tasa %)
        iva:             ivaValor,         // TotalVrIva (valor real)
        tasaIconsumo,
        iconsumo:        iconsumoValor,
        tasaIbua,
        ibua:            ibuaValor,        // TotalVrIBUA
        tasaIcui,
        icui:            icuiValor,        // TotalVrICUI
        estampillas,
        otros,
        totalBruto,                        // EntDet_TotalBruto
        subtotal:        totalNeto,        // EntDet_TotalNeto ← total neto sin impuestos
      })
      r.total += totalNeto
    }
  }

  for (const r of mapa.values()) {
    const p = r.productos
    // ── Totales del recibo desde campos de ENCABEZADO (Ent_*) ─────────────────
    // Usar siempre los valores autorizados del encabezado, no sumas de líneas
    r.totales = {
      bruto:        r.entBruto       || Math.round(p.reduce((s, x) => s + (x.totalBruto||0), 0)),
      descuentos:   r.entDescuentos  || Math.round(p.reduce((s, x) => s + (x.descuento||0), 0)),
      subtotalNeto: r.entBruto - r.entDescuentos > 0
                      ? r.entBruto - r.entDescuentos
                      : Math.round(p.reduce((s, x) => s + x.subtotal, 0)),
      iva:          r.entIva         || Math.round(p.reduce((s, x) => s + (x.iva||0), 0)),
      iconsumo:     r.entIconsumo    || Math.round(p.reduce((s, x) => s + (x.iconsumo||0), 0)),
      ibua:         Math.round(p.reduce((s, x) => s + (x.ibua||0), 0)),
      icui:         Math.round(p.reduce((s, x) => s + (x.icui||0), 0)),
      estampillas:  r.entEstampillas || Math.round(p.reduce((s, x) => s + (x.estampillas||0), 0)),
      neto:         0,
    }
    // Ent_Neto = total definitivo a pagar (campo más confiable del encabezado)
    if (r.entNeto > 0)   r.total = r.entNeto
    else if (r.entBruto > 0) r.total = r.totales.subtotalNeto + r.totales.iva + r.totales.iconsumo + r.totales.ibua + r.totales.icui
    else if (r.total === 0)  r.total = r.totales.subtotalNeto + r.totales.iva + r.totales.iconsumo + r.totales.ibua + r.totales.icui
    r.totales.neto = r.total
  }

  let nuevos = 0, actualizados = 0, errores = 0
  let primerError = ''
  for (const r of mapa.values()) {
    const res = await postJSON(`${APP_URL}/api/recibos`, r)
    if (res.error) {
      errores++
      if (!primerError) {
        primerError = res.error
        log(`PRIMER ERROR: ${primerError}`)
      }
    } else if (res.actualizado) actualizados++
    else nuevos++
  }
  log(`Resultado: ${nuevos} nuevos | ${actualizados} actualizados | ${errores} errores`)
  return { importados: nuevos + actualizados, nuevos, actualizados, errores, total: mapa.size, primerError }
}

// Página HTML de resultado
function paginaResultado(titulo, contenido, color = '#15803d') {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>PACARDYL — ${titulo}</title>
<style>
  body{font-family:Arial,sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
  .card{background:#fff;border-radius:12px;padding:40px 48px;box-shadow:0 4px 24px rgba(0,0,0,.08);text-align:center;max-width:480px}
  h1{color:${color};font-size:22px;margin-bottom:8px}
  .num{font-size:48px;font-weight:bold;color:${color};margin:16px 0}
  p{color:#64748b;font-size:14px;margin:4px 0}
  .btn{display:inline-block;margin-top:24px;background:${color};color:#fff;padding:10px 28px;border-radius:8px;text-decoration:none;font-size:14px}
  .btn:hover{opacity:.9}
</style></head><body>
<div class="card">${contenido}
<a class="btn" href="javascript:window.close()">Cerrar</a></div>
</body></html>`
}

// Servidor HTTP
const servidor = http.createServer(async (req, res) => {
  // CORS — permite llamadas desde cualquier origen
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  const parsedUrl = url.parse(req.url, true)
  const ruta = parsedUrl.pathname

  // GET /importar?desde=2026-06-01&hasta=2026-06-25
  if (ruta === '/importar') {
    const desde = parsedUrl.query.desde
    const hasta  = parsedUrl.query.hasta

    if (!desde || !hasta) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(paginaResultado('Error', '<h1>❌ Error</h1><p>Se requieren parámetros <b>desde</b> y <b>hasta</b></p>', '#dc2626'))
      return
    }

    // Mostrar página de carga mientras procesa
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })

    // Usar streaming para mostrar progreso
    const htmlInicio = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>PACARDYL — Importando...</title>
<meta http-equiv="refresh" content="3;url=/resultado?desde=${desde}&hasta=${hasta}">
<style>
  body{font-family:Arial,sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
  .card{background:#fff;border-radius:12px;padding:40px 48px;box-shadow:0 4px 24px rgba(0,0,0,.08);text-align:center}
  h1{color:#1d4ed8;font-size:20px}.spin{font-size:48px;animation:spin 1s linear infinite;display:inline-block}
  @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
  p{color:#64748b;margin-top:12px}
</style></head><body>
<div class="card">
  <div class="spin">⚙️</div>
  <h1>Importando recibos...</h1>
  <p>Conectando a MySQL y cargando datos del <b>${desde}</b> al <b>${hasta}</b></p>
  <p style="font-size:12px;margin-top:16px;color:#94a3b8">No cierres esta ventana</p>
</div></body></html>`
    res.end(htmlInicio)

    // Ejecutar importación en background
    importarRecibos(desde, hasta).catch(err => log(`ERROR: ${err.message}`))
    return
  }

  // GET /resultado — muestra resultado tras importación
  if (ruta === '/resultado') {
    const desde = parsedUrl.query.desde
    const hasta  = parsedUrl.query.hasta
    try {
      const result = await importarRecibos(desde, hasta)
      const html = paginaResultado('Importación completada',
        `<h1>✅ Importación completada</h1>
         <div class="num">${result.importados}</div>
         <p>recibos procesados</p>
         <p style="margin-top:12px">Período: <b>${desde}</b> al <b>${hasta}</b></p>
         ${result.nuevos > 0 ? `<p style="color:#15803d;margin-top:6px">🆕 ${result.nuevos} recibos nuevos</p>` : ''}
         ${result.actualizados > 0 ? `<p style="color:#1d4ed8;margin-top:4px">🔄 ${result.actualizados} recibos actualizados (sin duplicar)</p>` : ''}
         ${result.errores > 0 ? `<p style="color:#dc2626;margin-top:4px">❌ ${result.errores} errores</p><p style="color:#dc2626;font-size:11px;margin-top:4px;word-break:break-all">${result.primerError || ''}</p>` : ''}
         <p style="margin-top:8px;font-size:12px;color:#94a3b8">Recarga la página de Recibos en PACARDYL para verlos</p>`)
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(html)
    } catch (err) {
      const html = paginaResultado('Error', `<h1>❌ Error</h1><p>${err.message}</p>`, '#dc2626')
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(html)
    }
    return
  }

  // GET / — página de estado
  if (ruta === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(paginaResultado('Servidor activo',
      `<h1>✅ Servidor PACARDYL activo</h1>
       <div class="num">3002</div>
       <p>Puerto local en funcionamiento</p>
       <p style="margin-top:8px;font-size:12px;color:#94a3b8">Puedes usar la aplicación normalmente</p>`))
    return
  }

  res.writeHead(404); res.end('Not found')
})

servidor.listen(PUERTO, () => {
  log(`════════════════════════════════════════`)
  log(`Servidor PACARDYL local iniciado`)
  log(`Puerto: http://localhost:${PUERTO}`)
  log(`════════════════════════════════════════`)
  log(`Listo para recibir peticiones de importación`)
})

servidor.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    log(`⚠️  Puerto ${PUERTO} ya en uso — el servidor ya está corriendo`)
  } else {
    log(`❌ Error: ${err.message}`)
  }
})
