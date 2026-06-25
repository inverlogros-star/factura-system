/**
 * Elimina facturas donde el numeroFactura es un CUFE/UUID (hash hexadecimal largo)
 * Estos son XMLs que el parser no pudo leer correctamente
 */
const https = require('https')
const fs = require('fs'), path = require('path')
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(l => {
    const [k, ...v] = l.split('=')
    if (k && v.length) process.env[k.trim()] = v.join('=').trim()
  })
}
const APP_URL = process.env.APP_URL || 'https://factura-system.vercel.app'

function get(url) {
  return new Promise(r => { https.get(url, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>r(JSON.parse(d))) }).on('error',()=>r([])) })
}
function del(url) {
  return new Promise(r => {
    const u = new URL(url)
    const req = https.request({ hostname:u.hostname, path:u.pathname, method:'DELETE' }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>r()) })
    req.on('error',()=>r()); req.end()
  })
}

function esCUFE(num) {
  return num && num.length > 30 && /^[a-f0-9-]+$/i.test(num)
}

;(async () => {
  console.log('Buscando facturas con CUFE como número...')
  const facturas = await get(`${APP_URL}/api/facturas`)
  const malformadas = facturas.filter(f => esCUFE(f.numeroFactura))
  console.log(`Encontradas: ${malformadas.length} facturas malformadas`)
  malformadas.slice(0, 5).forEach(f => console.log(' -', f.numeroFactura.slice(0,40)+'...', f.proveedor || '(sin proveedor)'))

  if (malformadas.length === 0) { console.log('Sin registros a eliminar.'); return }

  let eliminadas = 0
  for (const f of malformadas) {
    await del(`${APP_URL}/api/facturas/${f.id}`)
    eliminadas++
  }
  console.log(`✅ ${eliminadas} facturas malformadas eliminadas`)
})().catch(console.error)
