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
    <aside className="w-64 bg-gradient-to-b from-blue-700 via-indigo-700 to-violet-800 border-r border-indigo-900/20 flex flex-col shadow-xl">
      <div className="p-6 border-b border-white/15">
        <h1 className="text-2xl font-extrabold tracking-tight text-white drop-shadow-sm">PACARDYL</h1>
        <p className="text-xs font-semibold mt-1 text-amber-300">Gestión de Facturas</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              path === href
                ? 'bg-white text-indigo-800 shadow-md font-semibold'
                : 'text-indigo-100 hover:bg-white/15 hover:text-white'
            )}
          >
            <Icon size={18} />
            <span className="flex-1">{label}</span>
            {path === href && <ChevronRight size={14} />}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-white/15">
        <p className="text-xs text-indigo-200 text-center">Facturas DIAN · Colombia</p>
      </div>
    </aside>
  )
}
