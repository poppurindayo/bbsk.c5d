import { LayoutDashboard, MapPin, ListTodo, Calendar, AlertTriangle, Settings, Zap, Users, Building2, Wrench } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type UserRole = 'DISPATCHER' | 'ADMIN'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  roles: UserRole[]
}

// ─── Dispatcher navigation — operational workspace only ───────────────────────
const DISPATCHER_NAV: NavItem[] = [
  { label: 'Дашборд', href: '/', icon: LayoutDashboard, roles: ['DISPATCHER', 'ADMIN'] },
  { label: 'Карта маршрутов', href: '/map', icon: MapPin, roles: ['DISPATCHER', 'ADMIN'] },
  { label: 'Заявки / Наряды', href: '/orders', icon: ListTodo, roles: ['DISPATCHER', 'ADMIN'] },
  { label: 'План на день', href: '/day-planning', icon: Calendar, roles: ['DISPATCHER', 'ADMIN'] },
  { label: 'События смены', href: '/events', icon: Zap, roles: ['DISPATCHER', 'ADMIN'] },
  { label: 'Алерты и PGP', href: '/alerts', icon: AlertTriangle, roles: ['DISPATCHER', 'ADMIN'] },
]

// ─── Admin navigation — full access including НСИ ────────────────────────────
const ADMIN_NAV: NavItem[] = [
  { label: 'Дашборд', href: '/', icon: LayoutDashboard, roles: ['DISPATCHER', 'ADMIN'] },
  { label: 'Карта маршрутов', href: '/map', icon: MapPin, roles: ['DISPATCHER', 'ADMIN'] },
  { label: 'Заявки / Наряды', href: '/orders', icon: ListTodo, roles: ['DISPATCHER', 'ADMIN'] },
  { label: 'План на день', href: '/day-planning', icon: Calendar, roles: ['DISPATCHER', 'ADMIN'] },
  { label: 'События смены', href: '/events', icon: Zap, roles: ['DISPATCHER', 'ADMIN'] },
  { label: 'Алерты и PGP', href: '/alerts', icon: AlertTriangle, roles: ['DISPATCHER', 'ADMIN'] },
  { label: 'Администрирование', href: '/admin', icon: Settings, roles: ['ADMIN'] },
]

export function getNavItems(role?: string): NavItem[] {
  if (role === 'ADMIN') return ADMIN_NAV
  return DISPATCHER_NAV
}

export const SIDEBAR_WIDTH = '260px'
export const SIDEBAR_WIDTH_COLLAPSED = '72px'