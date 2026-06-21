'use client'
import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, Trash2, PackageCheck, Eye } from 'lucide-react'
import { parsearReciboXML } from '@/lib/parser-dian'
import { storeRecibos } from '@/lib/store'
import type { ReciboMercancia } from '@/types'
import { toast } from 'sonner'
import DetalleRecibo from '@/components/DetalleRecibo'

export default function RecibosPage() {
  const [recibos, setRecibos] = useState<ReciboMercancia[]>([])
  const [cargando, setCargando] = useState(false)
  const [seleccionado, setSeleccionado] = useState<ReciboMercancia | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setRecibos(storeRecibos.getAll()) }, [])

  async function handleArchivos(files: FileList | null) {
    if (!files || files.length === 0) return
    setCargando(true)
    let importados = 0
    for (const file of Array.from(files)) {
      if (!file.name.endsWith('.xml')) {
        toast.error(`${file.name} no es un archivo XML`)
        continue
      }
      try {
        const text = await file.text()
        const datos = await parsearReciboXML(text)
        const recibo: ReciboMercancia = {
          id: `r-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          ...datos,
          creadoEn: new Date().toISOString(),
        }
        storeRecibos.save(recibo)
        importados++
      } catch (err) {
        toast.error(`Error al leer ${file.name}: ${(err as Error).message}`)
      }
    }
    setRecibos(storeRecibos.getAll())
    setCargando(false)
    if (importados > 0) toast.success(`${importados} recibo(s) importado(s)`)
  }

  function eliminar(id: string) {
    storeRecibos.delete(id)
    setRecibos(storeRecibos.getAll())
    toast.success('Recibo eliminado')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recibos de Mercancía</h1>
          <p className="text-gray-500 text-sm mt-1">Carga los XML de recepción para comparar con facturas</p>
        </div>
        <Button onClick={() => inputRef.current?.click()} disabled={cargando}>
          <Upload size={16} className="mr-2" />
          {cargando ? 'Importando...' : 'Subir XML'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xml"
          multiple
          className="hidden"
          onChange={e => handleArchivos(e.target.files)}
        />
      </div>

      {recibos.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <PackageCheck size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No hay recibos cargados.</p>
            <p className="text-sm text-gray-400">Sube archivos XML de recepción de mercancía.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{recibos.length} recibo(s)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['No. Recibo', 'Proveedor', 'NIT', 'Fecha', 'Total', 'Productos', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-medium text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recibos.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-medium">{r.numeroRecibo}</td>
                    <td className="px-4 py-3">{r.proveedor || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{r.nitProveedor || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{r.fecha}</td>
                    <td className="px-4 py-3 font-medium">${r.total.toLocaleString('es-CO')}</td>
                    <td className="px-4 py-3 text-gray-500">{r.productos.length} ítem(s)</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setSeleccionado(r)}>
                          <Eye size={14} />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => eliminar(r.id)}>
                          <Trash2 size={14} className="text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {seleccionado && (
        <DetalleRecibo recibo={seleccionado} onClose={() => setSeleccionado(null)} />
      )}
    </div>
  )
}
