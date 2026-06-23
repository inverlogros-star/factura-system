/**
 * Descargador de facturas — conexión individual por mensaje para evitar timeouts
 */
const { ImapFlow } = require('imapflow')
const { simpleParser } = require('mailparser')
const AdmZip = require('adm-zip')
const fs = require('fs')
const path = require('path')
const https = require('https')

process.on('uncaughtException', err => console.error(`[ERROR] ${err.message}`))
process.on('unhandledRejection', err => console.error(`[REJECTION] ${err}`))

const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
  })
}

const CARPETA = process.env.CARPETA_FACTURAS || 'C:\\Users\\SPalacio\\Documents\\PROYECTO PCARDYL\\FACTURAS_PACARDYL'

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

function sanitizar(nombre) {
  return nombre.replace(/[^a-zA-Z0-9._\-]/g, '_').slice(0, 100)
}

const APP_URL = process.env.APP_URL || 'https://factura-system.vercel.app'
const IMPORTADAS = path.join(CARPETA, 'IMPORTADAS')

function postJSON(url, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body)
    const u = new URL(url)
    const req = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, res => {
      let buf = ''
      res.on('data', c => buf += c)
      res.on('end', () => { try { resolve(JSON.parse(buf)) } catch { resolve({ error: buf }) } })
    })
    req.on('error', e => resolve({ error: e.message }))
    req.write(data); req.end()
  })
}

async function importarAWeb(xmlPath, nombreArchivo, correoOrigen) {
  try {
    const xmlContent = fs.readFileSync(xmlPath, 'utf8')
    const res = await postJSON(`${APP_URL}/api/facturas/importar-xml`, { xmlContent, nombreArchivo, correoOrigen })
    if (res.error) {
      log(`  ⚠️  No importado ${nombreArchivo}: ${res.error}`)
    } else if (res.omitido) {
      log(`  ⏭  Ya existía en sistema: ${nombreArchivo}`)
      // Mover a IMPORTADAS igual
      if (!fs.existsSync(IMPORTADAS)) fs.mkdirSync(IMPORTADAS, { recursive: true })
      try { fs.renameSync(xmlPath, path.join(IMPORTADAS, nombreArchivo)) } catch {}
    } else {
      log(`  🌐 Subido al sistema: ${res.numeroFactura || nombreArchivo}`)
      if (!fs.existsSync(IMPORTADAS)) fs.mkdirSync(IMPORTADAS, { recursive: true })
      try { fs.renameSync(xmlPath, path.join(IMPORTADAS, nombreArchivo)) } catch {}
    }
  } catch (e) {
    log(`  ⚠️  Error importando ${nombreArchivo}: ${e.message}`)
  }
}

function esperar(ms) { return new Promise(r => setTimeout(r, ms)) }

function crearCliente(cuenta) {
  return new ImapFlow({
    host: cuenta.host, port: 993, secure: true,
    auth: { user: cuenta.user, pass: cuenta.pass },
    logger: false,
    tls: { rejectUnauthorized: false },
    socketTimeout: 30000,
    connectionTimeout: 15000,
  })
}

function tieneFactura(bodyStructure) {
  if (!bodyStructure) return false
  const str = JSON.stringify(bodyStructure).toLowerCase()
  return str.includes('.zip') || str.includes('.xml') ||
    str.includes('application/zip') || str.includes('application/xml') ||
    str.includes('text/xml') || str.includes('application/octet-stream')
}

async function guardarAdjunto(adjunto, descargados) {
  const n = (adjunto.filename || '').toLowerCase()
  const ct = (adjunto.contentType || '').toLowerCase()
  const esXml = n.endsWith('.xml') || ct.includes('xml') ||
    (ct === 'application/octet-stream' && adjunto.content?.slice(0, 10).toString().includes('<?xml'))

  if (esXml) {
    let nombre = sanitizar(adjunto.filename || `factura_${Date.now()}.xml`)
    if (!nombre.endsWith('.xml')) nombre += '.xml'
    const destino = path.join(CARPETA, nombre)
    if (fs.existsSync(destino) || fs.existsSync(path.join(IMPORTADAS, nombre))) {
      log(`  Omitido: ${nombre}`); return
    }
    fs.writeFileSync(destino, adjunto.content)
    log(`  ✅ XML: ${nombre}`)
    descargados.count++
    await importarAWeb(destino, nombre, cuenta.nombre)
  }

  if (n.endsWith('.zip') || ct.includes('zip')) {
    try {
      const zip = new AdmZip(adjunto.content)
      for (const e of zip.getEntries()) {
        if (!e.isDirectory && e.entryName.toLowerCase().endsWith('.xml')) {
          const nombre = sanitizar(path.basename(e.entryName))
          if (fs.existsSync(path.join(CARPETA, nombre)) || fs.existsSync(path.join(IMPORTADAS, nombre))) {
            log(`  Omitido: ${nombre}`); continue
          }
          const destino = path.join(CARPETA, nombre)
          fs.writeFileSync(destino, e.getData())
          log(`  ✅ ZIP→XML: ${nombre}`)
          descargados.count++
          await importarAWeb(destino, nombre, cuenta.nombre)
        }
      }
    } catch (e) { log(`  ⚠️  Error ZIP: ${e.message}`) }
  }
}

// Descarga UN solo mensaje usando una conexión dedicada
async function descargarMensaje(cuenta, uid) {
  const client = crearCliente(cuenta)
  try {
    await client.connect()
    await client.mailboxOpen('INBOX')
    const descargados = { count: 0 }
    for await (const msg of client.fetch([uid], { source: true, uid: true }, { uid: true })) {
      const parsed = await simpleParser(msg.source)
      for (const adj of (parsed.attachments || [])) {
        await guardarAdjunto(adj, descargados)
      }
      // Marcar como leído
      try { await client.messageFlagsAdd({ uid: msg.uid }, ['\\Seen'], { uid: true }) } catch {}
    }
    await client.logout()
    return descargados.count
  } catch (err) {
    log(`  ⚠️  Error descargando uid ${uid}: ${err.message}`)
    try { await client.logout() } catch {}
    return 0
  }
}

async function procesarCuenta(cuenta) {
  if (!cuenta.pass) { log(`⚠️  ${cuenta.nombre}: sin contraseña`); return 0 }
  log(`Procesando ${cuenta.nombre}...`)

  // Paso 1: obtener UIDs de hoy con attachments relevantes
  const client = crearCliente(cuenta)
  let uidsConFactura = []
  try {
    await client.connect()
    await client.mailboxOpen('INBOX')
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const todosHoy = await client.search({ since: hoy }, { uid: true })
    if (todosHoy.length === 0) { log(`  ${cuenta.nombre}: sin correos hoy`); await client.logout(); return 0 }
    log(`  ${cuenta.nombre}: ${todosHoy.length} correo(s) hoy`)

    for await (const msg of client.fetch(todosHoy, { bodyStructure: true, uid: true }, { uid: true })) {
      if (tieneFactura(msg.bodyStructure)) uidsConFactura.push(msg.uid)
    }
    await client.logout()
  } catch (err) {
    log(`  ❌ Error explorando ${cuenta.nombre}: ${err.message}`)
    try { await client.logout() } catch {}
    return 0
  }

  if (uidsConFactura.length === 0) { log(`  ${cuenta.nombre}: ningún correo con facturas`); return 0 }
  log(`  ${cuenta.nombre}: ${uidsConFactura.length} correo(s) con facturas`)

  // Paso 2: descargar cada mensaje con conexión propia
  let total = 0
  for (let i = 0; i < uidsConFactura.length; i++) {
    const uid = uidsConFactura[i]
    total += await descargarMensaje(cuenta, uid)
    // Pequeña pausa entre mensajes para no saturar Zoho
    if (i < uidsConFactura.length - 1) await esperar(1500)
  }
  return total
}

async function main() {
  log('═══════════════════════════════════════════')
  log('Iniciando descarga de facturas electrónicas')
  log('═══════════════════════════════════════════')
  if (!fs.existsSync(CARPETA)) fs.mkdirSync(CARPETA, { recursive: true })

  let total = 0
  for (let i = 0; i < CUENTAS.length; i++) {
    total += await procesarCuenta(CUENTAS[i])
    if (i < CUENTAS.length - 1) await esperar(5000)
  }
  log(`═══════════════════════════════════════════`)
  log(`Total descargados: ${total} XML`)
  log(`═══════════════════════════════════════════`)
}

main().catch(err => { log(`ERROR FATAL: ${err.message}`) })
