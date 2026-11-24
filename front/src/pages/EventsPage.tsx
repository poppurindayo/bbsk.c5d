import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Zap, Clock, UserMinus, XCircle, AlertTriangle, ArrowRight, Loader2, CheckCircle2, RotateCcw } from 'lucide-react'
import { useCreateEvent, usePlan, useOrders, useStaff } from '@/hooks/useApi'
import { useDayStore } from '@/store/dayStore'
import { format } from 'date-fns'
import { formatClockSeconds } from '@/utils/time'

const eventSchema = z.object({
  type: z.enum(['ORDER_CANCELLED', 'NEW_ORDER', 'STAFF_UNAVAILABLE', 'ORDER_TRANSFERRED', 'VISIT_DELAYED', 'TIME_TICK']),
  timestamp: z.string().min(1, 'Время события обязательно'),
  orderCode: z.string().optional(),
  staffCode: z.string().optional(),
  reason: z.string().optional(),
  delayMin: z.coerce.number().optional(),
})

type EventForm = z.infer<typeof eventSchema>

const EVENT_TYPES = [
  { value: 'ORDER_CANCELLED', label: '❌ Отмена наряда (ORDER_CANCELLED)', desc: 'Клиент отказался от визита' },
  { value: 'VISIT_DELAYED', label: '⏱️ Задержка на объекте (VISIT_DELAYED)', desc: 'Инженер задерживается на текущем адресе' },
  { value: 'STAFF_UNAVAILABLE', label: '🚫 Инженер сошел с линии (STAFF_UNAVAILABLE)', desc: 'Болезнь, авария авто или сход сотрудника' },
  { value: 'TIME_TICK', label: '🕒 Продвижение модельного времени (TIME_TICK)', desc: 'Сдвиг времени дня с фиксацией прошедших остановок' },
  { value: 'ORDER_TRANSFERRED', label: '📦 Передача наряда на станцию (ORDER_TRANSFERRED)', desc: 'Перевод наряда на линейно-кабельный цех' },
]

export const EventsPage = () => {
  const { currentDate, setCurrentDate } = useDayStore()
  const [successResult, setSuccessResult] = useState<any>(null)
  const [errorMessage, setErrorMessage] = useState<string>('')

  const { data: plan, refetch: refetchPlan } = usePlan(currentDate)
  const { data: orders = [] } = useOrders({ date: currentDate })
  const { data: staffList = [] } = useStaff()
  const createEvent = useCreateEvent()

  const form = useForm<EventForm>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      type: 'ORDER_CANCELLED',
      timestamp: `${currentDate}T11:00`,
      orderCode: '',
      staffCode: '',
      reason: 'Клиент не доступен',
      delayMin: 30,
    },
  })

  const selectedType = form.watch('type')

  const onSubmit = (data: EventForm) => {
    setErrorMessage('')
    setSuccessResult(null)

    // Format ISO string with offset
    const timeWithOffset = data.timestamp.length === 16 ? `${data.timestamp}:00+05:00` : data.timestamp

    const payload: any = {
      type: data.type,
      timestamp: timeWithOffset,
      reason: data.reason || undefined,
    }

    if (data.orderCode) {
      payload.order_id = data.orderCode
    }
    if (data.staffCode) {
      payload.staff_id = data.staffCode
    }
    if (data.delayMin && data.type === 'VISIT_DELAYED') {
      payload.delay_min = Number(data.delayMin)
    }

    createEvent.mutate(
      { date: currentDate, data: payload },
      {
        onSuccess: (res: any) => {
          setSuccessResult(res.data)
          refetchPlan()
        },
        onError: (err: any) => {
          setErrorMessage(err.response?.data?.message || 'Ошибка обработки события сервером')
        },
      }
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="h-7 w-7 text-amber-500" />
            Оперативные события смены и реактивное перепланирование
          </h1>
          <p className="text-muted-foreground">
            Регистрация форс-мажоров в течение смены (отмена наряда, сход инженера, задержка) с мгновенным перестроением маршрутов
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={currentDate}
            onChange={(e) => e.target.value && setCurrentDate(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Card (5 cols) */}
        <div className="lg:col-span-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Регистрация события</CardTitle>
              <CardDescription>
                Выберите тип инцидента. Сервер заморозит выполненные остановки и выполнит решатель на лету.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {errorMessage && (
                <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-xs flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 text-sm">
                <div className="space-y-1.5">
                  <Label>Тип события</Label>
                  <Select
                    value={selectedType}
                    onValueChange={(val: any) => form.setValue('type', val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите тип события" />
                    </SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map((et) => (
                        <SelectItem key={et.value} value={et.value}>
                          {et.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Модельное время наступления (timestamp)</Label>
                  <Input type="datetime-local" {...form.register('timestamp')} />
                </div>

                {/* Conditional field: Order Selector */}
                {(selectedType === 'ORDER_CANCELLED' ||
                  selectedType === 'VISIT_DELAYED' ||
                  selectedType === 'ORDER_TRANSFERRED') && (
                  <div className="space-y-1.5">
                    <Label>Наряд (код)</Label>
                    <Select
                      value={form.watch('orderCode')}
                      onValueChange={(val) => form.setValue('orderCode', val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите наряд" />
                      </SelectTrigger>
                      <SelectContent>
                        {orders.length === 0 ? (
                          <div className="p-3 text-xs text-muted-foreground text-center">
                            Наряды не найдены на дату {currentDate}
                          </div>
                        ) : (
                          orders.map((o: any) => {
                            const code = o.order_id || o.code || o.orderId || o.id
                            const addr = o.address || o.building_code || ''
                            const wt = o.work_type_name || o.work_type_code || ''
                            return (
                              <SelectItem key={o.id || code} value={code}>
                                <span className="font-mono font-semibold text-primary">{code}</span>
                                {addr && <span className="ml-1.5 text-muted-foreground">({addr})</span>}
                                {wt && <span className="ml-1 text-[11px] text-muted-foreground">[{wt}]</span>}
                              </SelectItem>
                            )
                          })
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Conditional field: Delay min */}
                {selectedType === 'VISIT_DELAYED' && (
                  <div className="space-y-1.5">
                    <Label>Длительность задержки (минут)</Label>
                    <Input type="number" min="5" step="5" {...form.register('delayMin')} />
                  </div>
                )}

                {/* Conditional field: Staff Selector */}
                {selectedType === 'STAFF_UNAVAILABLE' && (
                  <div className="space-y-1.5">
                    <Label>Сотрудник / бригада (код)</Label>
                    <Select
                      value={form.watch('staffCode')}
                      onValueChange={(val) => form.setValue('staffCode', val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите сотрудника" />
                      </SelectTrigger>
                      <SelectContent>
                        {staffList.length === 0 ? (
                          <div className="p-3 text-xs text-muted-foreground text-center">
                            Сотрудники не найдены
                          </div>
                        ) : (
                          staffList.map((st: any) => {
                            const staffCode = st.staff_id || st.staffId || st.code || st.id
                            const staffName = st.display_name || st.displayName || ''
                            return (
                              <SelectItem key={st.id || staffCode} value={staffCode}>
                                <span className="font-mono font-semibold">{staffCode}</span>
                                {staffName && <span className="ml-1.5 text-muted-foreground">({staffName})</span>}
                              </SelectItem>
                            )
                          })
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Причина / Примечание</Label>
                  <Input placeholder="Причина или пояснение" {...form.register('reason')} />
                </div>

                <Button type="submit" disabled={createEvent.isPending} className="w-full">
                  {createEvent.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Обработка события и перепланирование...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Отправить событие на сервер
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Results & Live Plan Status Card (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {successResult && (
            <Card className="border-emerald-300 bg-emerald-50/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-emerald-800 text-base flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Событие {successResult.code || successResult.type} успешно обработано!
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <p className="text-emerald-900 font-medium">{successResult.message}</p>
                <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded border border-emerald-200">
                  <div>
                    <span className="text-muted-foreground">Обработано в:</span>{' '}
                    <strong>
                      {successResult.processed_at || successResult.processedAt
                        ? formatClockSeconds(successResult.processed_at || successResult.processedAt)
                        : '—'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Версия плана:</span>{' '}
                    <strong>
                      v{successResult.plan?.plan_version ?? successResult.plan?.planVersion ?? successResult.planVersion ?? plan?.planVersion ?? '—'}
                    </strong>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Актуальное состояние плана ({currentDate})</CardTitle>
                {plan?.planVersion !== undefined && (
                  <Badge variant="outline">Версия плана: v{plan.planVersion}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {plan ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="p-3 bg-muted/30 rounded-lg border">
                      <span className="text-xs text-muted-foreground block">Нарядов</span>
                      <strong className="text-xl">{plan.metrics?.totalOrders ?? 0}</strong>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-800">
                      <span className="text-xs text-emerald-600 block">Назначено</span>
                      <strong className="text-xl">{plan.metrics?.assignedOrders ?? 0}</strong>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-red-800">
                      <span className="text-xs text-red-600 block">Не распределено</span>
                      <strong className="text-xl">{plan.metrics?.unassignedOrders ?? 0}</strong>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-blue-800">
                      <span className="text-xs text-blue-600 block">Маршрутов</span>
                      <strong className="text-xl">{plan.metrics?.activeRoutes ?? 0}</strong>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">
                      Маршруты бригад ({plan.routes?.length || 0})
                    </h4>
                    <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                      {plan.routes?.map((r: any) => (
                        <div
                          key={r.routeId}
                          className="flex items-center justify-between p-2.5 rounded-lg border bg-background text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{r.serviceCenterCode}</Badge>
                            <span className="font-semibold">{r.staffCode}</span>
                            <span className="text-muted-foreground">{r.staffName}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span>Нарядов: <strong>{r.totalOrders}</strong></span>
                            <span>В пути: <strong>{Math.round(r.totalTravelSec / 60)} мин</strong></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  План еще не построен на эту дату.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
