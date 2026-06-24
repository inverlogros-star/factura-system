const mysql = require('mysql2/promise')
const fs = require('fs'), path = require('path')
const envPath = path.join(__dirname, '..', '.env.local')
fs.readFileSync(envPath,'utf8').split('\n').forEach(l=>{const[k,...v]=l.split('=');if(k&&v.length)process.env[k.trim()]=v.join('=').trim()})

;(async()=>{
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, user: process.env.DB_USER,
    password: process.env.DB_PASS, database: process.env.DB_NAME
  })
  await conn.execute('CALL sp_crea_entradas_conta_tmp(?,?)', ['2026-06-22','2026-06-22'])

  // Ver tipos disponibles
  const [tipos] = await conn.execute('SELECT DISTINCT Ent_Tipo, COUNT(*) as cnt FROM tmp_entradasconta GROUP BY Ent_Tipo')
  console.log('\nTipos de entradas:')
  tipos.forEach(r => console.log(' ', JSON.stringify(r)))

  // Ver entradas con NIT real (no 222222222)
  const [reales] = await conn.execute(
    'SELECT DISTINCT Ent_Numero, Ent_Nit, Emp_Razon, Ent_Fecha, Ent_NoFactura, Ent_VrFactura, Ent_Neto FROM tmp_entradasconta WHERE Ent_Nit != ? LIMIT 5',
    ['222222222']
  )
  console.log('\nEntradas con proveedor real:')
  reales.forEach(r => console.log(' ', JSON.stringify(r)))

  await conn.execute('DROP TABLE IF EXISTS tmp_entradasconta')
  await conn.end()
})().catch(console.error)
