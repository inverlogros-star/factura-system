const mysql = require('mysql2/promise')
const fs = require('fs'), path = require('path')
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(l => {
    const [k, ...v] = l.split('=')
    if (k && v.length) process.env[k.trim()] = v.join('=').trim()
  })
}

;(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, user: process.env.DB_USER,
    password: process.env.DB_PASS, database: process.env.DB_NAME
  })

  const desde = process.argv[2] || '2026-06-23'
  const hasta  = process.argv[3] || '2026-06-25'

  console.log(`\nVerificando rango ${desde} → ${hasta}`)
  await conn.execute('CALL sp_crea_entradas_conta_tmp(?, ?)', [desde, hasta])

  const [todos] = await conn.execute('SELECT COUNT(*) as total, MIN(Ent_Fecha) as min, MAX(Ent_Fecha) as max FROM tmp_entradasconta')
  console.log('Total filas:', todos[0].total, '| Fechas:', todos[0].min, '→', todos[0].max)

  const [porFecha] = await conn.execute(
    'SELECT DATE(Ent_Fecha) as fecha, COUNT(DISTINCT Ent_Numero) as recibos FROM tmp_entradasconta WHERE Ent_Nit NOT IN (\'222222222\',\'99\',\'0\') GROUP BY DATE(Ent_Fecha) ORDER BY fecha'
  )
  console.log('\nRecibos por fecha (solo proveedores reales):')
  porFecha.forEach((r) => console.log(`  ${r.fecha}: ${r.recibos} recibos`))

  await conn.execute('DROP TABLE IF EXISTS tmp_entradasconta')
  await conn.end()
})().catch(console.error)
