'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GitCompareArrows, ChevronDown, ChevronUp, FileDown, CheckSquare, Square, Trash2 } from 'lucide-react'
import { storeFacturas, storeRecibos, storeComparaciones } from '@/lib/store'
import { compararFacturaConRecibo, encontrarReciboPorFactura, ultimos4Digitos } from '@/lib/comparador'
import { generarInformePDF } from '@/lib/informe-pdf'
import type { Factura, ReciboMercancia, ResultadoComparacion, TipoDiferencia } from '@/types'
import { toast } from 'sonner'

const TIPO_LABEL: Record<TipoDiferencia, string> = {
  cantidad: 'Cantidad',
  precio: 'Precio',
  codigo_producto: 'Código',
  presentacion: 'Presentación diferente',
  producto_no_encontrado: 'Producto no encontrado',
}

const TIPO_COLOR: Record<TipoDiferencia, string> = {
  cantidad: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  precio: 'bg-orange-50 border-orange-200 text-orange-800',
  codigo_producto: 'bg-blue-50 border-blue-200 text-blue-800',
  presentacion: 'bg-purple-50 border-purple-200 text-purple-800',
  producto_no_encontrado: 'bg-red-50 border-red-200 text-red-800',
}

function ResultadoCard({
  resultado,
  factura,
  onEliminar,
}: {
  resultado: ResultadoComparacion
  factura: Factura
  onEliminar: (id: string, facturaId: string) => void
}) {
  const [expandido, setExpandido] = useState(false)

  async function descargarPDF() {
    try {
      await generarInformePDF(resultado, factura)
      toast.success('Informe PDF generado')
    } catch (err) {
      toast.error(`Error al generar PDF: ${(err as Error).message}`)
    }
  }

  return (
    <Card className={resultado.tieneDiferencias ? 'border-red-200' : 'border-green-200'}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">
              Factura {resultado.numeroFactura}
              <span className="ml-2 text-sm font-normal text-gray-400">
                (últimos 4: <code className="bg-gray-100 px-1 rounded">{resultado.numeroFactura.slice(-4)}</code>)
              </span>
              <span className="mx-2 text-gray-300">↔</span>
              Recibo {resultado.numeroRecibo}
            </CardTitle>
            <p className="text-sm text-gray-500">{resultado.proveedor}</p>
          </div>
          <div className="flex items-center gap-2">
            {resultado.tieneDiferencias
              ? <Badge variant="destructive">{resultado.diferencias.length} diferencia(s)</Badge>
              : <Badge className="bg-green-100 text-green-800">Sin diferencias</Badge>}
            <Button size="sm" variant="outline" onClick={descargarPDF}>
              <FileDown size={14} className="mr-1" /> PDF
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEliminar(resultado.id, resultado.facturaId)}
              title="Eliminar comparación y volver a pendiente"
            >
              <Trash2 size={14} className="text-red-500" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setExpandido(e => !e)}>
              {expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-2 text-xs">
          <div className="bg-gray-50 p-2 rounded">
            <p className="text-gray-500">Total Factura (con IVA)</p>
            <p className="font-bold">${Number(resultado.valorTotalFactura).toLocaleString('es-CO')}</p>
          </div>
          <div className="bg-gray-50 p-2 rounded">
            <p className="text-gray-500">Total Recibo</p>
            <p className="font-bold">${Number(resultado.valorTotalRecibo).toLocaleString('es-CO')}</p>
          </div>
          <div className={`p-2 rounded ${resultado.valorDiferenciaTotal === 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <p className="text-gray-500">Diferencia Total</p>
            <p className={`font-bold ${resultado.valorDiferenciaTotal === 0 ? 'text-green-700' : 'text-red-700'}`}>
              ${Number(resultado.valorDiferenciaTotal).toLocaleString('es-CO')}
            </p>
          </div>
        </div>
      </CardHeader>

      {expandido && resultado.diferencias.length > 0 && (
        <CardContent className="pt-0 space-y-3">
          <h4 className="text-sm font-semibold text-gray-700">Detalle de diferencias por código</h4>
          {resultado.diferencias.map((d, i) => (
            <div key={i} className={`border rounded-lg p-3 text-xs ${TIPO_COLOR[d.tipoDiferencia]}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold">{TIPO_LABEL[d.tipoDiferencia]}</span>
                {d.valorDiferenciaTotal !== undefined && (
                  <span className="font-bold">Δ ${Number(d.valorDiferenciaTotal).toLocaleString('es-CO')}</span>
                )}
              </div>
              <p className="font-medium mb-1">{d.descripcion}</p>
              <div className="grid grid-cols-2 gap-2 opacity-80 mb-2">
                {d.codigoRecibo && <span>Cód. recibo: <code className="bg-white/50 px-1">{d.codigoRecibo}</code></span>}
                {d.codigoFactura && <span>Cód. factura: <code className="bg-white/50 px-1">{d.codigoFactura}</code></span>}
                {d.cantidadRecibida !== undefined && <span>Cant. recibida: <b>{d.cantidadRecibida}</b></span>}
                {d.cantidadFacturada !== undefined && <span>Cant. facturada: <b>{d.cantidadFacturada}</b></span>}
                {d.precioRecibo !== undefined && <span>Precio recibo: ${d.precioRecibo}</span>}
                {d.precioFactura !== undefined && <span>Precio factura: ${d.precioFactura}</span>}
              </div>
              <div className="bg-white/60 rounded p-2 border border-current/20">
                <p className="font-semibold mb-0.5">Nota:</p>
                <p>{d.nota}</p>
              </div>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  )
}

export default function ComparacionPage() {
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [recibos, setRecibos] = useState<ReciboMercancia[]>([])
  const [resultados, setResultados] = useState<ResultadoComparacion[]>([])
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set())
  const [procesando, setProcesando] = useState(false)
  const [facturasMap, setFacturasMap] = useState<Record<string, Factura>>({})

  const recargar = async () => {
    const [fs, rs, cs] = await Promise.all([
      storeFacturas.getAll(),
      storeRecibos.getAll(),
      storeComparaciones.getAll(),
    ])
    setFacturas(fs)
    setRecibos(rs)
    setResultados(cs)
    setFacturasMap(Object.fromEntries(fs.map(f => [f.id, f])))
  }
  useEffect(() => { recargar() }, [])

  function toggleFactura(id: string) {
    setSeleccionadas(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleTodas() {
    if (seleccionadas.size === facturas.length) {
      setSeleccionadas(new Set())
    } else {
      setSeleccionadas(new Set(facturas.map(f => f.id)))
    }
  }

  async function eliminarComparacion(comparacionId: string, facturaId: string) {
    await storeComparaciones.delete(comparacionId)
    // Resetear la factura a pendiente para poder volver a compararla
    const factura = facturasMap[facturaId]
    if (factura) {
      await storeFacturas.save({ ...factura, estado: 'pendiente', reciboAsociadoId: undefined })
    }
    await recargar()
    toast.success('Comparación eliminada — factura vuelve a estado pendiente')
  }

  async function compararSeleccionadas() {
    if (seleccionadas.size === 0) { toast.error('Selecciona al menos una factura'); return }
    setProcesando(true)
    let procesadas = 0, sinRecibo = 0

    for (const facturaId of seleccionadas) {
      const factura = facturas.find(f => f.id === facturaId)
      if (!factura) continue
      const recibo = encontrarReciboPorFactura(factura, recibos)
      if (!recibo) { sinRecibo++; continue }

      const resultado = compararFacturaConRecibo(factura, recibo)
      await storeComparaciones.save(resultado)
      await storeFacturas.save({
        ...factura,
        estado: resultado.tieneDiferencias ? 'con_diferencias' : 'conciliada',
        reciboAsociadoId: recibo.id,
      })
      procesadas++
    }

    await recargar()
    setSeleccionadas(new Set())
    setProcesando(false)
    if (procesadas > 0) toast.success(`${procesadas} factura(s) comparada(s)`)
    if (sinRecibo > 0) toast.warning(`${sinRecibo} factura(s) sin recibo asociado — quedan pendientes`)
  }

  const todasSeleccionadas = facturas.length > 0 && seleccionadas.size === facturas.length
  const algunaSeleccionada = seleccionadas.size > 0

  const ESTADO_COLOR: Record<string, string> = {
    pendiente: 'bg-yellow-100 text-yellow-800',
    conciliada: 'bg-green-100 text-green-800',
    con_diferencias: 'bg-red-100 text-red-800',
    rechazada: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Comparación</h1>
        <p className="text-gray-500 text-sm mt-1">
          Selecciona las facturas a comparar — se busca el recibo por los últimos 4 dígitos
        </p>
      </div>

      {/* Tabla de facturas con checkboxes */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Facturas cargadas ({facturas.length})
            </CardTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={compararSeleccionadas}
                disabled={!algunaSeleccionada || procesando}
              >
                <GitCompareArrows size={15} className="mr-1.5" />
                {procesando ? 'Comparando...' : `Comparar ${algunaSeleccionada ? `(${seleccionadas.size})` : ''}`}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {facturas.length === 0 ? (
            <p className="text-center text-gray-400 py-10 text-sm">
              No hay facturas cargadas. Ve a Facturas y sube archivos XML.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <button onClick={toggleTodas} className="flex items-center justify-center text-blue-600">
                      {todasSeleccionadas
                        ? <CheckSquare size={18} />
                        : <Square size={18} className="text-gray-400" />}
                    </button>
                  </th>
                  {['No. Factura', 'Últ. 4 dígitos', 'Proveedor', 'Fecha', 'Total', 'Estado', 'Recibo detectado'].map(h => (
                    <th key={h} className="text-left px-3 py-3 font-medium text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {facturas.map(f => {
                  const recibo = encontrarReciboPorFactura(f, recibos)
                  const checked = seleccionadas.has(f.id)
                  return (
                    <tr
                      key={f.id}
                      className={`cursor-pointer transition-colors ${checked ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                      onClick={() => toggleFactura(f.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center text-blue-600">
                          {checked ? <CheckSquare size={18} /> : <Square size={18} className="text-gray-300" />}
                        </div>
                      </td>
                      <td className="px-3 py-3 font-mono font-medium text-sm">{f.numeroFactura}</td>
                      <td className="px-3 py-3">
                        <span className="bg-blue-100 text-blue-800 font-bold font-mono px-2 py-0.5 rounded text-xs">
                          {ultimos4Digitos(f.numeroFactura)}
                        </span>
                      </td>
                      <td className="px-3 py-3">{f.proveedor || '—'}</td>
                      <td className="px-3 py-3 text-gray-500">{f.fecha}</td>
                      <td className="px-3 py-3 font-medium">${Number(f.total).toLocaleString('es-CO')}</td>
                      <td className="px-3 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ESTADO_COLOR[f.estado]}`}>
                          {f.estado.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {recibo
                          ? <span className="text-green-700 font-medium">✓ {recibo.numeroRecibo}</span>
                          : <span className="text-red-500">Sin recibo</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Resultados */}
      {resultados.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            Resultados ({resultados.length})
            <span className="ml-3 text-sm font-normal text-gray-500">
              {resultados.filter(r => !r.tieneDiferencias).length} OK ·{' '}
              {resultados.filter(r => r.tieneDiferencias).length} con diferencias
            </span>
          </h2>
          {resultados.map(r => (
            <ResultadoCard
              key={r.id}
              resultado={r}
              factura={facturasMap[r.facturaId] ?? ({} as Factura)}
              onEliminar={eliminarComparacion}
            />
          ))}
        </div>
      )}
    </div>
  )
}
