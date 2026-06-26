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

  // Buscar el recibo con últimos 4 = 5300 en fecha 2026-06-24
  await conn.execute('CALL sp_crea_entradas_conta_tmp(?,?)', ['2026-06-24','2026-06-24'])

  const [filas] = await conn.execute(
    "SELECT Ent_Numero, EntDet_Articulo, EntDet_CanRec, EntDet_CostoNeto, EntDet_Iva, TotalVrIva, TotalVrIBUA, TotalVrICUI, Ent_NoFactura FROM tmp_entradasconta WHERE Ent_NoFactura='5300' LIMIT 5"
  )

  console.log('\nDatos del recibo con NoFactura=5300:')
  filas.forEach(r => console.log(JSON.stringify(r)))

  // Si no hay con 5300, mostrar primeras 3 filas del día
  if (filas.length === 0) {
    const [sample] = await conn.execute(
      "SELECT Ent_Numero, EntDet_Articulo, EntDet_CanRec, EntDet_CostoNeto, EntDet_Iva, TotalVrIva, TotalVrIBUA, TotalVrICUI, Ent_NoFactura FROM tmp_entradasconta WHERE Ent_Nit NOT IN ('222222222','99','0') LIMIT 3"
    )
    console.log('\nPrimeras 3 filas del día (muestra):')
    sample.forEach(r => console.log(JSON.stringify(r)))
  }

  await conn.execute('DROP TABLE IF EXISTS tmp_entradasconta')
  await conn.end()
})().catch(console.error)
