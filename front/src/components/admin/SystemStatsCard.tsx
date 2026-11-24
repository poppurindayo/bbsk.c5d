import { useState, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useBuildings, useWorkTypes, useOrders, usePlan } from '@/hooks/useApi'
import { useDayStore } from '@/store/dayStore'
import { daysApi, solverApi, ordersApi } from '@/api/client'
import { Activity, Cpu, Zap, Loader2, CheckCircle2, AlertTriangle, Gauge, Server } from 'lucide-react'
import { cn } from '@/utils/cn'

interface BenchResult {
  orders: number
  loadMs: number
  planMs: number
  routes: number
  assigned: number
  unassigned: number
}

export function SystemStatsCard() {
  const { currentDate } = useDayStore()
  const queryClient = useQueryClient()
  const { data: buildings = [] } = useBuildings()
  const { data: workTypes = [] } = useWorkTypes()
  const { data: orders = [] } = useOrders({ date: currentDate })
  const { data: plan } = usePlan(currentDate)

  // Для честного замера пропускной способности берём только типы работ без ПГП,
  // иначе часть нарядов уйдёт в ПГП-группы и не попадёт в солвер (715 вместо 1000).
  const benchmarkWorkTypes = useMemo(() => {
    const nonPgp = (workTypes as any[]).filter((wt) => !(wt.pgp_relevant ?? wt.pgpRelevant))
    return nonPgp.length > 0 ? nonPgp : (workTypes as any[])
  }, [workTypes])

  const [benchCount, setBenchCount] = useState<number>(1000)
  const [benchRunning, setBenchRunning] = useState(false)
  const [benchResult, setBenchResult] = useState<BenchResult | null>(null)
  const [benchError, setBenchError] = useState<string>('')
  const [solver, setSolver] = useState<{ status: 'unknown' | 'online' | 'offline'; latency: number | null }>({
    status: 'unknown',
    latency: null,
  })
  const [pinging, setPinging] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [clearedCount, setClearedCount] = useState<number | null>(null)

  // Удаляет ТОЛЬКО сгенерированные (тестовые) наряды дня, сохраняя вручную созданные.
  const clearDay = async () => {
    if (!window.confirm(`Удалить сгенерированные (тестовые) наряды на ${currentDate}? Вручную созданные останутся.`)) return
    setClearing(true)
    setBenchError('')
    try {
      const res = await ordersApi.deleteGenerated(currentDate)
      const deleted = res.data?.deleted ?? 0
      setBenchResult(null)
      setBenchError('')
      // Показываем результат через отдельное поле
      setClearedCount(deleted)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['plan'] })
      queryClient.invalidateQueries({ queryKey: ['days'] })
    } catch (e: any) {
      setBenchError(e?.response?.data?.message || e.message || 'Ошибка удаления тестовых нарядов')
    } finally {
      setClearing(false)
    }
  }

  const checkSolver = async () => {
    setPinging(true)
    const t0 = performance.now()
    try {
      await solverApi.health()
      setSolver({ status: 'online', latency: Math.round(performance.now() - t0) })
    } catch {
      setSolver({ status: 'offline', latency: null })
    } finally {
      setPinging(false)
    }
  }

  const runBenchmark = async () => {
    if (!buildings.length || !benchmarkWorkTypes.length || benchCount <= 0) return
    setBenchRunning(true)
    setBenchResult(null)
    setBenchError('')

    try {
      const ts = Date.now()
      const slotHours = [9, 11, 13, 15, 17]
      const pad = (n: number) => String(n).padStart(2, '0')

      // 1. Генерируем N синтетических нарядов, распределяя по зданиям/типам работ/слотам
      const genOrders = Array.from({ length: benchCount }).map((_, i) => {
        const b: any = buildings[i % buildings.length]
        const wt: any = benchmarkWorkTypes[i % benchmarkWorkTypes.length]
        const h = slotHours[i % slotHours.length]
        const slotStart = `${currentDate}T${pad(h)}:00:00+05:00`
        const slotEnd = `${currentDate}T${pad(h + 2)}:00:00+05:00`
        return {
          order_id: `BENCH-${ts}-${i}`,
          building_id: b.building_id || b.code || b.id,
          work_type_id: wt.id,
          work_type: wt.code,
          access_node_id: b.access_node_id || b.accessNodeId || null,
          service_center_id: b.zone_service_center_id || b.zoneServiceCenterId || null,
          registered_at: `${currentDate}T08:00:00+05:00`,
          slot_start: slotStart,
          slot_end: slotEnd,
          slot: { start: slotStart, end: slotEnd },
          required_equipment: { ONT: 1, ROUTER: 1, STB: 0 },
          is_repeat: i % 10 === 0,
          is_generated: true,
        }
      })

      // 2. Загружаем день (замер загрузки)
      const loadStart = performance.now()
      await daysApi.init(currentDate, {
        date: currentDate,
        now: `${currentDate}T08:00:00+05:00`,
        orders: genOrders,
        absent_staff: [],
      })
      const loadMs = performance.now() - loadStart

      // 3. Строим план (ключевой замер производительности)
      const planStart = performance.now()
      const planRes = await daysApi.plan.create(currentDate)
      const planMs = performance.now() - planStart
      const d = planRes.data

      setBenchResult({
        orders: genOrders.length,
        loadMs: Math.round(loadMs),
        planMs: Math.round(planMs),
        routes: d?.routes?.length ?? 0,
        assigned: d?.metrics?.assigned_orders ?? d?.metrics?.assignedOrders ?? 0,
        unassigned: d?.metrics?.unassigned_orders ?? d?.metrics?.unassignedOrders ?? 0,
      })

      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['plan'] })
      queryClient.invalidateQueries({ queryKey: ['days'] })
    } catch (e: any) {
      setBenchError(e?.response?.data?.message || e.message || 'Ошибка выполнения теста')
    } finally {
      setBenchRunning(false)
    }
  }

  const withinSla = benchResult ? benchResult.planMs <= 300_000 : null

  return (
    <div className="space-y-4">
      {/* Текущее состояние */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Солвер маршрутизации</CardTitle>
            <Cpu className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  solver.status === 'online' ? 'success' : solver.status === 'offline' ? 'destructive' : 'secondary'
                }
              >
                {solver.status === 'online' ? 'Онлайн' : solver.status === 'offline' ? 'Недоступен' : 'Не проверен'}
              </Badge>
              {solver.latency !== null && (
                <span className="text-xs text-muted-foreground">{solver.latency} мс</span>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={checkSolver} disabled={pinging} className="w-full gap-1.5">
              {pinging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
              Проверить статус
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Наряды на {currentDate}</CardTitle>
            <Server className="h-5 w-5 text-orange-500" />
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Всего нарядов</span>
              <span className="font-bold">{orders.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Версия плана</span>
              <span className="font-medium">{plan?.plan_version ?? plan?.planVersion ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Маршрутов</span>
              <span className="font-medium">{plan?.routes?.length ?? 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Эффективность плана</CardTitle>
            <Gauge className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Назначено</span>
              <span className="font-medium text-emerald-600">
                {plan?.metrics?.assigned_orders ?? plan?.metrics?.assignedOrders ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Не распределено</span>
              <span
                className={cn(
                  'font-medium',
                  (plan?.metrics?.unassigned_orders ?? plan?.metrics?.unassignedOrders ?? 0) > 0
                    ? 'text-red-600'
                    : 'text-emerald-600'
                )}
              >
                {plan?.metrics?.unassigned_orders ?? plan?.metrics?.unassignedOrders ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Пробег, мин</span>
              <span className="font-medium">
                {Math.round((plan?.metrics?.total_travel_sec ?? plan?.metrics?.totalTravelSec ?? 0) / 60)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Стресс-тест производительности */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-5 w-5 text-amber-500" />
            Нагрузочный тест производительности
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Генерирует указанное число синтетических нарядов на текущую дату, загружает их и замеряет
            фактическое время построения плана. Норматив по ТЗ — не более 5 минут на день.
          </p>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Количество нарядов</Label>
              <Input
                type="number"
                min={1}
                max={5000}
                value={benchCount}
                onChange={(e) => setBenchCount(Math.max(1, Number(e.target.value) || 0))}
                className="w-40"
              />
            </div>
            <div className="flex items-center gap-1.5">
              {[100, 350, 500, 1000].map((n) => (
                <Button
                  key={n}
                  type="button"
                  variant={benchCount === n ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBenchCount(n)}
                  className="h-9"
                >
                  {n}
                </Button>
              ))}
            </div>
            <Button
              onClick={runBenchmark}
              disabled={benchRunning || !buildings.length || !benchmarkWorkTypes.length || benchCount <= 0}
              className="gap-2"
            >
              {benchRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {benchRunning ? 'Выполняется...' : 'Запустить тест'}
            </Button>
            <Button
              variant="outline"
              onClick={clearDay}
              disabled={clearing}
              className="gap-2 border-destructive/40 text-destructive hover:text-destructive"
            >
              {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
              Удалить тестовые
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Тест помечает наряды как сгенерированные. Кнопка «Удалить тестовые» убирает только их
            ({currentDate}), вручную созданные наряды остаются нетронутыми.
          </p>

          {clearedCount !== null && !benchError && (
            <div className="p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg">
              Удалено тестовых нарядов: {clearedCount}. Вручную созданные сохранены.
            </div>
          )}

          {(!buildings.length || !benchmarkWorkTypes.length) && (
            <div className="p-3 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg">
              Сначала загрузите справочники (здания и типы работ) через «Мастер тестовых данных».
            </div>
          )}

          {benchError && (
            <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {benchError}
            </div>
          )}

          {benchResult && (
            <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
              <div className="flex items-center gap-2">
                {withinSla ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                )}
                <span className="font-semibold text-sm">
                  {benchResult.orders} нарядов обработаны за {(benchResult.planMs / 1000).toFixed(2)} сек
                </span>
                <Badge variant={withinSla ? 'success' : 'destructive'}>
                  {withinSla ? 'В пределах норматива (≤ 5 мин)' : 'Превышен норматив 5 мин'}
                </Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Загрузка нарядов</p>
                  <p className="font-mono font-semibold">{(benchResult.loadMs / 1000).toFixed(2)} сек</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Построение плана</p>
                  <p className="font-mono font-semibold">{(benchResult.planMs / 1000).toFixed(2)} сек</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Маршрутов</p>
                  <p className="font-mono font-semibold">{benchResult.routes}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Назначено / не распред.</p>
                  <p className="font-mono font-semibold">
                    {benchResult.assigned} / {benchResult.unassigned}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}