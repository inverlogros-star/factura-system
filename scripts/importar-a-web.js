/**
 * Lee los XML de FACTURAS_PACARDYL y los sube al sistema web PACARDYL
 * Los archivos importados se mueven a la subcarpeta IMPORTADAS/
 */

const fs = require('fs')
const path = require('path')
const https = require('https')

// Cargar .env.local
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
  })
}

const APP_URL    = process.env.APP_URL || 'https://factura-system.vercel.app'
const CARPETA    = process.env.CARPETA_FACTURAS || 'C:\\Users\\SPalacio\\Documents\\PROYECTO PCARDYL\\FACTURAS_PACARDYL'
const IMPORTADAS = path.join(CARPETA, 'IMPORTADAS')
const LOG_FILE   = path.join(CARPETA, 'descarga.log')

function log(msg) {
  const ts = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })
  const linea = `[${ts}] ${msg}`
  console.log(linea)
  fs.appendFileSync(LOG_FILE, linea + '\n')
}

function postJSON(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const urlObj = new URL(url)
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }
    const req = https.request(options, res => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(body)) } catch { resolve({ error: body }) }
      })
    })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

async function main() {
  log('--- Iniciando importación a web ---')

  if (!fs.existsSync(IMPORTADAS)) fs.mkdirSync(IMPORTADAS, { recursive: true })

  const archivos = fs.readdirSync(CARPETA).filter(f => f.toLowerCase().endsWith('.xml'))

  if (archivos.length === 0) {
    log('Sin XML pendientes de importar')
    return
  }

  log(`${archivos.length} XML a importar`)
  let importados = 0, omitidos = 0, errores = 0

  for (const archivo of archivos) {
    const rutaArchivo = path.join(CARPETA, archivo)
    try {
      const xmlContent = fs.readFileSync(rutaArchivo, 'utf8')
      const resultado = await postJSON(`${APP_URL}/api/facturas/importar-xml`, {
        xmlContent,
        nombreArchivo: archivo,
        forzar: true,  // Siempre actualizar si el total es 0
      })

      if (resultado.error) {
        log(`  ❌ Error en ${archivo}: ${resultado.error}`)
        errores++
      } else if (resultado.omitido) {
        log(`  ⏭  Omitido ${archivo}: ${resultado.mensaje}`)
        // Mover igual a IMPORTADAS para no reprocesar
        fs.renameSync(rutaArchivo, path.join(IMPORTADAS, archivo))
        omitidos++
      } else {
        log(`  ✅ Importado: ${resultado.numeroFactura} (${archivo})`)
        fs.renameSync(rutaArchivo, path.join(IMPORTADAS, archivo))
        importados++
      }
    } catch (err) {
      log(`  ❌ Error procesando ${archivo}: ${err.message}`)
      errores++
    }
  }

  log(`--- Importación completada: ${importados} nuevas | ${omitidos} duplicadas | ${errores} errores ---`)
}

main().catch(err => log(`ERROR FATAL: ${err.message}`))
