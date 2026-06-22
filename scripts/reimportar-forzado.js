/**
 * Elimina todas las facturas existentes y las reimporta con el parser corregido
 */
const https = require('https')
const fs = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
  })
}

const APP_URL = process.env.APP_URL || 'https://factura-system.vercel.app'
const CARPETA = process.env.CARPETA_FACTURAS || 'C:\\Users\\SPalacio\\Documents\\PROYECTO PCARDYL\\FACTURAS_PACARDYL'

function peticion(method, url, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null
    const u = new URL(url)
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search,
      method, headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, res => {
      let buf = ''
      res.on('data', c => buf += c)
      res.on('end', () => { try { resolve(JSON.parse(buf)) } catch { resolve({ raw: buf }) } })
    })
    req.on('error', e => resolve({ error: e.message }))
    if (data) req.write(data)
    req.end()
  })
}

async function main() {
  console.log('=== REIMPORTACIÓN FORZADA ===')

  // 1. Obtener todas las facturas existentes
  console.log('1. Obteniendo facturas existentes...')
  const facturas = await peticion('GET', `${APP_URL}/api/facturas`)
  if (!Array.isArray(facturas)) { console.error('Error obteniendo facturas:', facturas); return }
  console.log(`   ${facturas.length} facturas encontradas`)

  // 2. Eliminar todas
  console.log('2. Eliminando facturas existentes...')
  for (const f of facturas) {
    await peticion('DELETE', `${APP_URL}/api/facturas/${f.id}`)
    process.stdout.write('.')
  }
  console.log(` ${facturas.length} eliminadas`)

  // 3. Reimportar desde XMLs locales
  const xmls = fs.readdirSync(CARPETA).filter(f => f.toLowerCase().endsWith('.xml'))
  console.log(`3. Reimportando ${xmls.length} XMLs...`)

  let importados = 0, errores = 0
  for (const archivo of xmls) {
    const ruta = path.join(CARPETA, archivo)
    try {
      const xmlContent = fs.readFileSync(ruta, 'utf8')
      const res = await peticion('POST', `${APP_URL}/api/facturas/importar-xml`, { xmlContent, nombreArchivo: archivo })
      if (res.error) {
        console.log(`  ❌ ${archivo}: ${res.error}`)
        errores++
      } else {
        console.log(`  ✅ ${res.numeroFactura || archivo}`)
        importados++
        // Mover a IMPORTADAS
        const imp = path.join(CARPETA, 'IMPORTADAS')
        if (!fs.existsSync(imp)) fs.mkdirSync(imp)
        try { fs.renameSync(ruta, path.join(imp, archivo)) } catch {}
      }
    } catch (e) { console.log(`  ❌ ${archivo}: ${e.message}`); errores++ }
  }

  console.log(`\n=== COMPLETADO: ${importados} importadas | ${errores} errores ===`)
}

main().catch(console.error)
