const mysql = require('mysql2/promise')
const https = require('https')
const fs = require('fs'), path = require('path')
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath,'utf8').split('\n').forEach(l=>{const[k,...v]=l.split('=');if(k&&v.length)process.env[k.trim()]=v.join('=').trim()})
}

function get(url) { return new Promise(r=>{https.get(url,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>r(JSON.parse(d)))}).on('error',()=>r([]))}) }

;(async () => {
  const conn = await mysql.createConnection({
    host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASS,database:process.env.DB_NAME
  })

  // Buscar en junio 25
  await conn.execute('CALL sp_crea_entradas_conta_tmp(?,?)',['2026-06-25','2026-06-25'])
  const [enc] = await conn.execute(
    "SELECT DISTINCT Ent_Numero,Ent_NoFactura,Ent_Iva,Ent_Neto,Ent_Bruto,Ent_Descuentos,Ent_IConsumo,Ent_Total FROM tmp_entradasconta WHERE Ent_NoFactura='5300' LIMIT 1"
  )
  console.log('MySQL - Encabezado recibo NoFactura=5300 (Jun 25):')
  console.log(JSON.stringify(enc[0] || 'NO ENCONTRADO'))

  await conn.execute('DROP TABLE IF EXISTS tmp_entradasconta')
  await conn.end()

  // Verificar qué tiene el recibo en Vercel
  const APP_URL = process.env.APP_URL || 'https://factura-system.vercel.app'
  const recibos = await get(`${APP_URL}/api/recibos`)
  const r = recibos.find(x => x.numeroFacturaProveedor === '5300')
  if (r) {
    console.log('\nVercel - Recibo almacenado:')
    console.log('  numeroRecibo:', r.numeroRecibo)
    console.log('  total:', r.total)
    console.log('  totales:', JSON.stringify(r.totales))
    console.log('  productos[0].iva:', r.productos?.[0]?.iva)
  } else {
    console.log('\nNO se encontró recibo con noFactura=5300 en Vercel')
  }
})().catch(console.error)
