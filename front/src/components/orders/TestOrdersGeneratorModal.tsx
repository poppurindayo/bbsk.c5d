import React, { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Sparkles, Loader2, CheckCircle2, AlertTriangle, RefreshCw, Calendar, ListPlus, Wand2 } from 'lucide-react'
import { useBuildings, useWorkTypes } from '@/hooks/useApi'
import { ordersApi } from '@/api/client'
import { useQueryClient } from '@tanstack/react-query'

interface TestOrdersGeneratorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetDate: string
  onSuccess?: () => void
}

interface GeneratedOrder {
  order_id: string
  work_type_id: string
  workTypeName: string
  building_id: string
  buildingAddress: string
  access_node_id?: string
  service_center_id?: string
  registered_at: string
  slot_start: string
  slot_end: string
  slotLabel: string
  required_ont: number
  required_router: number
  required_stb: number
  is_repeat: boolean
}

const STANDARD_SLOTS = [
  { start: '08:00', end: '10:00', label: '08:00 – 10:00 (Утро 1)' },
  { start: '10:00', end: '12:00', label: '10:00 – 12:00 (Утро 2)' },
  { start: '12:00', end: '14:00', label: '12:00 – 14:00 (День 1)' },
  { start: '14:00', end: '16:00', label: '14:00 – 16:00 (День 2)' },
  { start: '16:00', end: '18:00', label: '16:00 – 18:00 (Вечер 1)' },
  { start: '18:00', end: '20:00', label: '18:00 – 20:00 (Вечер 2)' },
]

export const TestOrdersGeneratorModal: React.FC<TestOrdersGeneratorModalProps> = ({
  open,
  onOpenChange,
  targetDate,
  onSuccess,
}) => {
  const [date, setDate] = useState<string>(targetDate || new Date().toISOString().split('T')[0])
  const [count, setCount] = useState<number>(10)
  const [repeatRatio, setRepeatRatio] = useState<number>(10) // percent
  const [previewOrders, setPreviewOrders] = useState<GeneratedOrder[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const queryClient = useQueryClient()
  const { data: buildings = [] } = useBuildings()
  const { data: workTypes = [] } = useWorkTypes()

  // Generate test orders batch based on available buildings and work types
  const handleGeneratePreview = () => {
    if (buildings.length === 0) {
      setResultMessage({
        type: 'error',
        text: 'В системе нет зданий. Сначала загрузите или создайте тестовые здания в справочнике.',
      })
      return
    }

    const cleanDate = date.replace(/-/g, '')
    const generated: GeneratedOrder[] = []

    // Distribute orders evenly across slots
    const slotsCount = STANDARD_SLOTS.length
    const ordersPerSlot = Math.ceil(count / slotsCount)
    let slotIndex = 0
    let slotUsage = 0

    for (let i = 1; i <= count; i++) {
      const orderNum = String(1000 + i).padStart(4, '0')
      const orderId = `ORD-${cleanDate}-${orderNum}`

      // Pick random building
      const bld = buildings[Math.floor(Math.random() * buildings.length)]
      // Pick random work type
      const wt = workTypes.length > 0 ? workTypes[Math.floor(Math.random() * workTypes.length)] : null

      // Pick slot - distribute evenly across all slots
      const slot = STANDARD_SLOTS[slotIndex]
      const slotStart = `${date}T${slot.start}:00+05:00`
      const slotEnd = `${date}T${slot.end}:00+05:00`
      const registeredAt = `${date}T08:00:00+05:00`

      slotUsage++
      if (slotUsage >= ordersPerSlot && slotIndex < slotsCount - 1) {
        slotIndex++
        slotUsage = 0
      }

      // Equipment requirements based on work type code or random
      let ont = 0
      let router = 0
      let stb = 0

      const wtCode = (wt?.code || '').toUpperCase()
      if (wtCode.includes('GPON') || wtCode.includes('PON')) {
        ont = 1
        router = 1
        if (Math.random() > 0.5) stb = 1
      } else if (wtCode.includes('FTTB') || wtCode.includes('INSTALL')) {
        router = 1
        if (Math.random() > 0.6) stb = 1
      } else if (wtCode.includes('REPAIR') || wtCode.includes('DEGRADATION')) {
        if (Math.random() > 0.7) router = 1
      } else {
        if (Math.random() > 0.5) router = 1
      }

      const isRepeat = Math.random() * 100 < repeatRatio

      generated.push({
        order_id: orderId,
        work_type_id: wt?.id || '',
        workTypeName: wt?.name || wt?.code || 'Монтаж/Обслуживание',
        building_id: bld.id,
        buildingAddress: bld.address || bld.code || bld.building_id || 'Здание',
        access_node_id: bld.access_node_id || bld.accessNodeId,
        service_center_id: bld.zone_service_center_id || bld.zoneServiceCenterId,
        registered_at: registeredAt,
        slot_start: slotStart,
        slot_end: slotEnd,
        slotLabel: `${slot.start} – ${slot.end}`,
        required_ont: ont,
        required_router: router,
        required_stb: stb,
        is_repeat: isRepeat,
      })
    }

    setPreviewOrders(generated)
    setResultMessage(null)
  }

  // Auto-generate preview on first open or date/count change if list is empty
  React.useEffect(() => {
    if (open && previewOrders.length === 0 && buildings.length > 0) {
      handleGeneratePreview()
    }
  }, [open, buildings.length])

  // Submit generated orders to backend
  const handleSubmitOrders = async () => {
    if (previewOrders.length === 0) return

    setIsSubmitting(true)
    setProgress({ current: 0, total: previewOrders.length })
    setResultMessage(null)

    let createdCount = 0
    let errorsCount = 0

    for (let i = 0; i < previewOrders.length; i++) {
      const ord = previewOrders[i]
      try {
        const payload = {
          order_id: ord.order_id,
          orderId: ord.order_id,
          day_date: date,
          dayDate: date,
          work_type_id: ord.work_type_id,
          workTypeId: ord.work_type_id,
          building_id: ord.building_id,
          buildingId: ord.building_id,
          access_node_id: ord.access_node_id || null,
          accessNodeId: ord.access_node_id || null,
          service_center_id: ord.service_center_id || null,
          serviceCenterId: ord.service_center_id || null,
          registered_at: ord.registered_at,
          registeredAt: ord.registered_at,
          slot_start: ord.slot_start,
          slotStart: ord.slot_start,
          slot_end: ord.slot_end,
          slotEnd: ord.slot_end,
          slot: {
            start: ord.slot_start,
            end: ord.slot_end,
          },
          required_ont: ord.required_ont,
          required_router: ord.required_router,
          required_stb: ord.required_stb,
          requiredEquipment: {
            ONT: ord.required_ont,
            ROUTER: ord.required_router,
            STB: ord.required_stb,
          },
          is_repeat: ord.is_repeat,
          isRepeat: ord.is_repeat,
        }

        await ordersApi.create(payload)
        createdCount++
      } catch (err: any) {
        // If already exists (409), count as warning or skip
        console.warn('Failed creating test order:', ord.order_id, err)
        errorsCount++
      }
      setProgress({ current: i + 1, total: previewOrders.length })
    }

    setIsSubmitting(false)
    queryClient.invalidateQueries({ queryKey: ['orders'] })
    queryClient.invalidateQueries({ queryKey: ['days'] })
    queryClient.invalidateQueries({ queryKey: ['plan'] })

    if (errorsCount === 0) {
      setResultMessage({
        type: 'success',
        text: `Успешно создано ${createdCount} тестовых нарядов на дату ${date}!`,
      })
      setTimeout(() => {
        onSuccess?.()
        onOpenChange(false)
      }, 1500)
    } else {
      setResultMessage({
        type: 'error',
        text: `Создано: ${createdCount}, ошибок/пропусков: ${errorsCount}. Проверьте список нарядов.`,
      })
      onSuccess?.()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Wand2 className="h-6 w-6 text-primary" />
              Генератор тестовых нарядов
            </DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGeneratePreview}
              className="text-xs gap-1.5"
              disabled={isSubmitting || buildings.length === 0}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Перегенерировать
            </Button>
          </div>
          <DialogDescription>
            Быстрая генерация реалистичного пакета заявок с распределением по 2-часовым клиентским слотам, зданиям и оборудованию.
          </DialogDescription>
        </DialogHeader>

        {resultMessage && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
              resultMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {resultMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            )}
            <span>{resultMessage.text}</span>
          </div>
        )}

        {/* Configuration Toolbar */}
        <div className="p-4 bg-muted/40 rounded-xl border grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Дата нарядов
            </Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Количество нарядов</Label>
              <span className="text-xs font-mono font-bold text-primary">{count} шт.</span>
            </div>
            <div className="flex items-center gap-1.5">
              {[5, 10, 20, 30].map((n) => (
                <Button
                  key={n}
                  type="button"
                  variant={count === n ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCount(n)}
                  className="h-8 flex-1 text-xs px-1"
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Повторные обращения</Label>
            <div className="flex items-center gap-1.5">
              {[0, 10, 25].map((pct) => (
                <Button
                  key={pct}
                  type="button"
                  variant={repeatRatio === pct ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setRepeatRatio(pct)}
                  className="h-8 flex-1 text-xs"
                >
                  {pct}%
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Buildings check info */}
        {buildings.length === 0 ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
            <div className="font-semibold flex items-center gap-1.5 mb-1">
              <AlertTriangle className="h-4 w-4" />
              В базе отсутствуют здания
            </div>
            <p className="text-xs">
              Для генерации заявок требуются здания. Перейдите во вкладку «Администрирование» и загрузите эталонную базу через «Мастер тестовых данных».
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Предпросмотр пакета ({previewOrders.length} заявок)
              </h4>
              <span className="text-xs text-muted-foreground">
                Доступно зданий в БД: {buildings.length}, типов работ: {workTypes.length}
              </span>
            </div>

            <div className="border rounded-lg max-h-[360px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[140px] text-xs">Код наряда</TableHead>
                    <TableHead className="text-xs">Тип работ</TableHead>
                    <TableHead className="text-xs">Адрес / Объект</TableHead>
                    <TableHead className="text-xs">Клиентский слот</TableHead>
                    <TableHead className="text-xs">Оборудование</TableHead>
                    <TableHead className="text-xs text-right">Повтор</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewOrders.map((ord) => (
                    <TableRow key={ord.order_id} className="text-xs">
                      <TableCell className="font-mono font-medium text-primary">
                        {ord.order_id}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate" title={ord.workTypeName}>
                        {ord.workTypeName}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={ord.buildingAddress}>
                        {ord.buildingAddress}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {ord.slotLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground">
                        {[
                          ord.required_ont > 0 ? `ONT: ${ord.required_ont}` : null,
                          ord.required_router > 0 ? `RTR: ${ord.required_router}` : null,
                          ord.required_stb > 0 ? `STB: ${ord.required_stb}` : null,
                        ]
                          .filter(Boolean)
                          .join(', ') || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {ord.is_repeat ? (
                          <Badge variant="destructive" className="text-[10px]">Повтор</Badge>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">Первичный</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Progress Bar during submit */}
        {progress && (
          <div className="space-y-1 py-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Создание нарядов...</span>
              <span>{progress.current} из {progress.total}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-2 transition-all duration-200"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Закрыть
          </Button>
          <Button
            type="button"
            onClick={handleSubmitOrders}
            disabled={isSubmitting || previewOrders.length === 0}
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Создание в БД ({progress?.current || 0}/{progress?.total || 0})...
              </>
            ) : (
              <>
                <ListPlus className="h-4 w-4" />
                Создать {previewOrders.length} нарядов в системе
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
