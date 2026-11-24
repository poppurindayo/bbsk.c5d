import { Link, useNavigate } from 'react-router-dom'
import { useHealth } from '@/hooks/useHealth'
import { useAuthCheck, useLogout } from '@/hooks/useAuth'
import { useAuthStore } from '@/store/authStore'
import { useDayStore } from '@/store/dayStore'
import { useStaff, useBuildings, useOrders, usePlan, useServiceCenters } from '@/hooks/useApi'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LayoutDashboard, Users, Building2, ListTodo, MapPin, Calendar, AlertTriangle, Loader2, CheckCircle2, Zap, Settings, ArrowRight, Clock, PhoneCall, UserX, TrendingUp } from 'lucide-react'
import { cn } from '@/utils/cn'

export const DashboardPage = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { currentDate } = useDayStore()
  const { data: health, isLoading: healthLoading } = useHealth()

  const { data: staffList = [] } = useStaff()
  const { data: buildings = [] } = useBuildings()
  const { data: orders = [] } = useOrders({ date: currentDate })
  const { data: plan } = usePlan(currentDate)
  const { data: serviceCenters = [] } = useServiceCenters()

  const isAdmin = user?.role === 'ADMIN'

  // ─── Dispatcher: operational KPI ────────────────────────────────────────────
  const unassignedCount = plan?.metrics?.unassignedOrders ?? plan?.unassignedOrders?.length ?? 0
  const assignedCount = plan?.metrics?.assignedOrders ?? 0
  const activeRoutes = plan?.routes?.length ?? 0
  const totalOrders = plan?.metrics?.totalOrders ?? orders.length

  const dispatcherStats = [
    {
      label: 'Нераспределённые наряды',
      value: unassignedCount,
      icon: AlertTriangle,
      href: '/day-planning',
      color: unassignedCount > 0 ? 'text-red-500' : 'text-emerald-500',
      bg: unassignedCount > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200',
      desc: unassignedCount > 0 ? 'Требуют внимания' : 'Все распределены',
    },
    {
      label: 'Назначено на бригады',
      value: `${assignedCount} / ${totalOrders}`,
      icon: CheckCircle2,
      href: '/day-planning',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50/50 border-emerald-200',
      desc: 'Наряды в маршрутах',
    },
    {
      label: 'Бригад на линии',
      value: activeRoutes,
      icon: MapPin,
      href: '/map',
      color: 'text-blue-600',
      bg: 'bg-blue-50/50 border-blue-200',
      desc: `Из ${staffList.length} инженеров`,
    },
    {
      label: 'Нарядов на дату',
      value: totalOrders,
      icon: ListTodo,
      href: '/orders',
      color: 'text-orange-600',
      bg: 'bg-orange-50/50 border-orange-200',
      desc: currentDate,
    },
  ]

  // ─── Admin: system stats ────────────────────────────────────────────────────
  const adminStats = [
    {
      label: 'Инженеры / Бригады',
      value: staffList.length,
      icon: Users,
      href: '/admin',
      color: 'text-blue-500',
      desc: 'Зарегистрировано в системе',
    },
    {
      label: 'Объекты и здания',
      value: buildings.length,
      icon: Building2,
      href: '/admin',
      color: 'text-emerald-500',
      desc: 'МКД и частный сектор',
    },
    {
      label: `Наряды (${currentDate})`,
      value: orders.length,
      icon: ListTodo,
      href: '/orders',
      color: 'text-orange-500',
      desc: plan?.metrics ? `Назначено: ${plan.metrics.assignedOrders}` : 'Всего на дату',
    },
    {
      label: 'Активные маршруты',
      value: plan?.metrics?.activeRoutes ?? plan?.routes?.length ?? 0,
      icon: MapPin,
      href: '/map',
      color: 'text-purple-500',
      desc: 'Построенных маршрутов OSM',
    },
  ]

  const stats = isAdmin ? adminStats : dispatcherStats

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {isAdmin ? 'Администрирование' : 'Рабочее место диспетчера'}
            </h1>
            <Badge variant={isAdmin ? 'secondary' : 'default'} className="text-[10px]">
              {isAdmin ? 'ADMIN' : 'ДИСПЕТЧЕР'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {user?.username} · {currentDate} · Сервисных центров: {serviceCenters.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isAdmin && (
            <>
              <Button onClick={() => navigate('/map')} className="gap-2 shadow">
                <MapPin className="h-4 w-4" />
                Карта маршрутов
              </Button>
              <Button variant="outline" onClick={() => navigate('/day-planning')}>
                <Calendar className="mr-2 h-4 w-4" />
                План дня
              </Button>
            </>
          )}
          {isAdmin && (
            <Button onClick={() => navigate('/admin')} className="gap-2 shadow">
              <Settings className="h-4 w-4" />
              Администрирование
            </Button>
          )}
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} to={stat.href}>
            <Card className={cn('hover:border-primary/50 transition-colors cursor-pointer', 'bg' in stat && typeof stat.bg === 'string' ? stat.bg : '')}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                <stat.icon className={cn('h-5 w-5', stat.color)} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* ─── Dispatcher quick panel ─────────────────────────────────────────── */}
      {!isAdmin && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Dispatcher actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PhoneCall className="h-5 w-5 text-amber-500" />
                Действия диспетчера
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link to="/day-planning" className="block">
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center">
                    <Calendar className="mr-2 h-4 w-4 text-primary" />
                    {plan ? 'План построен — обзвон бригад' : 'Построить план на день'}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Button>
              </Link>
              <Link to="/orders" className="block">
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center">
                    <ListTodo className="mr-2 h-4 w-4 text-primary" />
                    Наряды ({orders.length})
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Button>
              </Link>
              <Link to="/events" className="block">
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center">
                    <Zap className="mr-2 h-4 w-4 text-amber-500" />
                    Зарегистрировать событие
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Plan status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5 text-primary" />
                Статус плана
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {plan ? (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Версия плана</span>
                    <Badge variant="outline">v{plan.planVersion}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Маршрутов</span>
                    <span className="font-medium">{plan.routes?.length ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Наряды назначены</span>
                    <span className="font-medium text-emerald-600">{plan.metrics?.assignedOrders ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Не распределено</span>
                    <span className={cn('font-medium', (plan.metrics?.unassignedOrders ?? 0) > 0 ? 'text-red-600' : 'text-emerald-600')}>
                      {plan.metrics?.unassignedOrders ?? 0}
                    </span>
                  </div>
                  {plan.alerts && plan.alerts.length > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Алерты</span>
                      <Badge variant="destructive">{plan.alerts.length}</Badge>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 space-y-2">
                  <Clock className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">План ещё не построен</p>
                  <Button size="sm" onClick={() => navigate('/day-planning')} className="gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Перейти к планированию
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* System status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                Статус системы
              </CardTitle>
            </CardHeader>
            <CardContent>
              {healthLoading ? (
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>Проверка...</span>
                </div>
              ) : health ? (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">API</span>
                    <Badge variant="success">{health.status}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Версия</span>
                    <span className="font-mono text-foreground">{health.version}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Solver</span>
                    <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                      Online
                    </Badge>
                  </div>
                </div>
              ) : (
                <Badge variant="destructive">Бэкенд недоступен</Badge>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Admin quick panel ──────────────────────────────────────────────── */}
      {isAdmin && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <DatabaseIcon />
                НСИ и справочники
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link to="/admin" className="block">
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center">
                    <Users className="mr-2 h-4 w-4 text-blue-500" />
                    Сотрудники, смены, квалификации
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Button>
              </Link>
              <Link to="/admin" className="block">
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center">
                    <Building2 className="mr-2 h-4 w-4 text-emerald-500" />
                    Сервисные центры и здания
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Button>
              </Link>
              <Link to="/admin" className="block">
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center">
                    <Settings className="mr-2 h-4 w-4 text-purple-500" />
                    Типы работ и нормативы
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <DatabaseIcon />
                Генерация данных
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground text-xs">
                Загрузка справочников и матрицы перемещений, генерация тестовых нарядов на выбранную дату.
              </p>
              <Link to="/admin">
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center">
                    <Zap className="mr-2 h-4 w-4 text-amber-500" />
                    Мастер тестовых данных
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Button>
              </Link>
              <Link to="/orders" className="block">
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center">
                    <ListTodo className="mr-2 h-4 w-4 text-primary" />
                    Все наряды ({orders.length})
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                Статус системы
              </CardTitle>
            </CardHeader>
            <CardContent>
              {healthLoading ? (
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>Проверка...</span>
                </div>
              ) : health ? (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">API</span>
                    <Badge variant="success">{health.status}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Команда</span>
                    <span className="font-medium text-foreground">{health.team}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Версия</span>
                    <span className="font-mono text-foreground">{health.version}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Solver</span>
                    <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                      Online (Port 8000)
                    </Badge>
                  </div>
                </div>
              ) : (
                <Badge variant="destructive">Бэкенд недоступен</Badge>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function DatabaseIcon() {
  return <Settings className="h-5 w-5 text-primary" />
}