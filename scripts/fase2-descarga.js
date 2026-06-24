/**
 * FASE 2 - Descarga directa de facturas sin escaneo previo
 * Procesa todos los no leídos en lotes, guarda ZIP/XML e importa al sistema
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
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(l => {
    const [k, ...v] = l.split('=')
    if (k && v.length) process.env[k.trim()] = v.join('=').trim()
  })
}

const CARPETA  = process.env.CARPETA_FACTURAS || 'C:\\Users\\SPalacio\\Documents\\PROYECTO PCARDYL\\FACTURAS_PACARDYL'
const APP_URL  = process.env.APP_URL || 'https://factura-system.vercel.app'
const IMPORTADAS = path.join(CARPETA, 'IMPORTADAS')

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

async function importar(xmlPath, nombre, correoOrigen) {
  try {
    const xmlContent = fs.readFileSync(xmlPath, 'utf8')
    const res = await postJSON(`${APP_URL}/api/facturas/importar-xml`, { xmlContent, nombreArchivo: nombre, correoOrigen })
    if (res.error) { log(`  ⚠️  ${nombre}: ${res.error}`) }
    else {
      const label = res.omitido ? `⏭  Ya existe` : `🌐 ${res.numeroFactura || nombre}`
      log(`  ${label}`)
      if (!fs.existsSync(IMPORTADAS)) fs.mkdirSync(IMPORTADAS, { recursive: true })
      try { fs.renameSync(xmlPath, path.join(IMPORTADAS, nombre)) } catch {}
    }
  } catch (e) { log(`  ⚠️  Error importando ${nombre}: ${e.message}`) }
}

async function procesarMensaje(source, cuentaNombre) {
  let guardados = 0
  try {
    const parsed = await simpleParser(source)
    for (const adj of (parsed.attachments || [])) {
      const n = (adj.filename || '').toLowerCase()
      const ct = (adj.contentType || '').toLowerCase()

      // XML directo (excluir docx, xlsx, etc. que también contienen 'xml' en su MIME)
      const esXmlReal = n.endsWith('.xml') ||
        ct === 'text/xml' || ct === 'application/xml' ||
        (ct === 'application/octet-stream' && adj.content?.slice(0, 5).toString().includes('<?xml'))
      if (esXmlReal) {
        let nombre = sanitizar(adj.filename || `factura_${Date.now()}.xml`)
        if (!nombre.endsWith('.xml')) nombre += '.xml'
        if (fs.existsSync(path.join(CARPETA, nombre)) || fs.existsSync(path.join(IMPORTADAS, nombre))) continue
        fs.writeFileSync(path.join(CARPETA, nombre), adj.content)
        log(`  ✅ XML: ${nombre}`)
        guardados++
        await importar(path.join(CARPETA, nombre), nombre, cuentaNombre)
      }

      // ZIP con XMLs adentro
      if (n.endsWith('.zip') || ct.includes('zip')) {
        try {
          const zip = new AdmZip(adj.content)
          for (const e of zip.getEntries()) {
            if (e.isDirectory || !e.entryName.toLowerCase().endsWith('.xml')) continue
            const nombre = sanitizar(path.basename(e.entryName))
            if (fs.existsSync(path.join(CARPETA, nombre)) || fs.existsSync(path.join(IMPORTADAS, nombre))) continue
            fs.writeFileSync(path.join(CARPETA, nombre), e.getData())
            log(`  ✅ ZIP→XML: ${nombre}`)
            guardados++
            await importar(path.join(CARPETA, nombre), nombre, cuentaNombre)
          }
        } catch (e) { log(`  ⚠️  Error ZIP: ${e.message}`) }
      }
    }
  } catch (e) { log(`  ⚠️  Error parseando mensaje: ${e.message}`) }
  return guardados
}

async function procesarCuenta(cuenta) {
  if (!cuenta.pass) { log(`⚠️  ${cuenta.nombre}: sin contraseña`); return 0 }
  log(`\n📬 ${cuenta.nombre}`)

  let total = 0
  let offset = 0
  const LOTE = 50  // descargar 50 mensajes por conexión

  // Obtener todos los UIDs no leídos
  const clientScan = new ImapFlow({ host: cuenta.host, port: 993, secure: true,
    auth: { user: cuenta.user, pass: cuenta.pass }, logger: false, tls: { rejectUnauthorized: false },
    socketTimeout: 30000, connectionTimeout: 15000 })

  let uids = []
  try {
    await clientScan.connect()
    await clientScan.mailboxOpen('INBOX')
    uids = await clientScan.search({ seen: false }, { uid: true })
    await clientScan.logout()
    log(`  ${uids.length} correos no leídos`)
  } catch (e) { log(`  ❌ Error obteniendo UIDs: ${e.message}`); return 0 }

  if (uids.length === 0) { log(`  Sin correos no leídos`); return 0 }

  // Descargar en lotes de LOTE mensajes por conexión
  while (offset < uids.length) {
    const lote = uids.slice(offset, offset + LOTE)
    log(`  Descargando mensajes ${offset + 1}-${offset + lote.length} de ${uids.length}...`)

    const client = new ImapFlow({ host: cuenta.host, port: 993, secure: true,
      auth: { user: cuenta.user, pass: cuenta.pass }, logger: false, tls: { rejectUnauthorized: false },
      socketTimeout: 60000, connectionTimeout: 15000 })

    try {
      await client.connect()
      await client.mailboxOpen('INBOX')

      for await (const msg of client.fetch(lote, { source: true, uid: true }, { uid: true })) {
        const guardados = await procesarMensaje(msg.source, cuenta.nombre)
        total += guardados
        if (guardados > 0) {
          try { await client.messageFlagsAdd({ uid: msg.uid }, ['\\Seen'], { uid: true }) } catch {}
        }
      }
      await client.logout()
    } catch (e) {
      log(`  ⚠️  Error en lote ${offset}: ${e.message}`)
      try { await client.logout() } catch {}
      await esperar(5000)
    }

    offset += LOTE
    await esperar(2000)  // pausa entre lotes
  }

  return total
}

async function main() {
  if (!fs.existsSync(CARPETA)) fs.mkdirSync(CARPETA, { recursive: true })
  log('═══════════════════════════════════════════')
  log('FASE 2 — Descarga directa de facturas')
  log('═══════════════════════════════════════════')

  let total = 0
  for (let i = 0; i < CUENTAS.length; i++) {
    total += await procesarCuenta(CUENTAS[i])
    if (i < CUENTAS.length - 1) await esperar(8000)
  }

  log(`═══════════════════════════════════════════`)
  log(`TOTAL DESCARGADO E IMPORTADO: ${total} facturas`)
  log(`═══════════════════════════════════════════`)
}

main().catch(err => log(`ERROR FATAL: ${err.message}`))
