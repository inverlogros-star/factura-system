/**
 * Descargador automático de facturas electrónicas desde correo
 * Corre cada 60 minutos vía Windows Task Scheduler
 */

const { ImapFlow } = require('imapflow')
const { simpleParser } = require('mailparser')
const AdmZip = require('adm-zip')
const fs = require('fs')
const path = require('path')

// Cargar .env.local
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
  })
}

const CARPETA_DESTINO = process.env.CARPETA_FACTURAS ||
  'C:\\Users\\SPalacio\\Documents\\PROYECTO PCARDYL\\FACTURAS_PACARDYL'

const CUENTAS = [
  { nombre: 'contabilidad@pacardyl.com',          host: 'imap.zoho.com',  user: 'contabilidad@pacardyl.com',          pass: process.env.PASS_CONTABILIDAD },
  { nombre: 'inverlogros@gmail.com',               host: 'imap.gmail.com', user: 'inverlogros@gmail.com',               pass: process.env.PASS_INVERLOGROS },
  { nombre: 'facturacionelectronica@pacardyl.com', host: 'imap.zoho.com',  user: 'facturacionelectronica@pacardyl.com', pass: process.env.PASS_FACTURACION },
]

function log(msg) {
  const ts = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })
  const linea = `[${ts}] ${msg}`
  console.log(linea)
  const logFile = path.join(CARPETA_DESTINO, 'descarga.log')
  fs.appendFileSync(logFile, linea + '\n', 'utf8')
}

function sanitizar(nombre) {
  return nombre.replace(/[^a-zA-Z0-9._\-]/g, '_').slice(0, 100)
}

async function procesarMensaje(msg, cuenta) {
  let descargados = 0
  try {
    const parsed = await simpleParser(msg.source)
    const adjuntos = (parsed.attachments || []).filter(a => {
      const n = (a.filename || '').toLowerCase()
      return n.endsWith('.xml') || n.endsWith('.zip')
    })

    for (const adjunto of adjuntos) {
      const nombre = (adjunto.filename || '').toLowerCase()

      if (nombre.endsWith('.xml')) {
        const nombreBase = sanitizar(adjunto.filename)
        const destino = path.join(CARPETA_DESTINO, nombreBase)
        if (fs.existsSync(destino)) { log(`  Omitido (ya existe): ${nombreBase}`); continue }
        fs.writeFileSync(destino, adjunto.content)
        log(`  ✅ XML: ${nombreBase} (${cuenta.nombre})`)
        descargados++
      }

      if (nombre.endsWith('.zip')) {
        try {
          const zip = new AdmZip(adjunto.content)
          const entradas = zip.getEntries().filter(e =>
            !e.isDirectory && e.entryName.toLowerCase().endsWith('.xml')
          )
          for (const entrada of entradas) {
            const nombreXml = sanitizar(path.basename(entrada.entryName))
            const destino = path.join(CARPETA_DESTINO, nombreXml)
            if (fs.existsSync(destino)) { log(`  Omitido (ya existe): ${nombreXml}`); continue }
            fs.writeFileSync(destino, entrada.getData())
            log(`  ✅ ZIP→XML: ${nombreXml} (${cuenta.nombre})`)
            descargados++
          }
        } catch (err) {
          log(`  ⚠️  Error ZIP ${adjunto.filename}: ${err.message}`)
        }
      }
    }
  } catch (err) {
    log(`  ⚠️  Error procesando mensaje: ${err.message}`)
  }
  return descargados
}

async function procesarCuenta(cuenta) {
  if (!cuenta.pass) { log(`⚠️  ${cuenta.nombre}: sin contraseña`); return 0 }

  const client = new ImapFlow({
    host: cuenta.host, port: 993, secure: true,
    auth: { user: cuenta.user, pass: cuenta.pass },
    logger: false,
    tls: { rejectUnauthorized: false },
    socketTimeout: 30000,
    connectionTimeout: 15000,
  })

  let descargados = 0
  try {
    await client.connect()
    log(`✓ Conectado a ${cuenta.nombre}`)
    await client.mailboxOpen('INBOX')

    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const mensajes = await client.search({ since: hoy }, { uid: true })

    if (mensajes.length === 0) {
      log(`  ${cuenta.nombre}: sin correos hoy`)
      await client.logout()
      return 0
    }
    log(`  ${cuenta.nombre}: ${mensajes.length} correo(s) hoy`)

    // Lotes de 3 para evitar timeouts con ZIPs grandes
    const LOTE = 3
    for (let i = 0; i < mensajes.length; i += LOTE) {
      const lote = mensajes.slice(i, i + LOTE)
      try {
        for await (const msg of client.fetch(lote, { source: true, uid: true }, { uid: true })) {
          descargados += await procesarMensaje(msg, cuenta)
          // Marcar como leído
          try { await client.messageFlagsAdd({ uid: msg.uid }, ['\\Seen'], { uid: true }) } catch {}
        }
      } catch (err) {
        log(`  ⚠️  Error en lote ${i}-${i + LOTE}: ${err.message}`)
      }
    }

    await client.logout()
  } catch (err) {
    log(`❌ Error en ${cuenta.nombre}: ${err.message}`)
    try { await client.logout() } catch {}
  }
  return descargados
}

async function main() {
  log('═══════════════════════════════════════════')
  log('Iniciando descarga de facturas electrónicas')
  log('═══════════════════════════════════════════')

  if (!fs.existsSync(CARPETA_DESTINO)) fs.mkdirSync(CARPETA_DESTINO, { recursive: true })

  let total = 0
  for (const cuenta of CUENTAS) {
    total += await procesarCuenta(cuenta)
  }

  log(`═══════════════════════════════════════════`)
  log(`Total descargados: ${total} XML`)
  log(`═══════════════════════════════════════════`)
}

main().then(() => {
  const { execSync } = require('child_process')
  const importScript = path.join(__dirname, 'importar-a-web.js')
  try {
    execSync(`"${process.execPath}" "${importScript}"`, { stdio: 'inherit', cwd: path.join(__dirname, '..') })
  } catch (err) {
    log(`Error al importar a web: ${err.message}`)
  }
}).catch(err => {
  log(`ERROR FATAL: ${err.message}`)
  process.exit(1)
})
