import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/utils/cn'
import { getNavItems, SIDEBAR_WIDTH, SIDEBAR_WIDTH_COLLAPSED } from '@/utils/constants'
import { useAuthStore } from '@/store/authStore'
import { Menu, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
  isCollapsed?: boolean
  onCollapseToggle?: () => void
}

export const Sidebar = ({
  isOpen,
  onToggle,
  isCollapsed = false,
  onCollapseToggle,
}: SidebarProps) => {
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const navItems = getNavItems(user?.role)

  if (!isOpen && typeof window !== 'undefined' && window.innerWidth >= 1024) {
    return null
  }

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen border-r bg-card transition-all duration-300 ease-in-out',
        isCollapsed ? 'w-[72px]' : 'w-[260px]',
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}
      style={{
        width: isCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH,
      }}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center justify-between border-b px-4">
          {!isCollapsed && (
            <NavLink to="/" className="flex items-center gap-2 font-bold text-xl text-primary">
              BBSK
            </NavLink>
          )}
          <div className="flex items-center gap-1">
            {onCollapseToggle && (
              <Button
                variant="ghost"
                size="icon"
                className="hidden lg:flex"
                onClick={onCollapseToggle}
              >
                {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={onToggle}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.href
            return (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive: active }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    isCollapsed && 'justify-center px-2'
                  )
                }
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && <span>{item.label}</span>}
              </NavLink>
            )
          })}
        </nav>

        <div className="border-t p-3">
          <Button
            variant="ghost"
            className={cn('w-full justify-start', isCollapsed && 'justify-center px-2')}
            onClick={onToggle}
          >
            <Menu className="h-5 w-5 flex-shrink-0" />
            {!isCollapsed && <span className="ml-2">Свернуть меню</span>}
          </Button>
        </div>
      </div>
    </aside>
  )
}