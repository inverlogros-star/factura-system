/**
 * Elimina facturas, comparaciones y recibos anteriores a Mayo 2026
 * Ejecutar: node scripts/limpiar-antiguos.js
 */

const https = require('https')
const fs    = require('fs')
const path  = require('path')

const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(l => {
    const [k, ...v] = l.split('=')
    if (k && v.length) process.env[k.trim()] = v.join('=').trim()
  })
}

const APP_URL   = process.env.APP_URL || 'https://factura-system.vercel.app'
const CORTE     = '2026-05-01'  // eliminar todo ANTES de esta fecha

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let d = ''; res.on('data', c => d += c)
      res.on('end', () => { try { resolve(JSON.parse(d)) } catch { resolve([]) } })
    }).on('error', reject)
  })
}

function del(url) {
  return new Promise(resolve => {
    const u = new URL(url)
    const req = https.request({ hostname: u.hostname, path: u.pathname, method: 'DELETE' },
      res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve()) })
    req.on('error', () => resolve())
    req.end()
  })
}

async function main() {
  console.log(`\n🗑️  Limpiando documentos anteriores a ${CORTE}...\n`)

  // ── 1. Facturas ─────────────────────────────────────────────────────────────
  console.log('Obteniendo facturas...')
  const facturas = await get(`${APP_URL}/api/facturas`)
  const facturasViejas = facturas.filter(f => f.fecha && f.fecha < CORTE)
  console.log(`  Total: ${facturas.length} | A eliminar: ${facturasViejas.length}`)

  let fEliminadas = 0
  for (const f of facturasViejas) {
    await del(`${APP_URL}/api/facturas/${f.id}`)
    fEliminadas++
    if (fEliminadas % 50 === 0) process.stdout.write(`  ${fEliminadas}/${facturasViejas.length}...\r`)
  }
  console.log(`  ✅ ${fEliminadas} facturas eliminadas`)

  // ── 2. Comparaciones ────────────────────────────────────────────────────────
  console.log('\nObteniendo comparaciones...')
  const comparaciones = await get(`${APP_URL}/api/comparaciones`)
  // Eliminar comparaciones cuya factura fue eliminada
  const idsFacturasEliminadas = new Set(facturasViejas.map(f => f.id))
  const compViejas = comparaciones.filter(c => idsFacturasEliminadas.has(c.facturaId))
  console.log(`  Total: ${comparaciones.length} | A eliminar: ${compViejas.length}`)

  let cEliminadas = 0
  for (const c of compViejas) {
    await del(`${APP_URL}/api/comparaciones/${c.id}`)
    cEliminadas++
  }
  console.log(`  ✅ ${cEliminadas} comparaciones eliminadas`)

  // ── 3. Recibos ──────────────────────────────────────────────────────────────
  console.log('\nObteniendo recibos...')
  const recibos = await get(`${APP_URL}/api/recibos`)
  const recibosViejos = recibos.filter(r => r.fecha && r.fecha < CORTE)
  console.log(`  Total: ${recibos.length} | A eliminar: ${recibosViejos.length}`)

  let rEliminados = 0
  for (const r of recibosViejos) {
    await del(`${APP_URL}/api/recibos/${r.id}`)
    rEliminados++
    if (rEliminados % 50 === 0) process.stdout.write(`  ${rEliminados}/${recibosViejos.length}...\r`)
  }
  console.log(`  ✅ ${rEliminados} recibos eliminados`)

  console.log('\n════════════════════════════════')
  console.log(`RESUMEN:`)
  console.log(`  Facturas eliminadas:     ${fEliminadas}`)
  console.log(`  Comparaciones eliminadas: ${cEliminadas}`)
  console.log(`  Recibos eliminados:      ${rEliminados}`)
  console.log(`  Fecha de corte:          ${CORTE}`)
  console.log('════════════════════════════════\n')
}

main().catch(err => { console.error('ERROR:', err.message); process.exit(1) })
