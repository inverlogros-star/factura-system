'use client'
import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Upload, Trash2, PackageCheck, Eye, FileSpreadsheet, FileText, FileCode } from 'lucide-react'
import { parsearReciboXML } from '@/lib/parser-dian'
import { parsearReciboExcel } from '@/lib/parser-recibo-excel'
import { parsearReciboPDF } from '@/lib/parser-recibo-pdf'
import { storeRecibos } from '@/lib/store'
import type { ReciboMercancia } from '@/types'
import { toast } from 'sonner'
import DetalleRecibo from '@/components/DetalleRecibo'

const FORMATOS_ACEPTADOS = '.xml,.xlsx,.xls,.pdf'

function iconoArchivo(nombre: string) {
  if (nombre.endsWith('.xml')) return <FileCode size={14} className="text-blue-500" />
  if (nombre.endsWith('.pdf')) return <FileText size={14} className="text-red-500" />
  return <FileSpreadsheet size={14} className="text-green-500" />
}

export default function RecibosPage() {
  const [recibos, setRecibos] = useState<ReciboMercancia[]>([])
  const [cargando, setCargando] = useState(false)
  const [seleccionado, setSeleccionado] = useState<ReciboMercancia | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const recargar = async () => setRecibos(await storeRecibos.getAll())
  useEffect(() => { recargar() }, [])

  async function handleArchivos(files: FileList | null) {
    if (!files || files.length === 0) return
    setCargando(true)
    let importados = 0
    let errores = 0

    for (const file of Array.from(files)) {
      const nombre = file.name.toLowerCase()
      try {
        let datos: Omit<ReciboMercancia, 'id' | 'creadoEn'>

        if (nombre.endsWith('.xml')) {
          const text = await file.text()
          datos = await parsearReciboXML(text)
        } else if (nombre.endsWith('.xlsx') || nombre.endsWith('.xls')) {
          const buffer = await file.arrayBuffer()
          datos = await parsearReciboExcel(buffer, file.name)
        } else if (nombre.endsWith('.pdf')) {
          const buffer = await file.arrayBuffer()
          datos = await parsearReciboPDF(buffer, file.name)
        } else {
          toast.error(`Formato no soportado: ${file.name}`)
          continue
        }

        const recibo: ReciboMercancia = {
          id: `r-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          ...datos,
          creadoEn: new Date().toISOString(),
        }
        await storeRecibos.save(recibo)
        importados++
      } catch (err) {
        toast.error(`Error en ${file.name}: ${(err as Error).message}`)
        errores++
      }
    }

    await recargar()
    setCargando(false)
    if (importados > 0) toast.success(`${importados} recibo(s) importado(s) correctamente`)
    if (errores > 0) toast.warning(`${errores} archivo(s) con error`)
  }

  async function eliminar(id: string) {
    await storeRecibos.delete(id)
    await recargar()
    toast.success('Recibo eliminado')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recibos de Mercancía</h1>
          <p className="text-gray-500 text-sm mt-1">Carga recibos en formato XML, Excel o PDF</p>
        </div>
        <Button onClick={() => inputRef.current?.click()} disabled={cargando}>
          <Upload size={16} className="mr-2" />
          {cargando ? 'Importando...' : 'Subir archivo'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={FORMATOS_ACEPTADOS}
          multiple
          className="hidden"
          onChange={e => handleArchivos(e.target.files)}
        />
      </div>

      {/* Formatos aceptados */}
      <div className="flex gap-3">
        {[
          { icon: <FileCode size={14} className="text-blue-500" />, label: 'XML', desc: 'Recibo electrónico' },
          { icon: <FileSpreadsheet size={14} className="text-green-500" />, label: 'Excel (.xlsx / .xls)', desc: 'Hoja de cálculo' },
          { icon: <FileText size={14} className="text-red-500" />, label: 'PDF', desc: 'Documento PDF' },
        ].map(({ icon, label, desc }) => (
          <div key={label} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-white text-xs text-gray-600">
            {icon}
            <span className="font-medium">{label}</span>
            <span className="text-gray-400">— {desc}</span>
          </div>
        ))}
      </div>

      {recibos.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <PackageCheck size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No hay recibos cargados.</p>
            <p className="text-sm text-gray-400 mt-1">Sube archivos XML, Excel o PDF de recepción de mercancía.</p>
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
                    <td className="px-4 py-3 text-gray-500">{r.fecha || '—'}</td>
                    <td className="px-4 py-3 font-medium">${Number(r.total).toLocaleString('es-CO')}</td>
                    <td className="px-4 py-3 text-gray-500">{r.productos.length} ítem(s)</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setSeleccionado(r)}><Eye size={14} /></Button>
                        <Button size="sm" variant="ghost" onClick={() => eliminar(r.id)}><Trash2 size={14} className="text-red-500" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {seleccionado && <DetalleRecibo recibo={seleccionado} onClose={() => setSeleccionado(null)} />}
    </div>
  )
}
