import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Plus, Search, Loader2, Eye, Filter, RefreshCw, CheckCircle2, AlertTriangle, Calendar, Building2, Wand2, Clock, Sparkles, Check, Minus, Trash2, Edit } from 'lucide-react'
import { useOrders, useCreateOrder, useWorkTypes, useBuildings, useServiceCenters, useDeleteOrder, useUpdateOrder } from '@/hooks/useApi'
import { useDayStore } from '@/store/dayStore'
import { TestOrdersGeneratorModal } from '@/components/orders/TestOrdersGeneratorModal'
import { format } from 'date-fns'
import { formatClock } from '@/utils/time'

const orderSchema = z.object({
  orderId: z.string().regex(/^ORD-[0-9]{8}-[0-9]{4}$/, 'Формат: ORD-ГГГГММДД-ЧЧЧЧ (напр. ORD-20261026-0001)'),
  dayId: z.string().min(1, 'Дата/день обязателен'),
  workTypeId: z.string().min(1, 'Выберите тип работ'),
  buildingId: z.string().min(1, 'Выберите здание'),
  registeredAt: z.string().min(1, 'Время регистрации обязательно'),
  slotStart: z.string().min(1, 'Начало слота обязательно'),
  slotEnd: z.string().min(1, 'Конец слота обязательно'),
  requiredEquipmentOnt: z.coerce.number().min(0).default(0),
  requiredEquipmentRouter: z.coerce.number().min(0).default(0),
  requiredEquipmentStb: z.coerce.number().min(0).default(0),
  isRepeat: z.boolean().default(false),
})

type OrderForm = z.infer<typeof orderSchema>

const PRESET_SLOTS = [
  { start: '09:00', end: '11:00', label: '09:00 – 11:00' },
  { start: '11:00', end: '13:00', label: '11:00 – 13:00' },
  { start: '13:00', end: '15:00', label: '13:00 – 15:00' },
  { start: '15:00', end: '17:00', label: '15:00 – 17:00' },
  { start: '17:00', end: '19:00', label: '17:00 – 19:00' },
  { start: '19:00', end: '21:00', label: '19:00 – 21:00' },
]

export const OrdersPage = () => {
  const { currentDate, setCurrentDate, selectedServiceCenterId, setSelectedServiceCenterId } = useDayStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [filterAllDates, setFilterAllDates] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [generatorOpen, setGeneratorOpen] = useState(false)
  const [viewOrder, setViewOrder] = useState<any>(null)
  const [editOrder, setEditOrder] = useState<any>(null)
  const [formError, setFormError] = useState<string>('')

  // Slot time state for user-friendly picker
  const [slotTimeStart, setSlotTimeStart] = useState('09:00')
  const [slotTimeEnd, setSlotTimeEnd] = useState('11:00')

  const { data: orders = [], isLoading, refetch } = useOrders({
    date: filterAllDates ? undefined : currentDate,
    status: statusFilter === 'ALL' ? undefined : statusFilter,
  })

  const { data: workTypes = [] } = useWorkTypes()
  const { data: buildings = [] } = useBuildings()
  const { data: serviceCenters = [] } = useServiceCenters()
  const createOrder = useCreateOrder()
  const deleteOrder = useDeleteOrder()
  const updateOrder = useUpdateOrder()

  // Generate unique order ID in format ORD-YYYYMMDD-XXXX
  const generateOrderId = (dateStr: string) => {
    const cleanDate = dateStr.replace(/-/g, '')
    const randNum = String(Math.floor(Math.random() * 9000) + 1000)
    return `ORD-${cleanDate}-${randNum}`
  }

  const form = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      orderId: generateOrderId(currentDate),
      dayId: currentDate,
      workTypeId: '',
      buildingId: '',
      registeredAt: `${currentDate}T08:00:00+05:00`,
      slotStart: `${currentDate}T09:00:00+05:00`,
      slotEnd: `${currentDate}T11:00:00+05:00`,
      requiredEquipmentOnt: 0,
      requiredEquipmentRouter: 1,
      requiredEquipmentStb: 0,
      isRepeat: false,
    },
  })

  const handleApplySlot = (start: string, end: string, targetDate?: string) => {
    const d = targetDate || form.getValues('dayId') || currentDate
    setSlotTimeStart(start)
    setSlotTimeEnd(end)
    form.setValue('slotStart', `${d}T${start}:00+05:00`, { shouldValidate: true })
    form.setValue('slotEnd', `${d}T${end}:00+05:00`, { shouldValidate: true })
  }

  const handleDateChange = (newDate: string) => {
    form.setValue('dayId', newDate, { shouldValidate: true })
    form.setValue('orderId', generateOrderId(newDate), { shouldValidate: true })
    form.setValue('registeredAt', `${newDate}T08:00:00+05:00`)
    form.setValue('slotStart', `${newDate}T${slotTimeStart}:00+05:00`, { shouldValidate: true })
    form.setValue('slotEnd', `${newDate}T${slotTimeEnd}:00+05:00`, { shouldValidate: true })
  }

  const openCreateDialog = () => {
    setFormError('')
    setSlotTimeStart('09:00')
    setSlotTimeEnd('11:00')
    form.reset({
      orderId: generateOrderId(currentDate),
      dayId: currentDate,
      workTypeId: workTypes[0]?.id || '',
      buildingId: buildings[0]?.id || '',
      registeredAt: `${currentDate}T08:00:00+05:00`,
      slotStart: `${currentDate}T09:00:00+05:00`,
      slotEnd: `${currentDate}T11:00:00+05:00`,
      requiredEquipmentOnt: 0,
      requiredEquipmentRouter: 1,
      requiredEquipmentStb: 0,
      isRepeat: false,
    })
    setDialogOpen(true)
  }

  const openEditDialog = (order: any) => {
    setFormError('')
    const bldId = order.building_id || order.buildingId
    const bld = buildingMap.get(bldId)
    const wtId = order.work_type_id || order.workTypeId
    const wt = workTypeMap.get(wtId)

    const slotStart = order.slot_start || order.slotStart
    const slotEnd = order.slot_end || order.slotEnd
    const slotTimeStart = formatClock(slotStart, '09:00')
    const slotTimeEnd = formatClock(slotEnd, '11:00')

    const dayId = order.day_date || order.dayDate || order.day_id || order.dayId || currentDate

    setSlotTimeStart(slotTimeStart)
    setSlotTimeEnd(slotTimeEnd)
    form.reset({
      orderId: order.order_id || order.orderId || order.code || '',
      dayId: dayId,
      workTypeId: wt?.id || order.work_type_id || order.workTypeId || '',
      buildingId: bld?.id || order.building_id || order.buildingId || '',
      registeredAt: order.registered_at || order.registeredAt || `${dayId}T08:00:00+05:00`,
      slotStart: slotStart || `${dayId}T${slotTimeStart}:00+05:00`,
      slotEnd: slotEnd || `${dayId}T${slotTimeEnd}:00+05:00`,
      requiredEquipmentOnt: order.required_ont ?? order.requiredOnt ?? order.required_equipment?.ONT ?? order.requiredEquipment?.ont ?? 0,
      requiredEquipmentRouter: order.required_router ?? order.requiredRouter ?? order.required_equipment?.ROUTER ?? order.requiredEquipment?.router ?? 0,
      requiredEquipmentStb: order.required_stb ?? order.requiredStb ?? order.required_equipment?.STB ?? order.requiredEquipment?.stb ?? 0,
      isRepeat: order.is_repeat ?? order.isRepeat ?? false,
    })
    setEditOrder(order)
    setDialogOpen(true)
  }

  const onSubmit = (data: OrderForm) => {
    setFormError('')
    const payload = {
      order_id: data.orderId,
      orderId: data.orderId,
      day_date: data.dayId,
      dayDate: data.dayId,
      work_type_id: data.workTypeId,
      workTypeId: data.workTypeId,
      building_id: data.buildingId,
      buildingId: data.buildingId,
      registered_at: data.registeredAt,
      registeredAt: data.registeredAt,
      slot_start: data.slotStart,
      slotStart: data.slotStart,
      slot_end: data.slotEnd,
      slotEnd: data.slotEnd,
      slot: {
        start: data.slotStart,
        end: data.slotEnd,
      },
      required_ont: data.requiredEquipmentOnt,
      required_router: data.requiredEquipmentRouter,
      required_stb: data.requiredEquipmentStb,
      requiredEquipment: {
        ONT: data.requiredEquipmentOnt,
        ROUTER: data.requiredEquipmentRouter,
        STB: data.requiredEquipmentStb,
      },
      is_repeat: data.isRepeat,
      isRepeat: data.isRepeat,
    }

    const isEditing = !!editOrder
    const mutation = isEditing ? updateOrder : createOrder
    const orderId = editOrder?.id

    mutation.mutate(isEditing ? { id: orderId, data: payload } : payload, {
      onSuccess: () => {
        setDialogOpen(false)
        setEditOrder(null)
        refetch()
      },
      onError: (err: any) => {
        setFormError(err.response?.data?.message || err.message || (isEditing ? 'Ошибка обновления наряда' : 'Ошибка создания наряда'))
      },
    })
  }

  // Lookups for building and work type details
  const buildingMap = useMemo(() => {
    const map = new Map<string, any>()
    buildings.forEach((b: any) => {
      map.set(b.id, b)
      if (b.building_id) map.set(b.building_id, b)
      if (b.code) map.set(b.code, b)
    })
    return map
  }, [buildings])

  const workTypeMap = useMemo(() => {
    const map = new Map<string, any>()
    workTypes.forEach((wt: any) => {
      map.set(wt.id, wt)
      map.set(wt.code, wt)
    })
    return map
  }, [workTypes])

  // Filter orders by search & selected SC
  const filteredOrders = useMemo(() => {
    const scObj = selectedServiceCenterId
      ? serviceCenters.find((s: any) => s.id === selectedServiceCenterId || s.code === selectedServiceCenterId)
      : null
    const allowedScValues = new Set<string>()
    if (scObj) {
      if (scObj.id) allowedScValues.add(scObj.id)
      if (scObj.code) allowedScValues.add(scObj.code)
      if (scObj.service_center_id) allowedScValues.add(scObj.service_center_id)
    } else if (selectedServiceCenterId) {
      allowedScValues.add(selectedServiceCenterId)
    }

    return orders.filter((o: any) => {
      const bldId = o.building_id || o.buildingId
      const bld = buildingMap.get(bldId)
      const wtId = o.work_type_id || o.workTypeId
      const wt = workTypeMap.get(wtId)

      // Filter by SC
      if (allowedScValues.size > 0) {
        const oScId = o.service_center_id || o.serviceCenterId
        const oScCode = o.service_center_code || o.serviceCenterCode
        const bldScId = bld?.zone_service_center_id || bld?.zoneServiceCenterId
        const matches =
          (oScId && allowedScValues.has(oScId)) ||
          (oScCode && allowedScValues.has(oScCode)) ||
          (bldScId && allowedScValues.has(bldScId))

        if (!matches) return false
      }

      if (!search) return true
      const s = search.toLowerCase()
      const code = o.order_id || o.code || o.orderId || ''
      const address = o.address || bld?.address || ''
      const wtName = o.work_type_name || wt?.name || wt?.code || ''

      return (
        code.toLowerCase().includes(s) ||
        address.toLowerCase().includes(s) ||
        wtName.toLowerCase().includes(s)
      )
    })
  }, [orders, selectedServiceCenterId, serviceCenters, search, buildingMap, workTypeMap])

  // Bulk delete state
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set())
  const isAllSelected = filteredOrders.length > 0 && filteredOrders.every((o: any) => selectedOrderIds.has(o.id))

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev)
      if (next.has(orderId)) {
        next.delete(orderId)
      } else {
        next.add(orderId)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedOrderIds(new Set())
    } else {
      setSelectedOrderIds(new Set(filteredOrders.map((o: any) => o.id)))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedOrderIds.size === 0) return
    if (!window.confirm(`Удалить ${selectedOrderIds.size} наряд(ов)? Это действие нельзя отменить.`)) return

    let successCount = 0
    for (const orderId of selectedOrderIds) {
      try {
        await deleteOrder.mutateAsync(orderId)
        successCount++
      } catch (err) {
        console.error('Failed to delete order:', orderId, err)
      }
    }
    setSelectedOrderIds(new Set())
    refetch()
    if (successCount > 0) {
      alert(`Успешно удалено ${successCount} наряд(ов)`)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Заявки и наряды на работы</h1>
          <p className="text-muted-foreground">
            Просмотр, фильтрация и регистрация нарядов выездных бригад
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setGeneratorOpen(true)}
            className="gap-2 border-primary/40 text-primary hover:bg-primary/5"
            title="Сгенерировать пакет реалистичных нарядов на выбранную дату"
          >
            <Wand2 className="h-4 w-4" />
            Сгенерировать наряды
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Создать наряд
          </Button>
          <Button variant="outline" size="icon" onClick={() => refetch()} title="Обновить">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg">
                Список нарядов ({filteredOrders.length})
              </CardTitle>
              {selectedServiceCenterId && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <span>
                    СЦ: {serviceCenters.find((s: any) => s.id === selectedServiceCenterId || s.code === selectedServiceCenterId)?.code || selectedServiceCenterId}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedServiceCenterId(null)}
                    className="ml-1 hover:text-destructive font-bold"
                    title="Сбросить фильтр по сервисному центру"
                  >
                    ×
                  </button>
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Поиск по коду/адресу..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-48 pl-8 pr-3 py-1.5 text-xs rounded-md border border-input bg-background"
                />
              </div>

              {/* Status filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] h-9 text-xs">
                  <SelectValue placeholder="Статус" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Все статусы</SelectItem>
                  <SelectItem value="PENDING">PENDING</SelectItem>
                  <SelectItem value="ASSIGNED">ASSIGNED</SelectItem>
                  <SelectItem value="COMPLETED">COMPLETED</SelectItem>
                  <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                  <SelectItem value="UNASSIGNED">UNASSIGNED</SelectItem>
                </SelectContent>
              </Select>

              {/* Date toggle button */}
              <Button
                variant={filterAllDates ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setFilterAllDates(!filterAllDates)}
                className="text-xs h-9 gap-1"
                title="Переключить просмотр всех дат или только выбранного дня"
              >
                {filterAllDates ? 'Все даты' : 'Только день'}
              </Button>

              {/* Bulk delete button */}
              {selectedOrderIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  className="gap-1.5"
                  disabled={deleteOrder.isPending}
                >
                  {deleteOrder.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Удаление...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5" />
                      Удалить выбранные ({selectedOrderIds.size})
                    </>
                  )}
                </Button>
              )}

              {/* Date picker */}
              {!filterAllDates && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <input
                    type="date"
                    value={currentDate}
                    onChange={(e) => e.target.value && setCurrentDate(e.target.value)}
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs font-medium"
                  />
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm space-y-3">
              <p>Наряды не найдены по текущим фильтрам{filterAllDates ? '' : ` на дату ${currentDate}`}.</p>
              <div className="flex items-center justify-center gap-2">
                {(selectedServiceCenterId || search || statusFilter !== 'ALL' || !filterAllDates) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch('')
                      setStatusFilter('ALL')
                      setSelectedServiceCenterId(null)
                      setFilterAllDates(true)
                    }}
                  >
                    Сбросить все фильтры
                  </Button>
                )}
                <Button size="sm" onClick={() => setGeneratorOpen(true)}>
                  Сгенерировать наряды
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        title="Выбрать все наряды на текущей странице"
                      />
                    </TableHead>
                    <TableHead>Код наряда</TableHead>
                    <TableHead>Адрес объекта</TableHead>
                    <TableHead>Тип работ</TableHead>
                    <TableHead>Временной слот</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Оборудование (АО)</TableHead>
                    <TableHead className="text-right">Инфо</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order: any) => {
                    const bldId = order.building_id || order.buildingId
                    const bld = buildingMap.get(bldId)
                    const wtId = order.work_type_id || order.workTypeId
                    const wt = workTypeMap.get(wtId)

                    const code = order.order_id || order.code || order.orderId || '—'
                    const address = order.address || bld?.address || bldId || '—'
                    const bldCode = order.building_code || bld?.code || ''
                    const wtName = order.work_type_name || wt?.name || wt?.code || wtId || '—'
                    const slotStart = order.slot_start || order.slotStart
                    const slotEnd = order.slot_end || order.slotEnd
                    const reqEq = order.required_equipment || order.requiredEquipment || {}
                    const ont = reqEq.ONT ?? reqEq.ont ?? order.required_ont ?? order.requiredOnt ?? 0
                    const router = reqEq.ROUTER ?? reqEq.router ?? order.required_router ?? order.requiredRouter ?? 0
                    const stb = reqEq.STB ?? reqEq.stb ?? order.required_stb ?? order.requiredStb ?? 0
                    const isGenerated = order.is_generated ?? order.isGenerated ?? false

                    return (
                      <TableRow key={order.id || code}>
                        <TableCell className="w-12 text-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                            checked={selectedOrderIds.has(order.id)}
                            onChange={() => toggleOrderSelection(order.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono font-semibold text-primary">
                          {code}
                          {isGenerated && (
                            <Badge variant="secondary" className="ml-1.5 text-[10px] h-4">
                              <Sparkles className="h-3 w-3 mr-0.5" />
                              Сгенер.
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[240px]">
                          <p className="truncate font-medium">{address}</p>
                          {bldCode && (
                            <span className="text-[11px] text-muted-foreground font-mono">
                              {bldCode}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {wtName}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {formatClock(slotStart, '—')} –{' '}
                          {formatClock(slotEnd, '—')}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              order.status === 'ASSIGNED'
                                ? 'default'
                                : order.status === 'COMPLETED'
                                ? 'success'
                                : order.status === 'CANCELLED'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {order.status || 'PENDING'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          ONT:{ont} RT:{router} STB:{stb}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(order)}
                            title="Редактировать"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setViewOrder({
                                ...order,
                                code,
                                address,
                                wtName,
                                slotStart,
                                slotEnd,
                                ont,
                                router,
                                stb,
                              })
                            }
                            title="Просмотр"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Create Order */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl w-full max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Plus className="h-5 w-5 text-primary" />
              Создание нового наряда
            </DialogTitle>
          </DialogHeader>

          {formError && (
            <div className="p-3 text-xs bg-destructive/10 text-destructive rounded-lg flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="orderId" className="text-xs font-semibold">
                    Код наряда
                  </Label>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground font-normal">
                    Автогенерация
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5">
                  <Input
                    id="orderId"
                    readOnly
                    className="font-mono text-sm bg-muted/70 text-foreground cursor-not-allowed font-medium select-all border-dashed"
                    {...form.register('orderId')}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0 h-9 w-9"
                    onClick={() => form.setValue('orderId', generateOrderId(form.watch('dayId') || currentDate))}
                    title="Сгенерировать новый уникальный номер"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Формат по регламенту: ORD-YYYYMMDD-XXXX
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dayId" className="text-xs font-semibold flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  Дата наряда
                </Label>
                <Input
                  id="dayId"
                  type="date"
                  value={form.watch('dayId')}
                  onChange={(e) => handleDateChange(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Дата выезда бригады и обслуживания
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="workTypeId" className="text-xs font-semibold">Тип работ</Label>
                <Select
                  value={form.watch('workTypeId')}
                  onValueChange={(val) => form.setValue('workTypeId', val, { shouldValidate: true })}
                >
                  <SelectTrigger id="workTypeId">
                    <SelectValue placeholder="Выберите тип работ" />
                  </SelectTrigger>
                  <SelectContent>
                    {workTypes.map((wt: any) => (
                      <SelectItem key={wt.id} value={wt.id}>
                        {wt.name} ({wt.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.workTypeId && (
                  <p className="text-xs text-destructive">{form.formState.errors.workTypeId.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="buildingId" className="text-xs font-semibold flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  Здание / Адрес объекта
                </Label>
                <Select
                  value={form.watch('buildingId')}
                  onValueChange={(val) => form.setValue('buildingId', val, { shouldValidate: true })}
                >
                  <SelectTrigger id="buildingId">
                    <SelectValue placeholder="Выберите здание" />
                  </SelectTrigger>
                  <SelectContent>
                    {buildings.slice(0, 100).map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.address} ({b.building_id || b.code || 'МКД'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.buildingId && (
                  <p className="text-xs text-destructive">{form.formState.errors.buildingId.message}</p>
                )}
              </div>
            </div>

            {/* Customer Time Slot Selection */}
            <div className="p-3.5 rounded-xl border bg-muted/30 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-primary" />
                  Согласованный клиентский слот (2-часовое окно)
                </Label>
                <Badge variant="outline" className="font-mono text-[11px] bg-background">
                  {slotTimeStart} – {slotTimeEnd}
                </Badge>
              </div>

              {/* Quick Preset Buttons */}
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground">Быстрый выбор типового окна:</span>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {PRESET_SLOTS.map((slot) => {
                    const isSelected = slotTimeStart === slot.start && slotTimeEnd === slot.end
                    return (
                      <Button
                        key={slot.label}
                        type="button"
                        variant={isSelected ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleApplySlot(slot.start, slot.end)}
                        className="text-[11px] h-8 px-1 font-mono"
                      >
                        {slot.label}
                      </Button>
                    )
                  })}
                </div>
              </div>

              {/* Custom Time Pickers */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label htmlFor="customStart" className="text-[11px] text-muted-foreground">Время начала слота</Label>
                  <Input
                    id="customStart"
                    type="time"
                    value={slotTimeStart}
                    onChange={(e) => {
                      const newStart = e.target.value
                      setSlotTimeStart(newStart)
                      const [h, m] = newStart.split(':').map(Number)
                      const endH = String(Math.min(23, (h || 0) + 2)).padStart(2, '0')
                      const newEnd = `${endH}:${String(m || 0).padStart(2, '0')}`
                      setSlotTimeEnd(newEnd)
                      handleApplySlot(newStart, newEnd)
                    }}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="customEnd" className="text-[11px] text-muted-foreground">Время окончания слота</Label>
                  <Input
                    id="customEnd"
                    type="time"
                    value={slotTimeEnd}
                    onChange={(e) => {
                      const newEnd = e.target.value
                      setSlotTimeEnd(newEnd)
                      handleApplySlot(slotTimeStart, newEnd)
                    }}
                    className="bg-background"
                  />
                </div>
              </div>
            </div>

            {/* Equipment requirements */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Требуемое абонентское оборудование (шт.)</Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-2.5 rounded-lg border bg-muted/20 space-y-1">
                  <Label htmlFor="ont" className="text-xs text-muted-foreground">ONT (Оптика)</Label>
                  <Input id="ont" type="number" min="0" max="10" className="bg-background" {...form.register('requiredEquipmentOnt')} />
                </div>
                <div className="p-2.5 rounded-lg border bg-muted/20 space-y-1">
                  <Label htmlFor="router" className="text-xs text-muted-foreground">Роутер / Wi-Fi</Label>
                  <Input id="router" type="number" min="0" max="10" className="bg-background" {...form.register('requiredEquipmentRouter')} />
                </div>
                <div className="p-2.5 rounded-lg border bg-muted/20 space-y-1">
                  <Label htmlFor="stb" className="text-xs text-muted-foreground">Приставка (STB)</Label>
                  <Input id="stb" type="number" min="0" max="10" className="bg-background" {...form.register('requiredEquipmentStb')} />
                </div>
              </div>
            </div>

            {/* Repeat order checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <input
                id="isRepeat"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                {...form.register('isRepeat')}
              />
              <Label htmlFor="isRepeat" className="text-xs cursor-pointer">
                Повторное обращение абонента в течение 7 дней (повышенный приоритет)
              </Label>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={createOrder.isPending} className="gap-2">
                {createOrder.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Создание...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Создать наряд
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Test Orders Batch Generator */}
      <TestOrdersGeneratorModal
        open={generatorOpen}
        onOpenChange={setGeneratorOpen}
        targetDate={currentDate}
        onSuccess={() => refetch()}
      />

      {/* Modal: View Order Details */}
      {viewOrder && (
        <Dialog open={!!viewOrder} onOpenChange={() => setViewOrder(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span>Наряд {viewOrder.code || viewOrder.order_id || viewOrder.orderId}</span>
                <Badge>{viewOrder.status || 'PENDING'}</Badge>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm py-2">
              <div>
                <span className="text-muted-foreground text-xs">Адрес объекта:</span>
                <p className="font-semibold">{viewOrder.address || viewOrder.building?.address || viewOrder.building_id || viewOrder.buildingId}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Тип работ:</span>
                <p className="font-medium">{viewOrder.wtName || viewOrder.work_type_name || viewOrder.workType?.name || viewOrder.work_type_id || viewOrder.workTypeId}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 p-2.5 rounded-lg">
                <div>
                  <span className="text-muted-foreground block mb-0.5">Слот клиента:</span>
                  <p className="font-mono font-medium">
                    {formatClock(viewOrder.slotStart || viewOrder.slot_start, '—')} –{' '}
                    {formatClock(viewOrder.slotEnd || viewOrder.slot_end, '—')}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Требуемое АО:</span>
                  <p className="font-mono font-medium">
                    ONT: {viewOrder.ont ?? viewOrder.required_ont ?? viewOrder.requiredOnt ?? 0}, RTR:{' '}
                    {viewOrder.router ?? viewOrder.required_router ?? viewOrder.requiredRouter ?? 0}, STB:{' '}
                    {viewOrder.stb ?? viewOrder.required_stb ?? viewOrder.requiredStb ?? 0}
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setViewOrder(null)}>Закрыть</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
