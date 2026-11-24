import { useNavigate, Link } from 'react-router-dom'
import { LogOut, User, Building2, Calendar, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/store/authStore'
import { useDayStore } from '@/store/dayStore'
import { useServiceCenters } from '@/hooks/useApi'
import { useLogout } from '@/hooks/useAuth'

export const Header = ({ onMenuClick }: { onMenuClick: () => void }) => {
  const { user } = useAuthStore()
  const { currentDate, setCurrentDate, selectedServiceCenterId, setSelectedServiceCenterId } = useDayStore()
  const { data: serviceCenters = [] } = useServiceCenters()
  const logout = useLogout()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout.mutate()
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 backdrop-blur px-4 gap-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </Button>

        {/* Home / Logo button */}
        <Link
          to="/"
          className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-accent/60 transition-colors group cursor-pointer mr-1"
          title="Вернуться на главный экран"
        >
          <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-black text-sm shadow-sm group-hover:scale-105 transition-transform">
            BBSK
          </div>
          <div className="hidden sm:flex flex-col text-left">
            <span className="font-bold text-sm leading-tight text-foreground flex items-center gap-1">
              {user?.role === 'ADMIN' ? 'Админ' : 'Диспетчер'}
              <Home className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
            </span>
            <span className="text-[10px] text-muted-foreground leading-none">Главный экран</span>
          </div>
        </Link>

        {/* Service Center Selector */}
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary hidden md:inline-block" />
          <div className="w-[180px] sm:w-[220px]">
            <Select
              value={selectedServiceCenterId || 'ALL'}
              onValueChange={(val) => setSelectedServiceCenterId(val === 'ALL' ? null : val)}
            >
              <SelectTrigger className="h-9 text-xs sm:text-sm">
                <SelectValue placeholder="Все Сервисные Центры" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">🏢 Все Сервисные Центры</SelectItem>
                {serviceCenters.map((sc: any) => {
                  const scCode = sc.service_center_id || sc.code || sc.id
                  return (
                    <SelectItem key={sc.id} value={sc.id}>
                      🏢 {scCode} ({sc.name})
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Current Date Picker */}
        <div className="hidden lg:flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <input
            type="date"
            value={currentDate}
            onChange={(e) => e.target.value && setCurrentDate(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2.5 py-1 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="Рабочая дата диспетчера"
          />
        </div>
      </div>

      {/* User info & Profile actions */}
      <div className="flex items-center gap-3">
        {user && (
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-sm font-medium leading-none">{user.username}</span>
            <span className="text-xs text-muted-foreground mt-0.5">
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
                {user.role === 'ADMIN' ? 'Администратор' : 'Диспетчер'}
              </Badge>
            </span>
          </div>
        )}

        {/* Account Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="relative h-9 w-9 rounded-full bg-primary/10 border-primary/20 hover:bg-primary/20"
              title="Меню профиля"
            >
              <User className="h-4 w-4 text-primary" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="font-semibold text-sm">{user?.username || 'Пользователь'}</p>
              <p className="text-xs text-muted-foreground font-normal">{user?.role || 'DISPATCHER'}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/')}>
              <Home className="mr-2 h-4 w-4" />
              Главный экран
            </DropdownMenuItem>
            {user?.role === 'ADMIN' && (
              <DropdownMenuItem onClick={() => navigate('/admin')}>
                <Building2 className="mr-2 h-4 w-4" />
                Панель администратора
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Выйти из системы
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}