import React, { useMemo, useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Building2, Navigation, Layers, Clock, Package, AlertCircle } from 'lucide-react'
import type { Route, RouteStop, ServiceCenter, Building, AccessNode } from '@/types/api'
import { formatClock } from '@/utils/time'

// Palette for brigade routes
export const ROUTE_COLORS = [
  '#2563eb', // blue-600
  '#16a34a', // green-600
  '#9333ea', // purple-600
  '#ea580c', // orange-600
  '#e11d48', // rose-600
  '#0891b2', // cyan-600
  '#ca8a04', // yellow-600
  '#4f46e5', // indigo-600
  '#059669', // emerald-600
  '#db2777', // pink-600
]

const DEFAULT_CENTER: [number, number] = [56.8389, 60.6057] // Yekaterinburg city center
const DEFAULT_ZOOM = 12

// Custom DivIcons
export const createStopIcon = (color: string, label: string | number, isSelected = false) => {
  return L.divIcon({
    className: 'custom-stop-marker',
    html: `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: ${color};
        color: #ffffff;
        font-weight: 700;
        font-size: 11px;
        width: ${isSelected ? '30px' : '24px'};
        height: ${isSelected ? '30px' : '24px'};
        border-radius: 50%;
        border: ${isSelected ? '3px solid #facc15' : '2px solid #ffffff'};
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        cursor: pointer;
        transition: transform 0.15s ease;
      ">
        ${label}
      </div>
    `,
    iconSize: [isSelected ? 30 : 24, isSelected ? 30 : 24],
    iconAnchor: [isSelected ? 15 : 12, isSelected ? 15 : 12],
    popupAnchor: [0, isSelected ? -16 : -13],
  })
}

export const createDepotIcon = (isSelected = false) => {
  return L.divIcon({
    className: 'custom-depot-marker',
    html: `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #1e3a8a;
        color: #ffffff;
        font-size: 15px;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        border: ${isSelected ? '3px solid #facc15' : '2px solid #ffffff'};
        box-shadow: 0 3px 8px rgba(0,0,0,0.45);
        cursor: pointer;
      ">
        🏢
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  })
}

export const createNodeIcon = () => {
  return L.divIcon({
    className: 'custom-node-marker',
    html: `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #475569;
        color: #ffffff;
        font-size: 12px;
        width: 22px;
        height: 22px;
        border-radius: 4px;
        border: 1.5px solid #ffffff;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      ">
        📡
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
  })
}

export const createUnassignedOrderIcon = () => {
  return L.divIcon({
    className: 'custom-unassigned-marker',
    html: `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #dc2626;
        color: #ffffff;
        font-size: 12px;
        font-weight: bold;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        border: 2px solid #ffffff;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      ">
        !
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
  })
}

// Controller to auto-fit map view to route bounds
function FitBoundsController({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap()
  useEffect(() => {
    if (bounds) {
      try {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
      } catch {
        // ignore bounds calculation edge cases
      }
    }
  }, [bounds, map])
  return null
}

interface RouteMapProps {
  routes?: Route[]
  selectedRouteId?: string | null
  onSelectRoute?: (routeId: string | null) => void
  serviceCenters?: ServiceCenter[]
  buildings?: Building[]
  accessNodes?: AccessNode[]
  unassignedOrders?: any[]
  showAccessNodes?: boolean
  showUnassignedOrders?: boolean
  className?: string
}

export const RouteMap: React.FC<RouteMapProps> = ({
  routes = [],
  selectedRouteId = null,
  onSelectRoute,
  serviceCenters = [],
  buildings = [],
  accessNodes = [],
  unassignedOrders = [],
  showAccessNodes = false,
  showUnassignedOrders = true,
  className = 'h-[600px] w-full rounded-lg border shadow-sm overflow-hidden',
}) => {
  // Store real road polylines from OSRM
  const [roadGeometries, setRoadGeometries] = useState<Record<string, [number, number][]>>({})

  // Build fast lookups by code and id
  const locationLookup = useMemo(() => {
    const map = new Map<string, { lat: number; lon: number; address: string; name?: string; type: 'SC' | 'BLD' | 'NODE' }>()

    serviceCenters.forEach((sc: any) => {
      const code = sc.service_center_id || sc.code
      if (sc.lat && sc.lon) {
        if (code) map.set(code, { lat: sc.lat, lon: sc.lon, address: sc.address, name: sc.name, type: 'SC' })
        map.set(sc.id, { lat: sc.lat, lon: sc.lon, address: sc.address, name: sc.name, type: 'SC' })
      }
    })

    buildings.forEach((bld: any) => {
      const code = bld.building_id || bld.code
      if (bld.lat && bld.lon) {
        if (code) map.set(code, { lat: bld.lat, lon: bld.lon, address: bld.address, type: 'BLD' })
        map.set(bld.id, { lat: bld.lat, lon: bld.lon, address: bld.address, type: 'BLD' })
      }
    })

    accessNodes.forEach((node: any) => {
      const code = node.access_node_id || node.code
      if (node.lat && node.lon) {
        if (code) map.set(code, { lat: node.lat, lon: node.lon, address: node.address, name: node.name, type: 'NODE' })
        map.set(node.id, { lat: node.lat, lon: node.lon, address: node.address, name: node.name, type: 'NODE' })
      }
    })

    return map
  }, [serviceCenters, buildings, accessNodes])

  // Prepared brigade routes with coordinates
  const processedRoutes = useMemo(() => {
    return routes.map((route, idx) => {
      const color = ROUTE_COLORS[idx % ROUTE_COLORS.length]
      const routeId = (route as any).route_id || route.routeId || (route as any).id
      const isSelected = selectedRouteId === routeId

      const stopsWithCoords = (route.stops || [])
        .map((stop: any) => {
          const locCode = stop.locationCode || stop.location_code
          const loc = locCode ? locationLookup.get(locCode) : undefined
          return {
            ...stop,
            locationCode: locCode,
            orderId: stop.orderCode || stop.order_code || stop.orderId || stop.order_id,
            lat: loc?.lat,
            lon: loc?.lon,
            address: loc?.address || locCode,
          }
        })
        .filter((s: any): s is RouteStop & { lat: number; lon: number; address: string } => !!s.lat && !!s.lon)

      const polylinePoints = stopsWithCoords.map((s) => [s.lat, s.lon] as [number, number])

      return {
        ...route,
        color,
        isSelected,
        stopsWithCoords,
        polylinePoints,
      }
    })
  }, [routes, selectedRouteId, locationLookup])

  // Fetch real road geometries from OSRM for each route
  useEffect(() => {
    let isMounted = true

    processedRoutes.forEach(async (route) => {
      const stops = route.stopsWithCoords
      if (stops.length < 2) return

      const coordsStr = stops.map((s) => `${s.lon},${s.lat}`).join(';')
      const url = `/osrm/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`

      try {
        let res: Response | null = null
        try {
          res = await fetch(url)
        } catch {
          res = await fetch(`http://localhost:5000/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`)
        }

        if (res && res.ok) {
          const data = await res.json()
          const coords = data?.routes?.[0]?.geometry?.coordinates
          if (Array.isArray(coords) && coords.length > 0 && isMounted) {
            const leafletPoints: [number, number][] = coords.map(([lon, lat]: [number, number]) => [lat, lon])
            setRoadGeometries((prev: Record<string, [number, number][]>) => ({
              ...prev,
              [route.routeId]: leafletPoints,
            }))
          }
        }
      } catch {
        // Fallback to straight lines
      }
    })

    return () => {
      isMounted = false
    }
  }, [processedRoutes])

  // Calculate bounding box for auto-fit
  const mapBounds = useMemo(() => {
    const latLngs: [number, number][] = []

    if (selectedRouteId) {
      const activeRoute = processedRoutes.find((r) => r.routeId === selectedRouteId)
      if (activeRoute && activeRoute.polylinePoints.length > 0) {
        return L.latLngBounds(activeRoute.polylinePoints)
      }
    }

    processedRoutes.forEach((r) => {
      latLngs.push(...r.polylinePoints)
    })

    serviceCenters.forEach((sc) => {
      if (sc.lat && sc.lon) latLngs.push([sc.lat, sc.lon])
    })

    if (latLngs.length > 0) {
      return L.latLngBounds(latLngs)
    }

    return null
  }, [processedRoutes, selectedRouteId, serviceCenters])

  return (
    <div className={`relative ${className}`}>
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom={true}
        className="h-full w-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBoundsController bounds={mapBounds} />

        {/* 1. Service Centers / Depots */}
        {serviceCenters.map((sc: any) => {
          if (!sc.lat || !sc.lon) return null
          const scCode = sc.service_center_id || sc.code
          const openHours = sc.opening_hours ? `${sc.opening_hours.open} – ${sc.opening_hours.close}` : (sc.openingHours ? `${sc.openingHours.open} – ${sc.openingHours.close}` : (sc.openTime ? `${sc.openTime} – ${sc.closeTime}` : '08:00 – 20:00'))

          return (
            <Marker
              key={sc.id}
              position={[sc.lat, sc.lon]}
              icon={createDepotIcon()}
            >
              <Popup className="custom-map-popup">
                <div className="p-1 space-y-1 text-xs">
                  <div className="flex items-center gap-1 font-bold text-sm text-blue-900">
                    <Building2 className="h-4 w-4" />
                    <span>СЦ {scCode}</span>
                  </div>
                  <p className="font-medium text-slate-800">{sc.name}</p>
                  <p className="text-slate-600">{sc.address}</p>
                  <div className="flex items-center gap-2 pt-1 border-t text-[11px] text-slate-500">
                    <Clock className="h-3 w-3" />
                    <span>Часы работы: {openHours}</span>
                  </div>
                </div>
              </Popup>
              <Tooltip direction="top" offset={[0, -18]} opacity={0.9}>
                🏢 {scCode} ({sc.name})
              </Tooltip>
            </Marker>
          )
        })}

        {/* 2. Access Nodes (Optional) */}
        {showAccessNodes &&
          accessNodes.map((node: any) => {
            if (!node.lat || !node.lon) return null
            const anCode = node.access_node_id || node.code

            return (
              <Marker
                key={node.id}
                position={[node.lat, node.lon]}
                icon={createNodeIcon()}
              >
                <Popup>
                  <div className="p-1 text-xs space-y-1">
                    <p className="font-bold">📡 Узел доступа: {anCode}</p>
                    <p>{node.name}</p>
                    <p className="text-muted-foreground">{node.address}</p>
                    <Badge variant="outline">{node.technology}</Badge>
                  </div>
                </Popup>
              </Marker>
            )
          })}

        {/* 3. Unassigned Orders (Optional) */}
        {showUnassignedOrders &&
          unassignedOrders.map((uo, idx) => {
            const loc = locationLookup.get(uo.buildingId || uo.buildingCode || '')
            if (!loc) return null
            return (
              <Marker
                key={`unassigned-${uo.orderId || idx}`}
                position={[loc.lat, loc.lon]}
                icon={createUnassignedOrderIcon()}
              >
                <Popup>
                  <div className="p-1 text-xs space-y-1">
                    <div className="flex items-center gap-1 font-bold text-red-600">
                      <AlertCircle className="h-4 w-4" />
                      <span>Нераспределенный наряд</span>
                    </div>
                    <p className="font-semibold">{uo.orderId}</p>
                    <p className="text-slate-600">{loc.address}</p>
                    {uo.reason && (
                      <p className="text-[11px] text-amber-700 bg-amber-50 p-1 rounded">
                        Причина: {uo.reason}
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            )
          })}

        {/* 4. Brigade Routes & Polyline tracks */}
        {processedRoutes.map((route) => {
          const isHighlighted = !selectedRouteId || route.isSelected
          const opacity = isHighlighted ? 0.9 : 0.25
          const weight = route.isSelected ? 5 : 3.5

          return (
            <React.Fragment key={route.routeId}>
              {/* Route Polyline track (OSRM road geometry or fallback to Euclidean points) */}
              {route.polylinePoints.length > 1 && (
                <Polyline
                  positions={roadGeometries[route.routeId] || route.polylinePoints}
                  pathOptions={{
                    color: route.color,
                    weight,
                    opacity,
                    dashArray: route.isSelected ? undefined : '6, 6',
                  }}
                  eventHandlers={{
                    click: () => onSelectRoute?.(route.isSelected ? null : route.routeId),
                  }}
                />
              )}

              {/* Stops Markers */}
              {isHighlighted &&
                route.stopsWithCoords.map((stop) => {
                  const isDepot = stop.type === 'DEPOT_START' || stop.type === 'DEPOT_END'
                  // If it's a depot, the depot marker is already rendered, but we can render an inner visit tag
                  if (isDepot) return null

                  const label = stop.seq
                  const icon = createStopIcon(route.color, label, route.isSelected)

                  return (
                    <Marker
                      key={`${route.routeId}-stop-${stop.seq}`}
                      position={[stop.lat, stop.lon]}
                      icon={icon}
                    >
                      <Popup>
                        <div className="p-1 text-xs space-y-1.5 min-w-[210px]">
                          <div className="flex items-center justify-between border-b pb-1">
                            <span className="font-bold text-sm" style={{ color: route.color }}>
                              {route.staffName || `Бригада ${route.staffCode}`}
                            </span>
                            <Badge variant={stop.type === 'VISIT' ? 'default' : 'secondary'}>
                              {stop.type}
                            </Badge>
                          </div>

                          <div className="space-y-0.5">
                            <p className="font-semibold text-slate-800">
                              Остановка #{stop.seq} {stop.orderId ? `(${stop.orderId})` : ''}
                            </p>
                            <p className="text-slate-600 text-[11px]">{stop.address}</p>
                          </div>

                          <div className="grid grid-cols-2 gap-1 text-[11px] bg-slate-50 p-1.5 rounded">
                            <div>
                              <span className="text-muted-foreground">Прибытие:</span>{' '}
                              <span className="font-medium">
                                {formatClock(stop.arrival, '—')}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Окончание:</span>{' '}
                              <span className="font-medium">
                                {formatClock(stop.endTime, '—')}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">В пути:</span>{' '}
                              <span className="font-medium">{Math.round(stop.travelSec / 60)} мин</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Расстояние:</span>{' '}
                              <span className="font-medium">{Math.round(stop.distanceM / 1000 * 10) / 10} км</span>
                            </div>
                          </div>

                          {/* Equipment After */}
                          {(stop.equipmentAfterOnt !== null ||
                            stop.equipmentAfterRouter !== null ||
                            stop.equipmentAfterStb !== null) && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-700 pt-1">
                              <Package className="h-3 w-3 text-muted-foreground" />
                              <span>Остаток АО:</span>
                              <span className="font-mono bg-slate-100 px-1 rounded">
                                ONT: {stop.equipmentAfterOnt ?? '—'}
                              </span>
                              <span className="font-mono bg-slate-100 px-1 rounded">
                                RT: {stop.equipmentAfterRouter ?? '—'}
                              </span>
                              <span className="font-mono bg-slate-100 px-1 rounded">
                                STB: {stop.equipmentAfterStb ?? '—'}
                              </span>
                            </div>
                          )}
                        </div>
                      </Popup>
                      <Tooltip direction="top" offset={[0, -12]}>
                        #{stop.seq} {stop.orderId || stop.locationCode} · {route.staffName || route.staffCode}
                      </Tooltip>
                    </Marker>
                  )
                })}
            </React.Fragment>
          )
        })}
      </MapContainer>
    </div>
  )
}
