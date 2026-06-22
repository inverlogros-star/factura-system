/**
 * Muestra los adjuntos de los correos de hoy para diagnosticar
 */
const { ImapFlow } = require('imapflow')
const { simpleParser } = require('mailparser')
const fs = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
  })
}

const CUENTAS = [
  { nombre: 'contabilidad@pacardyl.com',          host: 'imap.zoho.com',  user: 'contabilidad@pacardyl.com',          pass: process.env.PASS_CONTABILIDAD },
  { nombre: 'inverlogros@gmail.com',               host: 'imap.gmail.com', user: 'inverlogros@gmail.com',               pass: process.env.PASS_INVERLOGROS },
  { nombre: 'facturacionelectronica@pacardyl.com', host: 'imap.zoho.com',  user: 'facturacionelectronica@pacardyl.com', pass: process.env.PASS_FACTURACION },
]

async function diagnosticar(cuenta) {
  const client = new ImapFlow({
    host: cuenta.host, port: 993, secure: true,
    auth: { user: cuenta.user, pass: cuenta.pass },
    logger: false, tls: { rejectUnauthorized: false },
  })

  try {
    await client.connect()
    await client.mailboxOpen('INBOX')

    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const mensajes = await client.search({ since: hoy }, { uid: true })
    console.log(`\n=== ${cuenta.nombre} — ${mensajes.length} correos hoy ===`)

    // Primero ver solo asuntos (rápido)
    console.log('  Asuntos de los últimos 10:')
    for await (const msg of client.fetch(mensajes.slice(0, 10), { envelope: true, bodyStructure: true }, { uid: true })) {
      const asunto = msg.envelope?.subject || '(sin asunto)'
      const tiene = msg.bodyStructure ? 'tiene estructura' : 'sin estructura'
      console.log(`    [${msg.seq}] "${asunto}" — ${tiene}`)
    }
    // Luego buscar adjuntos
    console.log('\n  Adjuntos en los últimos 10:')
    let conAdjuntos = 0
    for await (const msg of client.fetch(mensajes.slice(0, 10), { source: true }, { uid: true })) {
      const parsed = await simpleParser(msg.source)
      const adjuntos = parsed.attachments || []
      if (adjuntos.length > 0) {
        console.log(`\n  📧 "${parsed.subject || '(sin asunto)'}"`)
        adjuntos.forEach(a => {
          console.log(`     📎 ${a.filename || '(sin nombre)'} — ${a.contentType} — ${a.size} bytes`)
        })
        conAdjuntos++
      }
    }
    if (conAdjuntos === 0) console.log('  Ninguno de los 10 primeros tiene adjuntos')
    await client.logout()
  } catch (err) {
    console.log(`  ❌ Error: ${err.message}`)
    try { await client.logout() } catch {}
  }
}

async function main() {
  for (const cuenta of CUENTAS) {
    await diagnosticar(cuenta)
  }
  console.log('\nDiagnóstico completado.')
}

main().catch(console.error)
