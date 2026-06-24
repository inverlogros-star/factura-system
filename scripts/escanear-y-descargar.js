/**
 * Escanea TODOS los no leídos (ligero) → identifica cuáles tienen ZIP/XML → descarga solo esos
 * Guarda el progreso en un archivo JSON para poder continuar si se interrumpe
 */
const { ImapFlow } = require('imapflow')
const { simpleParser } = require('mailparser')
const AdmZip = require('adm-zip')
const fs = require('fs')
const path = require('path')
const https = require('https')

process.on('uncaughtException', err => console.error(`[ERROR] ${err.message}`))

const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(l => {
    const [k, ...v] = l.split('=')
    if (k && v.length) process.env[k.trim()] = v.join('=').trim()
  })
}

const CARPETA   = process.env.CARPETA_FACTURAS || 'C:\\Users\\SPalacio\\Documents\\PROYECTO PCARDYL\\FACTURAS_PACARDYL'
const APP_URL   = process.env.APP_URL || 'https://factura-system.vercel.app'
const IMPORTADAS = path.join(CARPETA, 'IMPORTADAS')
const PROGRESO  = path.join(CARPETA, 'progreso_descarga.json')

const CUENTAS = [
  { nombre: 'contabilidad@pacardyl.com',          host: 'imap.zoho.com',  user: 'contabilidad@pacardyl.com',          pass: process.env.PASS_CONTABILIDAD },
  { nombre: 'inverlogros@gmail.com',               host: 'imap.gmail.com', user: 'inverlogros@gmail.com',               pass: process.env.PASS_INVERLOGROS },
  { nombre: 'facturacionelectronica@pacardyl.com', host: 'imap.zoho.com',  user: 'facturacionelectronica@pacardyl.com', pass: process.env.PASS_FACTURACION },
]

function log(msg) {
  const ts = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })
  const linea = `[${ts}] ${msg}`
  console.log(linea)
  fs.appendFileSync(path.join(CARPETA, 'descarga.log'), linea + '\n', 'utf8')
}

function sanitizar(n) { return n.replace(/[^a-zA-Z0-9._\-]/g, '_').slice(0, 100) }
function esperar(ms)  { return new Promise(r => setTimeout(r, ms)) }

function postJSON(url, body) {
  return new Promise(resolve => {
    const data = JSON.stringify(body)
    const u = new URL(url)
    const req = https.request({ hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => { let b = ''; res.on('data', c => b += c); res.on('end', () => { try { resolve(JSON.parse(b)) } catch { resolve({}) } }) })
    req.on('error', () => resolve({}))
    req.write(data); req.end()
  })
}

function tieneFactura(bs) {
  if (!bs) return false
  const s = JSON.stringify(bs).toLowerCase()
  return s.includes('.zip') || s.includes('application/zip') ||
    s.includes('application/xml') || s.includes('text/xml') ||
    (s.includes('.xml') && !s.includes('.docx') && !s.includes('.xlsx'))
}

function cargarProgreso() {
  try { return JSON.parse(fs.readFileSync(PROGRESO, 'utf8')) } catch { return {} }
}
function guardarProgreso(p) {
  fs.writeFileSync(PROGRESO, JSON.stringify(p, null, 2), 'utf8')
}

async function escanearUIDsConFactura(cuenta) {
  log(`\n🔍 Escaneando ${cuenta.nombre}...`)
  const client = new ImapFlow({ host: cuenta.host, port: 993, secure: true,
    auth: { user: cuenta.user, pass: cuenta.pass }, logger: false, tls: { rejectUnauthorized: false },
    socketTimeout: 60000, connectionTimeout: 15000 })

  const uidsConFactura = []
  try {
    await client.connect()
    await client.mailboxOpen('INBOX')
    const todos = await client.search({ seen: false }, { uid: true })
    log(`  ${todos.length} correos no leídos — escaneando estructura...`)

    const LOTE = 500
    for (let i = 0; i < todos.length; i += LOTE) {
      const lote = todos.slice(i, i + LOTE)
      try {
        for await (const msg of client.fetch(lote, { bodyStructure: true, uid: true }, { uid: true })) {
          if (tieneFactura(msg.bodyStructure)) uidsConFactura.push(msg.uid)
        }
      } catch (e) {
        log(`  ⚠️  Error escaneo lote ${i}: ${e.message}`)
        // Reconectar para continuar
        try { await client.logout() } catch {}
        await esperar(3000)
        await client.connect()
        await client.mailboxOpen('INBOX')
      }
      if ((i + LOTE) % 2000 === 0) log(`  Escaneados ${i + LOTE}/${todos.length}...`)
    }
    await client.logout()
    log(`  ✅ ${uidsConFactura.length} correos con facturas encontrados de ${todos.length}`)
  } catch (e) {
    log(`  ❌ Error: ${e.message}`)
    try { await client.logout() } catch {}
  }
  return uidsConFactura
}

async function importar(xmlPath, nombre, correoOrigen) {
  try {
    const xmlContent = fs.readFileSync(xmlPath, 'utf8')
    const res = await postJSON(`${APP_URL}/api/facturas/importar-xml`, { xmlContent, nombreArchivo: nombre, correoOrigen })
    if (res.error) log(`  ⚠️  ${nombre}: ${res.error}`)
    else {
      log(`  ${res.omitido ? '⏭ ' : '🌐'} ${res.numeroFactura || nombre}`)
      if (!fs.existsSync(IMPORTADAS)) fs.mkdirSync(IMPORTADAS, { recursive: true })
      try { fs.renameSync(xmlPath, path.join(IMPORTADAS, nombre)) } catch {}
    }
  } catch (e) { log(`  ⚠️  ${e.message}`) }
}

async function descargarUID(cuenta, uid) {
  const client = new ImapFlow({ host: cuenta.host, port: 993, secure: true,
    auth: { user: cuenta.user, pass: cuenta.pass }, logger: false, tls: { rejectUnauthorized: false },
    socketTimeout: 60000, connectionTimeout: 15000 })
  let guardados = 0
  try {
    await client.connect()
    await client.mailboxOpen('INBOX')
    for await (const msg of client.fetch([uid], { source: true, uid: true }, { uid: true })) {
      const parsed = await simpleParser(msg.source)
      for (const adj of (parsed.attachments || [])) {
        const n = (adj.filename || '').toLowerCase()
        const ct = (adj.contentType || '').toLowerCase()
        const esXml = n.endsWith('.xml') || ct === 'text/xml' || ct === 'application/xml' ||
          (ct === 'application/octet-stream' && adj.content?.slice(0, 5).toString().includes('<?xml'))
        const esZip = n.endsWith('.zip') || ct === 'application/zip'

        if (esXml) {
          let nombre = sanitizar(adj.filename || `factura_${Date.now()}.xml`)
          if (!nombre.endsWith('.xml')) nombre += '.xml'
          if (!fs.existsSync(path.join(CARPETA, nombre)) && !fs.existsSync(path.join(IMPORTADAS, nombre))) {
            fs.writeFileSync(path.join(CARPETA, nombre), adj.content)
            log(`  ✅ XML: ${nombre}`)
            guardados++
            await importar(path.join(CARPETA, nombre), nombre, cuenta.nombre)
          }
        }
        if (esZip) {
          try {
            const zip = new AdmZip(adj.content)
            for (const e of zip.getEntries()) {
              if (e.isDirectory || !e.entryName.toLowerCase().endsWith('.xml')) continue
              const nombre = sanitizar(path.basename(e.entryName))
              if (!fs.existsSync(path.join(CARPETA, nombre)) && !fs.existsSync(path.join(IMPORTADAS, nombre))) {
                fs.writeFileSync(path.join(CARPETA, nombre), e.getData())
                log(`  ✅ ZIP→XML: ${nombre}`)
                guardados++
                await importar(path.join(CARPETA, nombre), nombre, cuenta.nombre)
              }
            }
          } catch (e) { log(`  ⚠️  ZIP: ${e.message}`) }
        }
      }
      try { await client.messageFlagsAdd({ uid: msg.uid }, ['\\Seen'], { uid: true }) } catch {}
    }
    await client.logout()
  } catch (e) {
    log(`  ⚠️  uid ${uid}: ${e.message}`)
    try { await client.logout() } catch {}
  }
  return guardados
}

async function procesarCuenta(cuenta) {
  const progreso = cargarProgreso()
  const clave = cuenta.user

  // Si ya tiene UIDs escaneados, continuar desde donde quedó
  let uids = progreso[clave]?.uids
  if (!uids) {
    uids = await escanearUIDsConFactura(cuenta)
    progreso[clave] = { uids, procesados: 0, total: 0 }
    guardarProgreso(progreso)
  } else {
    log(`\n📂 ${cuenta.nombre}: retomando desde progreso guardado (${uids.length} UIDs)`)
  }

  if (uids.length === 0) return 0

  const yaProcessados = progreso[clave].procesados || 0
  const pendientes = uids.slice(yaProcessados)
  log(`\n📥 ${cuenta.nombre}: descargando ${pendientes.length} correos con facturas...`)

  let total = progreso[clave].total || 0
  let procesados = yaProcessados

  for (let i = 0; i < pendientes.length; i++) {
    const guardados = await descargarUID(cuenta, pendientes[i])
    total += guardados
    procesados++
    // Guardar progreso cada 10 mensajes
    if (i % 10 === 0) {
      progreso[clave].procesados = procesados
      progreso[clave].total = total
      guardarProgreso(progreso)
    }
    await esperar(1000)
  }

  // Marcar cuenta como completada
  progreso[clave].procesados = procesados
  progreso[clave].total = total
  progreso[clave].completado = true
  guardarProgreso(progreso)

  log(`  ✅ ${cuenta.nombre}: ${total} facturas descargadas`)
  return total
}

async function main() {
  if (!fs.existsSync(CARPETA)) fs.mkdirSync(CARPETA, { recursive: true })
  log('═══════════════════════════════════════════')
  log('Escaneo + Descarga de facturas históricas')
  log('═══════════════════════════════════════════')

  let total = 0
  for (let i = 0; i < CUENTAS.length; i++) {
    total += await procesarCuenta(CUENTAS[i])
    if (i < CUENTAS.length - 1) await esperar(8000)
  }

  log(`═══════════════════════════════════════════`)
  log(`TOTAL IMPORTADO: ${total} facturas`)
  log(`═══════════════════════════════════════════`)
}

main().catch(err => log(`ERROR FATAL: ${err.message}`))
