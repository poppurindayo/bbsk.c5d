import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog'
import {
  Calendar,
  Play,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Loader2,
  RefreshCw,
  Sparkles,
  Building2,
  Package,
  ArrowRight,
  ListChecks,
  UserX,
  Users,
  Clock,
  Edit2,
  Wand2,
  Check,
  CheckSquare,
  Square,
  Zap,
} from 'lucide-react'
import {
  useInitDay,
  useCreatePlan,
  usePlan,
  useDay,
  useOrders,
  useServiceCenters,
  useStaff,
  useBuildings,
} from '@/hooks/useApi'
import { useDayStore } from '@/store/dayStore'
import { TestOrdersGeneratorModal } from '@/components/orders/TestOrdersGeneratorModal'
import { GanttChart } from '@/components/gantt/GanttChart'

const STANDARD_SLOTS = [
  { start: '09:00', end: '11:00', label: '09:00 – 11:00' },
  { start: '11:00', end: '13:00', label: '11:00 – 13:00' },
  { start: '13:00', end: '15:00', label: '13:00 – 15:00' },
  { start: '15:00', end: '17:00', label: '15:00 – 17:00' },
  { start: '17:00', end: '19:00', label: '17:00 – 19:00' },
  { start: '19:00', end: '21:00', label: '19:00 – 21:00' },
]

export const DayPlanningPage = () => {
  const navigate = useNavigate()
  const { currentDate, setCurrentDate, selectedServiceCenterId } = useDayStore()

  // Main flow tab: 'init' (Этап 1: Подготовка и инициализация) | 'plan' (Этап 2: Маршруты и оптимизация)
  const [mainStep, setMainStep] = useState<'init' | 'plan'>('init')
  const [planSubTab, setPlanSubTab] = useState<string>('routes')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [generatorOpen, setGeneratorOpen] = useState(false)

  // Initialization phase state
  const [modelNowTime, setModelNowTime] = useState('08:00')
  const [selectedOrderCodes, setSelectedOrderCodes] = useState<Set<string>>(new Set())
  const [shiftedSlots, setShiftedSlots] = useState<Record<string, { start: string; end: string }>>({})
  const [absentStaffCodes, setAbsentStaffCodes] = useState<Set<string>>(new Set())

  // Modal for shifting slot
  const [shiftSlotModalOrder, setShiftSlotModalOrder] = useState<any | null>(null)
  const [newSlotStart, setNewSlotStart] = useState('09:00')
  const [newSlotEnd, setNewSlotEnd] = useState('11:00')

  const { data: plan, isLoading: planLoading, refetch: refetchPlan } = usePlan(currentDate)
  const { data: dayData, isLoading: dayLoading, refetch: refetchDay } = useDay(currentDate)
  const { data: serviceCenters = [] } = useServiceCenters()
  const { data: ordersList = [], refetch: refetchOrders, isLoading: ordersLoading } = useOrders({ date: currentDate })
  const { data: staffList = [] } = useStaff()
  const { data: buildings = [] } = useBuildings()

  // Резолв кода здания → адрес (для человекочитаемого отображения остановок)
  const buildingAddressMap = useMemo(() => {
    const m = new Map<string, string>()
    ;(buildings as any[]).forEach((b) => {
      const addr = b.address || ''
      if (!addr) return
      if (b.building_id) m.set(b.building_id, addr)
      if (b.code) m.set(b.code, addr)
      if (b.id) m.set(b.id, addr)
    })
    return m
  }, [buildings])

  const createPlan = useCreatePlan()
  const initDay = useInitDay()

  // Sync selected orders when ordersList arrives (default: all checked)
  useEffect(() => {
    if (ordersList.length > 0) {
      const allCodes = new Set<string>()
      ordersList.forEach((o: any) => {
        const code = o.order_id || o.code || o.orderId || o.id
        if (code) allCodes.add(code)
      })
      setSelectedOrderCodes(allCodes)
    }
  }, [ordersList])

  // If day is already initialized in DB, populate absent staff if present
  useEffect(() => {
    if (dayData?.absentStaffCodes) {
      setAbsentStaffCodes(new Set(dayData.absentStaffCodes))
    }
  }, [dayData])

  // Filter routes by dispatcher's selected SC
  const filteredRoutes = useMemo(() => {
    if (!plan?.routes) return []
    if (!selectedServiceCenterId) return plan.routes

    const sc = serviceCenters.find(
      (s: any) =>
        s.id === selectedServiceCenterId ||
        s.service_center_id === selectedServiceCenterId ||
        s.code === selectedServiceCenterId
    )
    if (!sc) return plan.routes

    const scCode = sc.service_center_id || sc.serviceCenterId || sc.code

    return plan.routes.filter((r: any) => {
      const rScCode = r.serviceCenterCode || r.service_center_code
      return (
        rScCode === scCode ||
        rScCode === selectedServiceCenterId ||
        (sc.id && r.serviceCenterId === sc.id)
      )
    })
  }, [plan?.routes, selectedServiceCenterId, serviceCenters])

  // Toggle order selection for the day pool
  const toggleOrderSelection = (code: string) => {
    const next = new Set(selectedOrderCodes)
    if (next.has(code)) {
      next.delete(code)
    } else {
      next.add(code)
    }
    setSelectedOrderCodes(next)
  }

  const toggleSelectAllOrders = () => {
    if (selectedOrderCodes.size === ordersList.length) {
      setSelectedOrderCodes(new Set())
    } else {
      const all = new Set<string>()
      ordersList.forEach((o: any) => {
        const code = o.order_id || o.code || o.orderId || o.id
        if (code) all.add(code)
      })
      setSelectedOrderCodes(all)
    }
  }

  // Toggle staff absence
  const toggleAbsentStaff = (code: string) => {
    const next = new Set(absentStaffCodes)
    if (next.has(code)) {
      next.delete(code)
    } else {
      next.add(code)
    }
    setAbsentStaffCodes(next)
  }

  // Open modal to shift order customer slot
  const handleOpenShiftModal = (order: any) => {
    const code = order.order_id || order.code || order.orderId
    const currentShift = shiftedSlots[code]
    const slotStartStr = currentShift?.start || order.slot_start || order.slotStart || `${currentDate}T09:00:00+05:00`
    const slotEndStr = currentShift?.end || order.slot_end || order.slotEnd || `${currentDate}T11:00:00+05:00`

    setNewSlotStart(slotStartStr.substring(11, 16) || '09:00')
    setNewSlotEnd(slotEndStr.substring(11, 16) || '11:00')
    setShiftSlotModalOrder(order)
  }

  // Apply slot shift
  const handleApplyShiftedSlot = () => {
    if (!shiftSlotModalOrder) return
    const code = shiftSlotModalOrder.order_id || shiftSlotModalOrder.code || shiftSlotModalOrder.orderId
    const fullStart = `${currentDate}T${newSlotStart}:00+05:00`
    const fullEnd = `${currentDate}T${newSlotEnd}:00+05:00`

    setShiftedSlots((prev) => ({
      ...prev,
      [code]: { start: fullStart, end: fullEnd },
    }))
    setShiftSlotModalOrder(null)
  }

  // Handle Day Initialization (Phase 1)
  const handleConfirmAndInitDay = () => {
    setError('')
    setSuccessMessage('')

    if (selectedOrderCodes.size === 0 && ordersList.length > 0) {
      setError('Выберите хотя бы один наряд для включения в план рабочего дня.')
      return
    }

    // Build DayInputDto
    const selectedOrdersData = ordersList
      .filter((o: any) => {
        const code = o.order_id || o.code || o.orderId || o.id
        return selectedOrderCodes.has(code)
      })
      .map((o: any) => {
        const code = o.order_id || o.code || o.orderId
        const customSlot = shiftedSlots[code]
        const slotStart = customSlot?.start || o.slot_start || o.slotStart || `${currentDate}T09:00:00+05:00`
        const slotEnd = customSlot?.end || o.slot_end || o.slotEnd || `${currentDate}T11:00:00+05:00`

        const reqEq = o.required_equipment || o.requiredEquipment || {}
        const ont = reqEq.ONT ?? reqEq.ont ?? o.required_ont ?? o.requiredOnt ?? 0
        const router = reqEq.ROUTER ?? reqEq.router ?? o.required_router ?? o.requiredRouter ?? 0
        const stb = reqEq.STB ?? reqEq.stb ?? o.required_stb ?? o.requiredStb ?? 0

        return {
          order_id: code,
          building_id: o.building_id || o.buildingId || o.buildingCode || 'B-001',
          work_type_id: o.work_type_id || o.workTypeId,
          work_type: o.work_type_code || o.workTypeCode,
          access_node_id: o.access_node_id || o.accessNodeId || null,
          service_center_id: o.service_center_id || o.serviceCenterId || null,
          registered_at: o.registered_at || o.registeredAt || `${currentDate}T08:00:00+05:00`,
          slot_start: slotStart,
          slot_end: slotEnd,
          slot: {
            start: slotStart,
            end: slotEnd,
          },
          required_equipment: {
            ONT: ont,
            ROUTER: router,
            STB: stb,
            ont,
            router,
            stb,
          },
          required_ont: ont,
          required_router: router,
          required_stb: stb,
          is_repeat: o.is_repeat ?? o.isRepeat ?? false,
          previous_order_id: o.previous_order_id || o.previousOrderId || null,
        }
      })

    const payload = {
      date: currentDate,
      now: `${currentDate}T${modelNowTime}:00+05:00`,
      orders: selectedOrdersData,
      absent_staff: Array.from(absentStaffCodes),
      absentStaff: Array.from(absentStaffCodes),
    }

    initDay.mutate(
      { date: currentDate, data: payload },
      {
        onSuccess: (res: any) => {
          setSuccessMessage(
            `День успешно зафиксирован! Подтверждено нарядов: ${selectedOrdersData.length}, отсутствующих инженеров: ${absentStaffCodes.size}. Теперь можно запускать расчет маршрутов.`
          )
          refetchDay()
          refetchOrders()
        },
        onError: (err: any) => {
          setError(err.response?.data?.message || 'Ошибка инициализации рабочего дня')
        },
      }
    )
  }

  // Handle Plan Calculation (Phase 2)
  const handleBuildPlan = () => {
    setError('')
    setSuccessMessage('')
    createPlan.mutate(currentDate, {
      onSuccess: () => {
        setMainStep('plan')
        refetchPlan()
        refetchDay()
      },
      onError: (err: any) => {
        setError(
          err.response?.data?.message ||
            'Ошибка расчета плана. Проверьте, что день инициализирован и доступен солвер.'
        )
      },
    })
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Calendar className="h-7 w-7 text-primary" />
            Планирование смены и маршрутизация
          </h1>
          <p className="text-muted-foreground text-sm">
            Двухэтапный процесс: 1) Подтверждение и инициализация пула нарядов; 2) Оптимизация маршрутов выездных бригад
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-background border px-3 py-1.5 rounded-lg shadow-xs text-xs font-medium">
            <span className="text-muted-foreground">Дата:</span>
            <input
              type="date"
              value={currentDate}
              onChange={(e) => e.target.value && setCurrentDate(e.target.value)}
              className="bg-transparent font-semibold cursor-pointer outline-none"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/map')}
            className="gap-1.5"
            title="Открыть на интерактивной карте"
          >
            <MapPin className="h-4 w-4 text-primary" />
            <span>Карта</span>
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              refetchDay()
              refetchOrders()
              refetchPlan()
            }}
            title="Обновить"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3.5 rounded-xl border border-destructive/20 animate-in fade-in">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center justify-between gap-2 text-sm text-emerald-800 bg-emerald-50 p-3.5 rounded-xl border border-emerald-200 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setMainStep('plan')
              handleBuildPlan()
            }}
            className="gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs"
          >
            Рассчитать маршруты
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Main Stepper Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setMainStep('init')}
          className={`flex items-center justify-between p-4 rounded-xl border text-left transition-all ${
            mainStep === 'init'
              ? 'bg-primary/5 border-primary shadow-xs ring-1 ring-primary'
              : 'bg-card hover:bg-muted/40 border-border'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`h-10 w-10 rounded-lg flex items-center justify-center font-bold ${
                mainStep === 'init' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              1
            </div>
            <div>
              <h3 className="font-semibold text-sm">Подготовка и инициализация дня</h3>
              <p className="text-xs text-muted-foreground">
                Подтверждение нарядов, смещение слотов, учет отсутствующих инженеров
              </p>
            </div>
          </div>
          <Badge variant={dayData ? 'default' : 'outline'}>
            {dayData ? `Инициализирован (${dayData.ordersCount ?? ordersList.length})` : 'Не зафиксирован'}
          </Badge>
        </button>

        <button
          type="button"
          onClick={() => setMainStep('plan')}
          className={`flex items-center justify-between p-4 rounded-xl border text-left transition-all ${
            mainStep === 'plan'
              ? 'bg-primary/5 border-primary shadow-xs ring-1 ring-primary'
              : 'bg-card hover:bg-muted/40 border-border'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`h-10 w-10 rounded-lg flex items-center justify-center font-bold ${
                mainStep === 'plan' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              2
            </div>
            <div>
              <h3 className="font-semibold text-sm">Расчет и план маршрутов</h3>
              <p className="text-xs text-muted-foreground">
                Оптимизация солвером, раскладка по бригадам, перерывы и ПГП
              </p>
            </div>
          </div>
          <Badge variant={plan ? 'success' : 'secondary'}>
            {plan ? `План v${plan.planVersion} (${plan.metrics?.assignedOrders ?? 0})` : 'План не рассчитан'}
          </Badge>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* STEP 1: INITIALIZE DAY & PREPARE ORDERS POOL */}
      {/* ========================================================================= */}
      {mainStep === 'init' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Day Settings Bar */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Параметры смены на {currentDate}
              </CardTitle>
              <CardDescription>
                Укажите модельное время начала планирования дня и отметьте сотрудников, которых нет на смене.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <div className="space-y-1.5">
                  <Label htmlFor="modelNowTime" className="text-xs font-semibold">
                    Модельное время начала смены (now)
                  </Label>
                  <Input
                    id="modelNowTime"
                    type="time"
                    value={modelNowTime}
                    onChange={(e) => setModelNowTime(e.target.value)}
                    className="w-full sm:w-48 bg-background font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Время, от которого солвер строит старт из СЦ (обычно 08:00)
                  </p>
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <UserX className="h-4 w-4 text-amber-500" />
                      Отсутствующие сотрудники ({absentStaffCodes.size} из {staffList.length})
                    </Label>
                    <span className="text-[11px] text-muted-foreground">
                      Нажмите на сотрудника, чтобы отметить больничный / отгул
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 border rounded-lg bg-muted/20">
                    {staffList.length === 0 ? (
                      <span className="text-xs text-muted-foreground p-1">Сотрудники не найдены</span>
                    ) : (
                      staffList.map((st: any) => {
                        const code = st.code || st.staff_id || st.id
                        const isAbsent = absentStaffCodes.has(code)
                        const name = st.display_name || st.displayName || st.name || code
                        return (
                          <button
                            key={code}
                            type="button"
                            onClick={() => toggleAbsentStaff(code)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 border ${
                              isAbsent
                                ? 'bg-destructive/15 text-destructive border-destructive/30 line-through'
                                : 'bg-background hover:bg-muted text-foreground border-border'
                            }`}
                            title={isAbsent ? 'Сотрудник отсутствует (клик чтобы вернуть)' : 'В строю (клик чтобы отметить отсутствие)'}
                          >
                            <span>{name} ({code})</span>
                            {isAbsent && <UserX className="h-3 w-3" />}
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Orders Pool Table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ListChecks className="h-5 w-5 text-primary" />
                    Наряды на дату {currentDate} ({selectedOrderCodes.size} из {ordersList.length} подтверждено)
                  </CardTitle>
                  <CardDescription>
                    Проверьте заявки, при необходимости измените временной слот клиента или снимите отметку для переноса на другой день.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setGeneratorOpen(true)}
                    className="gap-1.5 text-xs text-primary border-primary/30"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    Генератор нарядов
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleSelectAllOrders}
                    className="text-xs"
                    disabled={ordersList.length === 0}
                  >
                    {selectedOrderCodes.size === ordersList.length ? 'Снять все' : 'Выбрать все'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : ordersList.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <p className="text-muted-foreground text-sm">
                    На дату {currentDate} не зарегистрировано ни одного наряда.
                  </p>
                  <Button
                    onClick={() => setGeneratorOpen(true)}
                    className="gap-2 shadow"
                  >
                    <Wand2 className="h-4 w-4" />
                    Сгенерировать тестовые наряды на {currentDate}
                  </Button>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="w-10 text-center">Вкл.</TableHead>
                        <TableHead className="w-[140px]">Код наряда</TableHead>
                        <TableHead>Адрес объекта</TableHead>
                        <TableHead>Тип работ</TableHead>
                        <TableHead>Слот визита</TableHead>
                        <TableHead>АО</TableHead>
                        <TableHead className="w-[110px] text-right">Действие</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ordersList.map((order: any) => {
                        const code = order.order_id || order.code || order.orderId
                        const isSelected = selectedOrderCodes.has(code)
                        const customSlot = shiftedSlots[code]
                        const slotStart = customSlot?.start || order.slot_start || order.slotStart
                        const slotEnd = customSlot?.end || order.slot_end || order.slotEnd
                        const address = order.address || order.building?.address || order.building_id || order.buildingId || '—'
                        const wtName = order.work_type_name || order.workType?.name || order.work_type_id || order.workTypeId || '—'
                        const reqEq = order.required_equipment || order.requiredEquipment || {}
                        const ont = reqEq.ONT ?? reqEq.ont ?? order.required_ont ?? order.requiredOnt ?? 0
                        const router = reqEq.ROUTER ?? reqEq.router ?? order.required_router ?? order.requiredRouter ?? 0
                        const stb = reqEq.STB ?? reqEq.stb ?? order.required_stb ?? order.requiredStb ?? 0

                        return (
                          <TableRow
                            key={code}
                            className={`transition-colors ${isSelected ? '' : 'opacity-50 bg-muted/20'}`}
                          >
                            <TableCell className="text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleOrderSelection(code)}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                              />
                            </TableCell>
                            <TableCell className="font-mono font-semibold text-xs text-primary">
                              {code}
                              {order.is_repeat && (
                                <Badge variant="destructive" className="ml-1.5 text-[9px] py-0 px-1">
                                  Повтор
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs max-w-[220px] truncate font-medium" title={address}>
                              {address}
                            </TableCell>
                            <TableCell className="text-xs max-w-[180px] truncate" title={wtName}>
                              {wtName}
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${
                                  customSlot ? 'bg-amber-100 text-amber-900 border border-amber-300' : ''
                                }`}
                              >
                                {slotStart ? slotStart.substring(11, 16) : '09:00'} –{' '}
                                {slotEnd ? slotEnd.substring(11, 16) : '11:00'}
                                {customSlot && <span className="text-[9px] font-bold">*смещен</span>}
                              </span>
                            </TableCell>
                            <TableCell className="text-[11px] font-mono text-muted-foreground">
                              ONT:{ont} RT:{router} STB:{stb}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenShiftModal(order)}
                                className="h-7 text-xs gap-1 text-primary hover:text-primary"
                                title="Сместить временной слот клиента"
                              >
                                <Edit2 className="h-3 w-3" />
                                <span>Слот</span>
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Bottom Action Bar */}
              <div className="pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t mt-4">
                <div className="text-xs text-muted-foreground">
                  Будет зафиксировано: <strong>{selectedOrderCodes.size}</strong> нарядов,{' '}
                  <strong>{staffList.length - absentStaffCodes.size}</strong> активных инженеров
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleConfirmAndInitDay}
                    disabled={initDay.isPending || ordersList.length === 0}
                    className="gap-2 bg-primary shadow"
                  >
                    {initDay.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Инициализация...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Зафиксировать и инициализировать день
                      </>
                    )}
                  </Button>

                  {dayData && (
                    <Button
                      variant="outline"
                      onClick={() => setMainStep('plan')}
                      className="gap-1.5"
                    >
                      К расчету плана
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: ROUTE OPTIMIZATION & PLAN INSPECTION */}
      {/* ========================================================================= */}
      {mainStep === 'plan' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Top Solver Trigger Bar */}
          <Card className="bg-gradient-to-r from-primary/5 via-card to-card border-primary/20">
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  <h3 className="font-bold text-base">Оптимизация суточного расписания</h3>
                  {plan && <Badge variant="secondary">Версия {plan.planVersion}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  Алгоритм выполняет балансировку нарядов по сменам инженеров, учет допусков на высоту, расчет OSRM-маршрутов и детекцию ПГП.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  onClick={handleBuildPlan}
                  disabled={createPlan.isPending}
                  className="gap-2 bg-primary shadow text-primary-foreground font-semibold"
                >
                  {createPlan.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Расчет солвером...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 fill-current" />
                      {plan ? 'Пересчитать план' : 'Рассчитать план маршрутов'}
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => navigate('/map')}
                  className="gap-1.5"
                  title="Открыть маршруты на интерактивной карте"
                >
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="hidden sm:inline">На карту</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {planLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !plan ? (
            <Card>
              <CardContent className="py-12 text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Play className="h-6 w-6 text-primary fill-current ml-0.5" />
                </div>
                <div className="space-y-1 max-w-md mx-auto">
                  <h4 className="font-semibold text-base">План на {currentDate} еще не рассчитан</h4>
                  <p className="text-xs text-muted-foreground">
                    Нажмите кнопку «Рассчитать план маршрутов» выше, чтобы запустить оптимизацию солвером.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Button onClick={handleBuildPlan} disabled={createPlan.isPending} className="gap-2">
                    {createPlan.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Рассчитать план сейчас
                  </Button>
                  <Button variant="outline" onClick={() => setMainStep('init')}>
                    ← Вернуться к проверке нарядов
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Top Metrics Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <span className="text-xs text-muted-foreground block">Всего нарядов</span>
                    <strong className="text-2xl font-bold">{plan.metrics?.totalOrders ?? 0}</strong>
                  </CardContent>
                </Card>
                <Card className="bg-emerald-50/50 border-emerald-200">
                  <CardContent className="p-4">
                    <span className="text-xs text-emerald-700 block">Назначено на бригады</span>
                    <strong className="text-2xl font-bold text-emerald-800">
                      {plan.metrics?.assignedOrders ?? 0}
                    </strong>
                  </CardContent>
                </Card>
                <Card className="bg-red-50/50 border-red-200">
                  <CardContent className="p-4">
                    <span className="text-xs text-red-700 block">Не распределено</span>
                    <strong className="text-2xl font-bold text-red-800">
                      {plan.metrics?.unassignedOrders ?? 0}
                    </strong>
                  </CardContent>
                </Card>
                <Card className="bg-blue-50/50 border-blue-200">
                  <CardContent className="p-4">
                    <span className="text-xs text-blue-700 block">Активных бригад</span>
                    <strong className="text-2xl font-bold text-blue-800">
                      {plan.metrics?.activeRoutes ?? 0}
                    </strong>
                  </CardContent>
                </Card>
              </div>

              {/* Plan Sub Tabs */}
              <Tabs value={planSubTab} onValueChange={setPlanSubTab} className="space-y-4">
                <TabsList className="grid grid-cols-5 max-w-xl text-xs h-9">
                  <TabsTrigger value="routes">Маршруты ({filteredRoutes.length})</TabsTrigger>
                  <TabsTrigger value="gantt">Гант</TabsTrigger>
                  <TabsTrigger value="unassigned">Не распределено ({plan.unassignedOrders?.length || 0})</TabsTrigger>
                  <TabsTrigger value="alerts">Алерты ({plan.alerts?.length || 0})</TabsTrigger>
                  <TabsTrigger value="pgp">ПГП ({plan.metrics?.pgpOrders ?? 0})</TabsTrigger>
                </TabsList>

                {/* SubTab: Gantt Chart */}
                <TabsContent value="gantt" className="space-y-4">
                  <GanttChart
                    routes={filteredRoutes}
                    modelNow={dayData?.currentNow || (modelNowTime ? `${currentDate}T${modelNowTime}:00+05:00` : undefined)}
                  />
                </TabsContent>

                {/* SubTab: Routes */}
                <TabsContent value="routes" className="space-y-4">
                  {filteredRoutes.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground text-sm">
                      Маршрутов нет или они отфильтрованы по сервисному центру.
                    </div>
                  ) : (
                    filteredRoutes.map((route: any) => {
                      const routeId = route.routeId || route.route_id || route.id
                      const staffCode = route.staffCode || route.staff_code || ''
                      const staffName = route.staffName || route.staff_name || ''
                      const scCode = route.serviceCenterCode || route.service_center_code || ''
                      const totalOrders = route.totalOrders ?? route.total_orders ?? 0
                      const totalTravelSec = route.totalTravelSec ?? route.total_travel_sec ?? 0
                      const totalWorkMin = route.totalWorkMin ?? route.total_work_min ?? 0

                      return (
                      <Card key={routeId}>
                        <CardHeader className="pb-3 bg-muted/20 border-b">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <span className="font-bold text-base">{staffName || staffCode}</span>
                              {staffCode && (
                                <Badge variant="secondary" className="font-mono text-[10px]">
                                  {staffCode}
                                </Badge>
                              )}
                              {scCode && (
                                <span className="text-xs text-muted-foreground">{scCode}</span>
                              )}
                              <Badge variant={route.status === 'ACTIVE' ? 'default' : 'outline'} className="text-[10px]">
                                {route.status}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-3">
                              <span>Нарядов: <strong className="text-foreground">{totalOrders}</strong></span>
                              <span>В пути: <strong className="text-foreground">{Math.round(totalTravelSec / 60)} мин</strong></span>
                              <span>Работа: <strong className="text-foreground">{totalWorkMin} мин</strong></span>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-0">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/30">
                                <TableHead className="w-12 text-xs">#</TableHead>
                                <TableHead className="text-xs">Тип остановки</TableHead>
                                <TableHead className="text-xs">Объект / Наряд</TableHead>
                                <TableHead className="text-xs">Прибытие</TableHead>
                                <TableHead className="text-xs">Окончание</TableHead>
                                <TableHead className="text-xs">В пути</TableHead>
                                <TableHead className="text-xs">Остаток оборудования</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(route.stops || []).map((stop: any) => {
                                const orderCode = stop.orderCode || stop.order_code || stop.orderId || stop.order_id
                                const locationCode = stop.locationCode || stop.location_code || ''
                                const locationAddress = buildingAddressMap.get(locationCode) || ''
                                const arrival = stop.arrival
                                const endTime = stop.endTime || stop.end_time
                                const travelSec = stop.travelSec ?? stop.travel_sec ?? 0
                                const eq = stop.equipmentAfter || stop.equipment_after || {}
                                const ont = eq.ONT ?? eq.ont ?? stop.equipmentAfterOnt ?? 0
                                const router = eq.ROUTER ?? eq.router ?? stop.equipmentAfterRouter ?? 0
                                const stb = eq.STB ?? eq.stb ?? stop.equipmentAfterStb ?? 0

                                return (
                                <TableRow key={stop.id || stop.seq} className="text-xs">
                                  <TableCell className="font-mono font-medium">{stop.seq}</TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={
                                        stop.type === 'VISIT'
                                          ? 'default'
                                          : stop.type === 'BREAK'
                                          ? 'warning'
                                          : 'secondary'
                                      }
                                      className="text-[10px] py-0"
                                    >
                                      {stop.type}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    <div className="flex flex-col gap-0.5">
                                      <span className="truncate max-w-[240px]" title={locationAddress || locationCode}>
                                        {locationAddress || locationCode || '—'}
                                      </span>
                                      {(orderCode || locationCode) && (
                                        <span className="text-muted-foreground text-[10px] font-mono">
                                          {orderCode || locationCode}
                                        </span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-mono">
                                    {arrival ? arrival.substring(11, 16) : '—'}
                                  </TableCell>
                                  <TableCell className="font-mono">
                                    {endTime ? endTime.substring(11, 16) : '—'}
                                  </TableCell>
                                  <TableCell>
                                    {travelSec > 0 ? `${Math.round(travelSec / 60)} мин` : '0 мин'}
                                  </TableCell>
                                  <TableCell className="font-mono text-muted-foreground">
                                    ONT:{ont} RT:{router} STB:{stb}
                                  </TableCell>
                                </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                      )
                    })
                  )}
                </TabsContent>

                {/* SubTab: Unassigned */}
                <TabsContent value="unassigned" className="space-y-3">
                  {!(plan.unassignedOrders || plan.unassigned_orders) || (plan.unassignedOrders || plan.unassigned_orders).length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground text-sm">
                      Все наряды успешно распределены по бригадам.
                    </div>
                  ) : (
                    (plan.unassignedOrders || plan.unassigned_orders).map((uo: any, idx: number) => {
                      const orderId = uo.orderCode || uo.order_code || uo.orderId || uo.order_id || idx
                      const reason = uo.reasonText || uo.reason_text || uo.reason || 'Нехватка времени смены / нет подходящей квалификации'
                      const action = uo.suggestedAction || uo.suggested_action
                      return (
                      <Card key={uo.id || idx} className="border-l-4 border-amber-500">
                        <CardContent className="py-3 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-sm text-primary font-mono">{orderId}</span>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Причина: {reason}
                            </p>
                            {action && (
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                Рекомендация: {action}
                              </p>
                            )}
                          </div>
                          <Badge variant="outline">Не назначен</Badge>
                        </CardContent>
                      </Card>
                      )
                    })
                  )}
                </TabsContent>

                {/* SubTab: Alerts */}
                <TabsContent value="alerts" className="space-y-3">
                  {!plan.alerts || plan.alerts.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground text-sm">
                      Алертов нет. Маршруты соответствуют нормативам.
                    </div>
                  ) : (
                    plan.alerts.map((alert: any) => (
                      <Card key={alert.id || alert.code} className="border-l-4 border-destructive">
                        <CardContent className="py-3">
                          <p className="font-semibold text-sm">{alert.message}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 font-mono">{alert.type || alert.code}</p>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>

                {/* SubTab: PGP */}
                <TabsContent value="pgp" className="space-y-3">
                  <div className="p-4 bg-muted/30 rounded-xl border text-xs text-muted-foreground">
                    Выявленные группы повреждений (ПГП): <strong>{(plan.pgpGroups || plan.pgp_groups)?.length ?? (plan.metrics?.pgpOrders ?? 0)}</strong> нарядов.
                    Заявки из групп ПГП изолируются от обычных выездов и направляются на аварийно-восстановительные бригады.
                  </div>
                  {((plan.pgpGroups || plan.pgp_groups) || []).map((pgp: any) => (
                    <Card key={pgp.id || pgp.code} className="border-l-4 border-primary">
                      <CardContent className="py-3 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-primary font-mono">{pgp.code}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {pgp.action || 'ISOLATE'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Узел доступа: <strong>{pgp.accessNodeCode || pgp.access_node_code}</strong>
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Наряды в группе: {(pgp.orderCodes || pgp.order_codes || []).join(', ')}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      )}

      {/* Modal: Shift Slot */}
      {shiftSlotModalOrder && (
        <Dialog open={!!shiftSlotModalOrder} onOpenChange={() => setShiftSlotModalOrder(null)}>
          <DialogContent className="max-w-md w-full">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-primary" />
                Смещение клиентского слота
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="p-3 bg-muted/30 rounded-lg text-xs space-y-1">
                <div>
                  <span className="text-muted-foreground">Наряд: </span>
                  <strong className="font-mono text-primary">
                    {shiftSlotModalOrder.order_id || shiftSlotModalOrder.code || shiftSlotModalOrder.orderId}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Адрес: </span>
                  <span>{shiftSlotModalOrder.address || shiftSlotModalOrder.building?.address}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Выберите новое 2-часовое окно:</Label>
                <div className="grid grid-cols-3 gap-2">
                  {STANDARD_SLOTS.map((s) => (
                    <Button
                      key={s.label}
                      type="button"
                      variant={newSlotStart === s.start ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setNewSlotStart(s.start)
                        setNewSlotEnd(s.end)
                      }}
                      className="text-xs h-8 px-1 font-mono"
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label htmlFor="shiftStart" className="text-xs">Начало</Label>
                  <Input
                    id="shiftStart"
                    type="time"
                    value={newSlotStart}
                    onChange={(e) => setNewSlotStart(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="shiftEnd" className="text-xs">Окончание</Label>
                  <Input
                    id="shiftEnd"
                    type="time"
                    value={newSlotEnd}
                    onChange={(e) => setNewSlotEnd(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button variant="outline" onClick={() => setShiftSlotModalOrder(null)}>
                Отмена
              </Button>
              <Button onClick={handleApplyShiftedSlot}>
                Применить новый слот
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Test Orders Generator Modal */}
      <TestOrdersGeneratorModal
        open={generatorOpen}
        onOpenChange={setGeneratorOpen}
        targetDate={currentDate}
        onSuccess={() => {
          refetchOrders()
          refetchDay()
        }}
      />
    </div>
  )
}
