/**
 * Descargador automático de facturas electrónicas desde correo
 * Corre cada 60 minutos vía Windows Task Scheduler
 * Los XML descargados se guardan en FACTURAS_PACARDYL/
 * Los correos se marcan como leídos para evitar duplicados
 */

const { ImapFlow } = require('imapflow')
const { simpleParser } = require('mailparser')
const AdmZip = require('adm-zip')
const fs = require('fs')
const path = require('path')

// Cargar variables de entorno desde .env.local
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
  {
    nombre: 'contabilidad@pacardyl.com',
    host: process.env.IMAP_HOST_ZOHO || 'imap.zoho.com',
    port: 993,
    user: 'contabilidad@pacardyl.com',
    pass: process.env.PASS_CONTABILIDAD,
  },
  {
    nombre: 'inverlogros@gmail.com',
    host: process.env.IMAP_HOST_GMAIL || 'imap.gmail.com',
    port: 993,
    user: 'inverlogros@gmail.com',
    pass: process.env.PASS_INVERLOGROS,
  },
  {
    nombre: 'facturacionelectronica@pacardyl.com',
    host: process.env.IMAP_HOST_ZOHO || 'imap.zoho.com',
    port: 993,
    user: 'facturacionelectronica@pacardyl.com',
    pass: process.env.PASS_FACTURACION,
  },
]

// Log con timestamp
function log(msg) {
  const ts = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })
  const linea = `[${ts}] ${msg}`
  console.log(linea)
  const logFile = path.join(CARPETA_DESTINO, 'descarga.log')
  fs.appendFileSync(logFile, linea + '\n')
}

// Sanitizar nombre de archivo
function sanitizar(nombre) {
  return nombre.replace(/[^a-zA-Z0-9._\-]/g, '_').slice(0, 100)
}

async function procesarCuenta(cuenta) {
  if (!cuenta.pass) {
    log(`⚠️  ${cuenta.nombre}: sin contraseña configurada, omitiendo`)
    return 0
  }

  const client = new ImapFlow({
    host: cuenta.host,
    port: cuenta.port,
    secure: true,
    auth: { user: cuenta.user, pass: cuenta.pass },
    logger: false,
    tls: { rejectUnauthorized: false },
  })

  let descargados = 0

  try {
    await client.connect()
    log(`✓ Conectado a ${cuenta.nombre}`)

    await client.mailboxOpen('INBOX')

    // Buscar correos NO leídos de los últimos 30 días
    const desde = new Date()
    desde.setDate(desde.getDate() - 30)
    const mensajes = await client.search(
      { seen: false, since: desde },
      { uid: true }
    )

    if (mensajes.length === 0) {
      log(`  ${cuenta.nombre}: sin correos nuevos`)
      await client.logout()
      return 0
    }

    log(`  ${cuenta.nombre}: ${mensajes.length} correo(s) sin leer`)

    for await (const msg of client.fetch(mensajes, { source: true, uid: true })) {
      try {
        const parsed = await simpleParser(msg.source)
        const adjuntos = (parsed.attachments || []).filter(a => {
          const nombre = a.filename?.toLowerCase() || ''
          return nombre.endsWith('.xml') || nombre.endsWith('.zip')
        })

        if (adjuntos.length === 0) continue

        for (const adjunto of adjuntos) {
          const nombre = (adjunto.filename || '').toLowerCase()

          // Adjunto XML directo
          if (nombre.endsWith('.xml')) {
            const nombreBase = sanitizar(adjunto.filename)
            const destino = path.join(CARPETA_DESTINO, nombreBase)
            if (fs.existsSync(destino)) { log(`  Omitido (ya existe): ${nombreBase}`); continue }
            fs.writeFileSync(destino, adjunto.content)
            log(`  ✅ XML descargado: ${nombreBase} (${cuenta.nombre})`)
            descargados++
          }

          // Adjunto ZIP — extraer los XML que contiene
          if (nombre.endsWith('.zip')) {
            try {
              const zip = new AdmZip(adjunto.content)
              const entradas = zip.getEntries().filter(e =>
                e.entryName.toLowerCase().endsWith('.xml') && !e.isDirectory
              )
              if (entradas.length === 0) continue
              for (const entrada of entradas) {
                const nombreXml = sanitizar(path.basename(entrada.entryName))
                const destino = path.join(CARPETA_DESTINO, nombreXml)
                if (fs.existsSync(destino)) { log(`  Omitido (ya existe): ${nombreXml}`); continue }
                fs.writeFileSync(destino, entrada.getData())
                log(`  ✅ XML extraído de ZIP: ${nombreXml} (${cuenta.nombre})`)
                descargados++
              }
            } catch (zipErr) {
              log(`  ⚠️  Error al descomprimir ZIP: ${zipErr.message}`)
            }
          }
        }

        // Marcar como leído para no duplicar
        await client.messageFlagsAdd({ uid: msg.uid }, ['\\Seen'])
      } catch (err) {
        log(`  ⚠️  Error procesando mensaje: ${err.message}`)
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

  if (!fs.existsSync(CARPETA_DESTINO)) {
    fs.mkdirSync(CARPETA_DESTINO, { recursive: true })
    log(`Carpeta creada: ${CARPETA_DESTINO}`)
  }

  let total = 0
  for (const cuenta of CUENTAS) {
    total += await procesarCuenta(cuenta)
  }

  log(`═══════════════════════════════════════════`)
  log(`Total descargados: ${total} archivo(s) XML`)
  log(`═══════════════════════════════════════════`)
}

main().then(() => {
  // Después de descargar, importar automáticamente al sistema web
  const { execSync } = require('child_process')
  const nodePath = process.execPath
  const importScript = path.join(__dirname, 'importar-a-web.js')
  try {
    execSync(`"${nodePath}" "${importScript}"`, { stdio: 'inherit', cwd: path.join(__dirname, '..') })
  } catch (err) {
    log(`Error al importar a web: ${err.message}`)
  }
}).catch(err => {
  log(`ERROR FATAL: ${err.message}`)
  process.exit(1)
})
