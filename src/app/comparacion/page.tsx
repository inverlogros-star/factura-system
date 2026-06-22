'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { GitCompareArrows, ChevronDown, ChevronUp, FileDown } from 'lucide-react'
import { storeFacturas, storeRecibos, storeComparaciones } from '@/lib/store'
import { compararFacturaConRecibo } from '@/lib/comparador'
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

function ResultadoCard({ resultado }: { resultado: ResultadoComparacion }) {
  const [expandido, setExpandido] = useState(false)

  async function descargarPDF() {
    try {
      await generarInformePDF(resultado, resultado.proveedor || 'PACARDYL')
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
              Factura {resultado.numeroFactura} ↔ Recibo {resultado.numeroRecibo}
            </CardTitle>
            <p className="text-sm text-gray-500">{resultado.proveedor}</p>
          </div>
          <div className="flex items-center gap-2">
            {resultado.tieneDiferencias
              ? <Badge variant="destructive">{resultado.diferencias.length} diferencia(s)</Badge>
              : <Badge className="bg-green-100 text-green-800">Sin diferencias</Badge>}
            <Button size="sm" variant="outline" onClick={descargarPDF} title="Descargar informe PDF">
              <FileDown size={14} className="mr-1" /> PDF
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setExpandido(e => !e)}>
              {expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-2 text-xs">
          <div className="bg-gray-50 p-2 rounded">
            <p className="text-gray-500">Total Factura</p>
            <p className="font-bold">${Number(resultado.valorTotalFactura).toLocaleString('es-CO')}</p>
          </div>
          <div className="bg-gray-50 p-2 rounded">
            <p className="text-gray-500">Total Recibo</p>
            <p className="font-bold">${Number(resultado.valorTotalRecibo).toLocaleString('es-CO')}</p>
          </div>
          <div className={`p-2 rounded ${resultado.valorDiferenciaTotal === 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <p className="text-gray-500">Diferencia</p>
            <p className={`font-bold ${resultado.valorDiferenciaTotal === 0 ? 'text-green-700' : 'text-red-700'}`}>
              ${Number(resultado.valorDiferenciaTotal).toLocaleString('es-CO')}
            </p>
          </div>
        </div>
      </CardHeader>
      {expandido && resultado.diferencias.length > 0 && (
        <CardContent className="pt-0 space-y-3">
          <h4 className="text-sm font-semibold text-gray-700">Detalle de diferencias</h4>
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
                {d.codigoRecibo && <span>Cód. recibo: <code>{d.codigoRecibo}</code></span>}
                {d.codigoFactura && <span>Cód. factura: <code>{d.codigoFactura}</code></span>}
                {d.cantidadRecibida !== undefined && <span>Cant. recibida: {d.cantidadRecibida}</span>}
                {d.cantidadFacturada !== undefined && <span>Cant. facturada: {d.cantidadFacturada}</span>}
                {d.precioRecibo !== undefined && <span>Precio recibo: ${d.precioRecibo}</span>}
                {d.precioFactura !== undefined && <span>Precio factura: ${d.precioFactura}</span>}
              </div>
              <div className="bg-white/60 rounded p-2 border border-current/20">
                <p className="font-semibold mb-1">Nota:</p>
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
  const [facturaId, setFacturaId] = useState('')
  const [reciboId, setReciboId] = useState('')
  const [procesando, setProcesando] = useState(false)

  const recargar = async () => {
    setFacturas(await storeFacturas.getAll())
    setRecibos(await storeRecibos.getAll())
    setResultados(await storeComparaciones.getAll())
  }
  useEffect(() => { recargar() }, [])

  async function comparar() {
    const factura = facturas.find(f => f.id === facturaId)
    const recibo = recibos.find(r => r.id === reciboId)
    if (!factura || !recibo) { toast.error('Selecciona una factura y un recibo'); return }
    setProcesando(true)
    const resultado = compararFacturaConRecibo(factura, recibo)
    await storeComparaciones.save(resultado)
    await storeFacturas.save({
      ...factura,
      estado: resultado.tieneDiferencias ? 'con_diferencias' : 'conciliada',
      reciboAsociadoId: recibo.id,
    })
    await recargar()
    setProcesando(false)
    toast.success(resultado.tieneDiferencias
      ? `${resultado.diferencias.length} diferencia(s) encontrada(s)`
      : 'Sin diferencias — factura conciliada')
  }

  async function compararTodo() {
    setProcesando(true)
    const pendientes = facturas.filter(f => f.estado === 'pendiente')
    let procesadas = 0
    for (const factura of pendientes) {
      const recibo = recibos.find(r =>
        r.nitProveedor === factura.nitProveedor ||
        r.proveedor?.toLowerCase().includes(factura.proveedor?.toLowerCase() ?? '')
      )
      if (recibo) {
        const resultado = compararFacturaConRecibo(factura, recibo)
        await storeComparaciones.save(resultado)
        await storeFacturas.save({
          ...factura,
          estado: resultado.tieneDiferencias ? 'con_diferencias' : 'conciliada',
          reciboAsociadoId: recibo.id,
        })
        procesadas++
      }
    }
    await recargar()
    setProcesando(false)
    toast.success(`${procesadas} factura(s) procesada(s) automáticamente`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Comparación</h1>
        <p className="text-gray-500 text-sm mt-1">Concilia facturas con recibos de mercancía</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Comparar manualmente</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Factura</label>
              <Select value={facturaId} onValueChange={(v) => setFacturaId(v ?? '')}>
                <SelectTrigger><SelectValue placeholder="Selecciona factura..." /></SelectTrigger>
                <SelectContent>
                  {facturas.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.numeroFactura} — {f.proveedor || f.nitProveedor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Recibo de mercancía</label>
              <Select value={reciboId} onValueChange={(v) => setReciboId(v ?? '')}>
                <SelectTrigger><SelectValue placeholder="Selecciona recibo..." /></SelectTrigger>
                <SelectContent>
                  {recibos.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.numeroRecibo} — {r.proveedor || r.nitProveedor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={comparar} disabled={!facturaId || !reciboId || procesando}>
              <GitCompareArrows size={16} className="mr-2" />
              {procesando ? 'Procesando...' : 'Comparar'}
            </Button>
            <Button variant="outline" onClick={compararTodo} disabled={procesando}>
              Comparar todo automáticamente
            </Button>
          </div>
        </CardContent>
      </Card>

      {resultados.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            Resultados ({resultados.length})
            <span className="ml-3 text-sm font-normal text-gray-500">
              {resultados.filter(r => !r.tieneDiferencias).length} OK ·{' '}
              {resultados.filter(r => r.tieneDiferencias).length} con diferencias
            </span>
          </h2>
          {resultados.map(r => <ResultadoCard key={r.id} resultado={r} />)}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <GitCompareArrows size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">Sin comparaciones aún.</p>
            <p className="text-sm text-gray-400">Selecciona una factura y un recibo para comenzar.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
