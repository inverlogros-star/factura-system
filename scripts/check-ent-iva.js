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

  await conn.execute('CALL sp_crea_entradas_conta_tmp(?,?)', ['2026-06-24','2026-06-24'])

  // Ver ENCABEZADO del recibo 5300 - campos Ent_*
  const [enc] = await conn.execute(
    `SELECT DISTINCT Ent_Numero, Ent_NoFactura, Ent_Nit, Emp_Razon,
     Ent_Total, Ent_Descuentos, Ent_Bruto, Ent_Iva, Ent_IConsumo,
     Ent_Estampillas, Ent_Neto, Ent_VrFactura
     FROM tmp_entradasconta WHERE Ent_NoFactura='5300' LIMIT 1`
  )
  console.log('\nEncabezado recibo NoFactura=5300:')
  enc.forEach(r => console.log(JSON.stringify(r, null, 2)))

  // Ver muestra de otros recibos con Ent_Iva > 0
  const [conIva] = await conn.execute(
    `SELECT DISTINCT Ent_Numero, Ent_NoFactura, Ent_Iva, Ent_Neto
     FROM tmp_entradasconta WHERE Ent_Iva > 0
     AND Ent_Nit NOT IN ('222222222','99','0') LIMIT 5`
  )
  console.log('\nRecibos del día con Ent_Iva > 0:')
  conIva.forEach(r => console.log(JSON.stringify(r)))

  await conn.execute('DROP TABLE IF EXISTS tmp_entradasconta')
  await conn.end()
})().catch(console.error)
