import { useState, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { MapPin, Users, Building2, Navigation, Layers, RefreshCw, Loader2, ChevronRight, Eye, EyeOff } from 'lucide-react'
import { usePlan, useServiceCenters, useBuildings, useAccessNodes } from '@/hooks/useApi'
import { useDayStore } from '@/store/dayStore'
import { RouteMap, ROUTE_COLORS } from '@/components/map/RouteMap'
import { formatClock } from '@/utils/time'

export const MapViewPage = () => {
  const { currentDate, setCurrentDate, selectedServiceCenterId, setSelectedServiceCenterId } = useDayStore()
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [showAccessNodes, setShowAccessNodes] = useState(false)
  const [showUnassigned, setShowUnassigned] = useState(true)

  const { data: plan, isLoading: planLoading, refetch: refetchPlan } = usePlan(currentDate)
  const { data: serviceCenters = [] } = useServiceCenters()
  const { data: buildings = [] } = useBuildings()
  const { data: accessNodes = [] } = useAccessNodes()

  // Filter routes by selected Service Center if one is selected in header
  const filteredRoutes = useMemo(() => {
    if (!plan?.routes) return []
    if (!selectedServiceCenterId) return plan.routes

    // Find SC code
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

  const selectedRoute = useMemo(() => {
    return filteredRoutes.find((r: any) => (r.routeId || r.route_id) === selectedRouteId) || null
  }, [filteredRoutes, selectedRouteId])

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            Карта маршрутов выездных бригад
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Интерактивная карта OpenStreetMap с маршрутами бригад, нарядами и сервисными центрами
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={currentDate}
            onChange={(e) => e.target.value && setCurrentDate(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchPlan()}
            disabled={planLoading}
            title="Обновить данные плана"
          >
            <RefreshCw className={`h-4 w-4 ${planLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Main Grid: Map (left/center) + Sidebar with Brigade List & Details (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Map Area */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          {/* Map Controls Ribbon */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg border bg-card text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">Маршрутов:</span>
              <Badge variant="secondary">{filteredRoutes.length}</Badge>
              {selectedServiceCenterId && (
                <Badge variant="outline" className="gap-1 bg-background text-xs">
                  <span>
                    СЦ:{' '}
                    {serviceCenters.find(
                      (s: any) =>
                        s.id === selectedServiceCenterId ||
                        s.service_center_id === selectedServiceCenterId
                    )?.service_center_id || selectedServiceCenterId}
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
              {selectedRoute && (
                <div className="flex items-center gap-1.5 ml-2">
                  <span className="text-muted-foreground">Выбран:</span>
                  <Badge className="bg-primary">{selectedRoute.staffCode}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-[11px]"
                    onClick={() => setSelectedRouteId(null)}
                  >
                    Сбросить
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={showAccessNodes ? 'secondary' : 'outline'}
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setShowAccessNodes(!showAccessNodes)}
              >
                📡 Узлы связи
              </Button>
              <Button
                variant={showUnassigned ? 'secondary' : 'outline'}
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setShowUnassigned(!showUnassigned)}
              >
                ⚠️ Нераспределенные
              </Button>
            </div>
          </div>

          {/* Leaflet OSM Map */}
          <RouteMap
            routes={filteredRoutes}
            selectedRouteId={selectedRouteId}
            onSelectRoute={setSelectedRouteId}
            serviceCenters={serviceCenters}
            buildings={buildings}
            accessNodes={accessNodes}
            unassignedOrders={plan?.unassignedOrders || []}
            showAccessNodes={showAccessNodes}
            showUnassignedOrders={showUnassigned}
            className="h-[640px] w-full rounded-lg border shadow"
          />
        </div>

        {/* Right Info & Routes Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="h-[710px] flex flex-col">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Список бригад ({filteredRoutes.length})</span>
                {plan?.metrics && (
                  <span className="text-xs font-normal text-muted-foreground">
                    Всего нарядов: {plan.metrics.assignedOrders ?? plan.metrics.assigned_orders ?? 0} / {plan.metrics.totalOrders ?? plan.metrics.total_orders ?? 0}
                  </span>
                )}
              </CardTitle>
            </CardHeader>

            <CardContent className="p-3 flex-1 overflow-y-auto space-y-2">
              {planLoading && (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}

              {!planLoading && filteredRoutes.length === 0 && (
                <div className="text-center py-12 text-muted-foreground text-sm space-y-3">
                  <p>
                    {plan?.routes && plan.routes.length > 0
                      ? 'Маршруты скрыты фильтром по сервисному центру.'
                      : `На дату ${currentDate} маршруты не найдены.`}
                  </p>
                  {selectedServiceCenterId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedServiceCenterId(null)}
                    >
                      Показать все сервисные центры
                    </Button>
                  )}
                  {(!plan?.routes || plan.routes.length === 0) && (
                    <p className="text-xs">Постройте план во вкладке «План на день».</p>
                  )}
                </div>
              )}

              {filteredRoutes.map((route: any, idx: number) => {
                const color = ROUTE_COLORS[idx % ROUTE_COLORS.length]
                const isSelected = selectedRouteId === route.routeId

                return (
                  <div
                    key={route.routeId}
                    onClick={() => setSelectedRouteId(isSelected ? null : route.routeId)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary'
                        : 'hover:bg-accent/50 border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3.5 w-3.5 rounded-full inline-block flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-semibold text-sm">
                          {route.staffCode}
                        </span>
                        <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                          {route.staffName}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {route.serviceCenterCode}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-1 text-[11px] text-muted-foreground mt-2 bg-muted/40 p-1.5 rounded">
                      <div>
                        <span>Наряды: </span>
                        <strong className="text-foreground">{route.totalOrders}</strong>
                      </div>
                      <div>
                        <span>В пути: </span>
                        <strong className="text-foreground">{Math.round(route.totalTravelSec / 60)} мин</strong>
                      </div>
                      <div>
                        <span>Остановок: </span>
                        <strong className="text-foreground">{route.stops.length}</strong>
                      </div>
                    </div>

                    {/* Expand stop list if selected */}
                    {isSelected && (
                      <div className="mt-3 pt-2 border-t space-y-1.5 text-xs">
                        <p className="font-semibold text-slate-700">Остановки бригады:</p>
                        <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                          {route.stops.map((stop: any) => (
                            <div
                              key={stop.seq}
                              className="flex items-center justify-between p-1.5 rounded bg-background border text-[11px]"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-muted-foreground">#{stop.seq}</span>
                                <Badge
                                  variant={stop.type === 'VISIT' ? 'default' : 'secondary'}
                                  className="text-[9px] px-1 py-0 h-4"
                                >
                                  {stop.type}
                                </Badge>
                                <span className="truncate max-w-[110px]" title={stop.locationCode}>
                                  {stop.orderId || stop.locationCode}
                                </span>
                              </div>
                              <span className="text-muted-foreground font-mono">
                                {formatClock(stop.arrival, '—')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
