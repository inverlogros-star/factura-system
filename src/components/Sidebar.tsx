'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FileText,
  PackageCheck,
  GitCompareArrows,
  Clock,
  Building2,
  BarChart3,
  Receipt,
  BookOpen,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { href: '/',            label: 'Dashboard',              icon: LayoutDashboard },
  { href: '/reporte',     label: 'Reporte por Fechas',     icon: BarChart3 },
  { href: '/comprobante', label: 'Comprobante Contable',   icon: BookOpen },
  { href: '/facturas',    label: 'Facturas',                icon: FileText },
  { href: '/notas-pos',   label: 'Notas Crédito / Débito', icon: Receipt },
  { href: '/proveedores', label: 'Por Proveedor / Fecha',  icon: Building2 },
  { href: '/recibos',     label: 'Recibos de Mercancía',   icon: PackageCheck },
  { href: '/comparacion', label: 'Comparación',             icon: GitCompareArrows },
  { href: '/pendientes',  label: 'Pendientes',               icon: Clock },
]

export default function Sidebar() {
  const path = usePathname()
  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-blue-700">PACARDYL</h1>
        <p className="text-xs text-gray-500 mt-1">Gestión de Facturas</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              path === href
                ? href === '/notas-pos'
                  ? 'bg-orange-50 text-orange-700'
                  : href === '/comprobante'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            )}
          >
            <Icon size={18} />
            <span className="flex-1">{label}</span>
            {path === href && <ChevronRight size={14} />}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-200">
        <p className="text-xs text-gray-400 text-center">Facturas DIAN · Colombia</p>
      </div>
    </aside>
  )
}
