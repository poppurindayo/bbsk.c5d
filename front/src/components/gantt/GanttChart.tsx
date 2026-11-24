import { useMemo, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Clock, Package, Wrench, Coffee, ArrowLeftRight, MapPin, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Route, RouteStop } from '@/types/api'

// ─── Color system per stop type ───────────────────────────────────────────────
const STOP_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  DEPOT_START: { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-800', label: 'Старт' },
  VISIT: { bg: 'bg-emerald-100', border: 'border-emerald-400', text: 'text-emerald-800', label: 'Визит' },
  BREAK: { bg: 'bg-amber-100', border: 'border-amber-400', text: 'text-amber-800', label: 'Обед' },
  RESTOCK: { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-800', label: 'Склад' },
  DEPOT_END: { bg: 'bg-gray-200', border: 'border-gray-400', text: 'text-gray-700', label: 'Финиш' },
}

const ROUTE_COLORS = [
  'border-l-blue-500',
  'border-l-emerald-500',
  'border-l-violet-500',
  'border-l-amber-500',
  'border-l-rose-500',
  'border-l-cyan-500',
  'border-l-indigo-500',
  'border-l-teal-500',
  'border-l-orange-500',
  'border-l-pink-500',
]

interface GanttChartProps {
  routes: Route[]
  /** Model "now" time from the day, e.g. "2026-10-26T08:00:00+05:00" or "08:00" */
  modelNow?: string
  className?: string
}

interface TimeRange {
  minHour: number
  maxHour: number
  totalMinutes: number
}

function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0
  const part = timeStr.includes('T') ? timeStr.split('T')[1] : timeStr
  const [h, m] = part.substring(0, 5).split(':').map(Number)
  return h * 60 + m
}

function formatMinutesToTime(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function buildTimeRange(routes: Route[]): TimeRange {
  let minMin = 8 * 60
  let maxMin = 23 * 60

  for (const route of routes) {
    for (const stop of route.stops || []) {
      const arr = stop.arrival ? parseTimeToMinutes(stop.arrival) : 0
      const end = stop.endTime ? parseTimeToMinutes(stop.endTime) : arr
      if (arr > 0 && arr < minMin) minMin = Math.floor(arr / 60) * 60
      if (end > maxMin) maxMin = Math.ceil(end / 60) * 60
    }
  }

  minMin = Math.max(0, minMin - 30)
  maxMin = Math.min(24 * 60, maxMin + 30)

  return { minHour: minMin / 60, maxHour: maxMin / 60, totalMinutes: maxMin - minMin }
}

const StopIcon = ({ type, className }: { type: string; className?: string }) => {
  switch (type) {
    case 'VISIT':
      return <Wrench className={className || 'h-3 w-3'} />
    case 'BREAK':
      return <Coffee className={className || 'h-3 w-3'} />
    case 'RESTOCK':
      return <Package className={className || 'h-3 w-3'} />
    case 'DEPOT_START':
    case 'DEPOT_END':
      return <MapPin className={className || 'h-3 w-3'} />
    default:
      return <Clock className={className || 'h-3 w-3'} />
  }
}

interface HoveredBar {
  routeId: string
  stopSeq: number
  startMin: number
  endMin: number
}

export function GanttChart({ routes, modelNow, className }: GanttChartProps) {
  const [zoom, setZoom] = useState<number>(1)
  const [scrollOffset, setScrollOffset] = useState<number>(0)
  const [hoveredBar, setHoveredBar] = useState<HoveredBar | null>(null)

  const timeRange = useMemo(() => buildTimeRange(routes), [routes])

  const nowMin = useMemo(() => {
    if (!modelNow) return 0
    return parseTimeToMinutes(modelNow)
  }, [modelNow])

  const pxPerMin = useMemo(() => {
    const base = 900 / timeRange.totalMinutes
    return base * zoom
  }, [timeRange.totalMinutes, zoom])

  const totalWidth = useMemo(() => timeRange.totalMinutes * pxPerMin, [timeRange.totalMinutes, pxPerMin])

  const hourMarks = useMemo(() => {
    const marks: number[] = []
    const startHour = Math.ceil(timeRange.minHour)
    const endHour = Math.floor(timeRange.maxHour)
    for (let h = startHour; h <= endHour; h++) marks.push(h)
    return marks
  }, [timeRange.minHour, timeRange.maxHour])

  const labelWidth = 200
  const ROW_HEIGHT = 52
  const BAR_HEIGHT = 30
  const BAR_TOP = (ROW_HEIGHT - BAR_HEIGHT) / 2

  const scrollBy = useCallback(
    (dir: 'left' | 'right') => {
      const step = 200
      setScrollOffset((prev) => {
        const max = Math.max(0, totalWidth - 700)
        if (dir === 'left') return Math.max(0, prev - step)
        return Math.min(max, prev + step)
      })
    },
    [totalWidth]
  )

  const handleBarEnter = useCallback((routeId: string, stopSeq: number, startMin: number, endMin: number) => {
    setHoveredBar({ routeId, stopSeq, startMin, endMin })
  }, [])

  if (!routes.length) {
    return (
      <Card className={className}>
        <CardContent className="py-12 text-center space-y-2">
          <Clock className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground text-sm">Нет маршрутов для отображения на диаграмме Ганта.</p>
          <p className="text-muted-foreground text-xs">Рассчитайте план, чтобы увидеть расписание бригад.</p>
        </CardContent>
      </Card>
    )
  }

  const nowLeft = labelWidth + (nowMin - timeRange.minHour * 60) * pxPerMin - scrollOffset
  const showNowLine = nowMin >= timeRange.minHour * 60 && nowMin <= timeRange.maxHour * 60

  // Precompute hovered stop data outside the render loop
  let hoveredStop: RouteStop | null = null
  if (hoveredBar) {
    const r = routes.find((rt) => rt.routeId === hoveredBar.routeId)
    if (r) hoveredStop = (r.stops || []).find((s) => s.seq === hoveredBar.stopSeq) || null
  }

  return (
    <Card className={className}>
      <CardContent className="p-4 space-y-3">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Диаграмма Ганта — расписание бригад</span>
            <span className="text-xs text-muted-foreground">
              {formatMinutesToTime(timeRange.minHour * 60)} – {formatMinutesToTime(timeRange.maxHour * 60)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => scrollBy('left')}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => scrollBy('right')}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <span className="mx-1 text-border">|</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setZoom(1)
                setScrollOffset(0)
              }}
            >
              Сброс
            </Button>
            <Button
              variant={zoom >= 2.5 ? 'secondary' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setZoom((z) => Math.min(3, z + 0.5))}
              disabled={zoom >= 3}
            >
              +
            </Button>
            <Button
              variant={zoom <= 0.5 ? 'secondary' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.5))}
              disabled={zoom <= 0.5}
            >
              −
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground border-b pb-2">
          {Object.entries(STOP_COLORS).map(([type, cfg]) => (
            <div key={type} className="flex items-center gap-1">
              <div className={`w-3 h-3 rounded-sm border ${cfg.bg} ${cfg.border}`} />
              <span>{cfg.label}</span>
            </div>
          ))}
          {showNowLine && (
            <div className="flex items-center gap-1">
              <div className="w-px h-3 bg-red-400" />
              <span>Текущее время ({formatMinutesToTime(nowMin)})</span>
            </div>
          )}
        </div>

        {/* ── Gantt area ── */}
        <div className="overflow-x-auto rounded-lg border bg-background">
          {/* Time header */}
          <div
            className="bg-background border-b flex"
            style={{ minWidth: labelWidth + totalWidth }}
          >
            <div
              className="shrink-0 bg-muted/40 border-r px-3 py-1.5 text-[10px] font-semibold text-muted-foreground flex items-center"
              style={{ width: labelWidth }}
            >
              Бригада / Инженер
            </div>
            <div className="relative flex-1" style={{ width: totalWidth }}>
              {hourMarks.map((h) => {
                const left = (h * 60 - timeRange.minHour * 60) * pxPerMin - scrollOffset
                return (
                  <div
                    key={h}
                    className="absolute top-0 bottom-0 border-l border-border/60 text-[9px] text-muted-foreground pl-1 pt-1 pointer-events-none"
                    style={{ left }}
                  >
                    {String(h).padStart(2, '0')}:00
                  </div>
                )
              })}
            </div>
          </div>

          {/* Route rows */}
          <div className="relative" style={{ minWidth: labelWidth + totalWidth }}>
            {/* Background hour grid lines */}
            <div className="absolute inset-0 pointer-events-none" style={{ left: labelWidth }}>
              {hourMarks.map((h) => {
                const left = (h * 60 - timeRange.minHour * 60) * pxPerMin - scrollOffset
                return (
                  <div
                    key={`grid-${h}`}
                    className="absolute top-0 bottom-0 border-l border-border/30"
                    style={{ left }}
                  />
                )
              })}
            </div>

            {/* Vertical "now" line — single instance across all rows */}
            {showNowLine && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10 pointer-events-none"
                style={{ left: nowLeft, opacity: 0.75 }}
              >
                <div className="absolute -top-0 left-1 bg-red-400 text-white text-[8px] px-1 py-0.5 rounded-sm font-mono whitespace-nowrap">
                  now
                </div>
              </div>
            )}

            {routes.map((route, idx) => {
              const routeColor = ROUTE_COLORS[idx % ROUTE_COLORS.length]

              return (
                <div
                  key={route.routeId}
                  className={`flex border-b last:border-b-0 border-l-4 ${routeColor} hover:bg-muted/5 transition-colors`}
                  style={{ height: ROW_HEIGHT }}
                >
                  {/* Left label — fixed */}
                  <div
                    className="shrink-0 bg-muted/20 border-r px-3 flex flex-col justify-center gap-0.5 overflow-hidden"
                    style={{ width: labelWidth }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold truncate max-w-full">{route.staffName || route.staffCode}</span>
                      {route.staffCode && (
                        <span className="text-[8px] font-mono text-muted-foreground shrink-0">({route.staffCode})</span>
                      )}
                    </div>
                    {route.serviceCenterCode && (
                      <span className="text-[9px] text-muted-foreground truncate max-w-full">{route.serviceCenterCode}</span>
                    )}
                    <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                      <span>{route.totalOrders} наряд.</span>
                      <span>·</span>
                      <span>{Math.round(route.totalTravelSec / 60)} мин</span>
                    </div>
                  </div>

                  {/* Timeline bar area */}
                  <div
                    className="relative flex-1 overflow-hidden"
                    style={{ width: totalWidth }}
                  >
                    {/* Scrolling inner content */}
                    <div
                      className="absolute inset-0"
                      style={{ width: totalWidth, transform: `translateX(-${scrollOffset}px)` }}
                    >
                      {(route.stops || []).map((stop) => {
                        const arrivalMin = stop.arrival ? parseTimeToMinutes(stop.arrival) : 0
                        const endTimeMin = stop.endTime ? parseTimeToMinutes(stop.endTime) : arrivalMin
                        const startMin = stop.startTime ? parseTimeToMinutes(stop.startTime) : arrivalMin

                        if (!arrivalMin && !startMin) return null

                        const left = (startMin - timeRange.minHour * 60) * pxPerMin
                        const width = Math.max(8, (endTimeMin - startMin) * pxPerMin)
                        const cfg = STOP_COLORS[stop.type] || STOP_COLORS.VISIT

                        const isHovered =
                          hoveredBar?.routeId === route.routeId && hoveredBar?.stopSeq === stop.seq

                        // Show icon when bar is wide enough
                        const showIcon = width >= 22

                        return (
                          <div
                            key={`${route.routeId}-${stop.seq}`}
                            className={`absolute flex items-center justify-center rounded border cursor-pointer transition-all duration-150 overflow-hidden ${cfg.bg} ${cfg.border} ${
                              isHovered ? 'ring-2 ring-primary shadow-md z-20' : 'z-10'
                            }`}
                            style={{ left, width, top: BAR_TOP, height: BAR_HEIGHT, minWidth: 8 }}
                            onMouseEnter={() =>
                              handleBarEnter(route.routeId, stop.seq, startMin, endTimeMin)
                            }
                            onMouseLeave={() => setHoveredBar(null)}
                            title={`${cfg.label} · ${stop.locationCode || ''} ${stop.orderId ? `· ${stop.orderId}` : ''}`}
                          >
                            {showIcon && (
                              <StopIcon
                                type={stop.type}
                                className={`h-3 w-3 shrink-0 ${cfg.text}`}
                              />
                            )}
                          </div>
                        )
                      })}

                      {/* Tooltip — rendered INSIDE the inner scrolling div, only on the hovered route's row */}
                      {hoveredBar?.routeId === route.routeId && hoveredStop && (() => {
                        const arr = hoveredStop.arrival ? parseTimeToMinutes(hoveredStop.arrival) : 0
                        const end = hoveredStop.endTime ? parseTimeToMinutes(hoveredStop.endTime) : 0
                        const trav = hoveredStop.travelSec || 0
                        const duration = end - arr
                        const cfg = STOP_COLORS[hoveredStop.type] || STOP_COLORS.VISIT
                        const tooltipBarLeft = (arr - timeRange.minHour * 60) * pxPerMin
                        const tooltipBarWidth = Math.max(8, (end - arr) * pxPerMin)

                        return (
                          <div
                            className={`absolute z-40 pointer-events-none ${cfg.bg} ${cfg.border} border rounded-md shadow-lg px-2.5 py-1.5 text-[10px]`}
                            style={{
                              left: tooltipBarLeft + tooltipBarWidth / 2,
                              top: -8,
                              transform: 'translateX(-50%) translateY(-100%)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <div className="flex items-center gap-1.5">
                              <StopIcon type={hoveredStop.type} className="h-3 w-3 shrink-0" />
                              <span className="font-bold">{cfg.label}</span>
                              {hoveredStop.orderId && (
                                <span className="font-mono font-semibold">{hoveredStop.orderId}</span>
                              )}
                              {hoveredStop.locationCode && (
                                <span className="opacity-70">({hoveredStop.locationCode})</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[9px] opacity-80">
                              <span className="font-mono">
                                {formatMinutesToTime(arr)}–{formatMinutesToTime(end)}
                              </span>
                              {duration > 0 && <span>{duration} мин</span>}
                              {trav > 0 && <span>в пути: {Math.round(trav / 60)} мин</span>}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}