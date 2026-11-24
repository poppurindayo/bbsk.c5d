import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { staffApi, buildingsApi, workTypesApi, referenceApi, ordersApi, daysApi } from '@/api/client'
import type { Staff, StaffCreateRequest, Shift, ShiftCreateRequest } from '@/types/api'

// Staff hooks
export const useStaff = (params?: { profile?: string; technology?: string; serviceCenterId?: string }) => {
  return useQuery({
    queryKey: ['staff', params],
    queryFn: async () => {
      const response = await staffApi.list(params)
      return response.data
    },
  })
}

export const useStaffItem = (id: string) => {
  return useQuery({
    queryKey: ['staff', id],
    queryFn: async () => {
      const response = await staffApi.get(id)
      return response.data
    },
    enabled: !!id,
  })
}

export const useCreateStaff = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: StaffCreateRequest) => staffApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
    },
  })
}

export const useUpdateStaff = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<StaffCreateRequest> }) => staffApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
    },
  })
}

export const useDeleteStaff = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => staffApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
    },
  })
}

// Shifts hooks
export const useShifts = () => {
  return useQuery({
    queryKey: ['shifts'],
    queryFn: async () => {
      const response = await staffApi.shifts.list()
      return response.data
    },
  })
}

export const useCreateShift = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ShiftCreateRequest) => staffApi.shifts.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
    },
  })
}

export const useDeleteShift = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => staffApi.shifts.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
    },
  })
}

export const useUpdateShift = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => staffApi.shifts.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
    },
  })
}

// Buildings hooks
export const useBuildings = (params?: { buildingType?: string; accessNodeId?: string; serviceCenterId?: string }) => {
  return useQuery({
    queryKey: ['buildings', params],
    queryFn: async () => {
      const response = await buildingsApi.list(params)
      return response.data
    },
  })
}

export const useBuildingsItem = (id: string) => {
  return useQuery({
    queryKey: ['buildings', id],
    queryFn: async () => {
      const response = await buildingsApi.get(id)
      return response.data
    },
    enabled: !!id,
  })
}

export const useCreateBuilding = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => buildingsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buildings'] })
    },
  })
}

export const useUpdateBuilding = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => buildingsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buildings'] })
    },
  })
}

export const useDeleteBuilding = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => buildingsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buildings'] })
    },
  })
}

// Access Nodes hooks
export const useAccessNodes = (params?: { technology?: string }) => {
  return useQuery({
    queryKey: ['accessNodes', params],
    queryFn: async () => {
      const response = await buildingsApi.accessNodes.list(params)
      return response.data
    },
  })
}

export const useCreateAccessNode = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => buildingsApi.accessNodes.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accessNodes'] })
    },
  })
}

export const useUpdateAccessNode = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => buildingsApi.accessNodes.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accessNodes'] })
    },
  })
}

export const useDeleteAccessNode = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => buildingsApi.accessNodes.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accessNodes'] })
    },
  })
}

// Service Centers hooks
export const useServiceCenters = () => {
  return useQuery({
    queryKey: ['serviceCenters'],
    queryFn: async () => {
      const response = await buildingsApi.serviceCenters.list()
      return response.data
    },
  })
}

export const useCreateServiceCenter = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => buildingsApi.serviceCenters.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceCenters'] })
    },
  })
}

export const useUpdateServiceCenter = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => buildingsApi.serviceCenters.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceCenters'] })
    },
  })
}

export const useDeleteServiceCenter = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => buildingsApi.serviceCenters.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceCenters'] })
    },
  })
}

// Work Types hooks
export const useWorkTypes = () => {
  return useQuery({
    queryKey: ['workTypes'],
    queryFn: async () => {
      const response = await workTypesApi.list()
      return response.data
    },
  })
}

export const useCreateWorkType = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => workTypesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workTypes'] })
    },
  })
}

export const useUpdateWorkType = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => workTypesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workTypes'] })
    },
  })
}

export const useDeleteWorkType = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => workTypesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workTypes'] })
    },
  })
}

// Reference hooks
export const useLoadReference = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => referenceApi.loadReference(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
      queryClient.invalidateQueries({ queryKey: ['serviceCenters'] })
      queryClient.invalidateQueries({ queryKey: ['accessNodes'] })
      queryClient.invalidateQueries({ queryKey: ['buildings'] })
      queryClient.invalidateQueries({ queryKey: ['workTypes'] })
    },
  })
}

export const useLoadTravelMatrix = () => {
  return useMutation({
    mutationFn: (data: any) => referenceApi.loadTravelMatrix(data),
  })
}

export const useInitReference = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data?: any) => referenceApi.init(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
      queryClient.invalidateQueries({ queryKey: ['serviceCenters'] })
      queryClient.invalidateQueries({ queryKey: ['accessNodes'] })
      queryClient.invalidateQueries({ queryKey: ['buildings'] })
      queryClient.invalidateQueries({ queryKey: ['workTypes'] })
    },
  })
}

export const useInitTravelMatrix = () => {
  return useMutation({
    mutationFn: (data?: any) => referenceApi.travelMatrix(data),
  })
}

// Orders hooks
export const useOrders = (params?: { dayId?: string; date?: string; status?: string; buildingId?: string; workTypeId?: string }) => {
  return useQuery({
    queryKey: ['orders', params],
    queryFn: async () => {
      const response = await ordersApi.list(params)
      return response.data
    },
  })
}

export const useCreateOrder = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => ordersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

export const useDeleteOrder = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => ordersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

// Days hooks
export const useDay = (date: string) => {
  return useQuery({
    queryKey: ['day', date],
    queryFn: async () => {
      const response = await daysApi.get(date)
      const d = response.data
      if (!d) return d
      return {
        ...d,
        planVersion: d.plan_version ?? d.planVersion ?? 0,
        ordersCount: d.orders_count ?? d.ordersCount ?? 0,
        absentStaffCount: d.absent_staff_count ?? d.absentStaffCount ?? 0,
        absentStaffCodes: d.absent_staff_codes || d.absentStaffCodes || [],
      }
    },
    enabled: !!date,
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 404) return false
      return failureCount < 1
    },
  })
}

export const useInitDay = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ date, data }: { date: string; data: any }) => daysApi.init(date, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['day'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

export const useCreatePlan = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (date: string) => daysApi.plan.create(date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan'] })
      queryClient.invalidateQueries({ queryKey: ['day'] })
    },
  })
}

export function normalizeStop(stop: any) {
  if (!stop) return stop
  const eq = stop.equipment_after || stop.equipmentAfter || {}
  const ont = eq.ONT ?? eq.ont ?? stop.equipmentAfterOnt ?? 0
  const router = eq.ROUTER ?? eq.router ?? stop.equipmentAfterRouter ?? 0
  const stb = eq.STB ?? eq.stb ?? stop.equipmentAfterStb ?? 0

  return {
    ...stop,
    id: stop.id,
    seq: stop.seq,
    type: stop.type,
    locationCode: stop.location_code || stop.locationCode || '',
    location_code: stop.location_code || stop.locationCode || '',
    orderId: stop.order_code || stop.orderCode || stop.order_id || stop.orderId || null,
    order_id: stop.order_id || stop.orderId || null,
    orderCode: stop.order_code || stop.orderCode || null,
    order_code: stop.order_code || stop.orderCode || null,
    arrival: stop.arrival,
    startTime: stop.start_time || stop.startTime || stop.arrival,
    start_time: stop.start_time || stop.startTime || stop.arrival,
    endTime: stop.end_time || stop.endTime || '',
    end_time: stop.end_time || stop.endTime || '',
    travelSec: stop.travel_sec ?? stop.travelSec ?? 0,
    travel_sec: stop.travel_sec ?? stop.travelSec ?? 0,
    distanceM: stop.distance_m ?? stop.distanceM ?? 0,
    status: stop.status,
    equipmentAfter: eq,
    equipment_after: eq,
    equipmentAfterOnt: ont,
    equipmentAfterRouter: router,
    equipmentAfterStb: stb,
  }
}

export function normalizeRoute(route: any) {
  if (!route) return route
  return {
    ...route,
    routeId: route.route_id || route.routeId || route.id,
    route_id: route.route_id || route.routeId || route.id,
    staffId: route.staff_id || route.staffId,
    staff_id: route.staff_id || route.staffId,
    staffCode: route.staff_code || route.staffCode,
    staff_code: route.staff_code || route.staffCode,
    staffName: route.staff_name || route.staffName,
    staff_name: route.staff_name || route.staffName,
    serviceCenterCode: route.service_center_code || route.serviceCenterCode,
    service_center_code: route.service_center_code || route.serviceCenterCode,
    totalTravelSec: route.total_travel_sec ?? route.totalTravelSec ?? 0,
    total_travel_sec: route.total_travel_sec ?? route.totalTravelSec ?? 0,
    totalWorkMin: route.total_work_min ?? route.totalWorkMin ?? 0,
    total_work_min: route.total_work_min ?? route.totalWorkMin ?? 0,
    totalOrders: route.total_orders ?? route.totalOrders ?? 0,
    total_orders: route.total_orders ?? route.totalOrders ?? 0,
    stops: (route.stops || []).map(normalizeStop),
  }
}

export function normalizePlan(plan: any) {
  if (!plan) return plan
  const m = plan.metrics || {}
  const metrics = {
    totalOrders: m.total_orders ?? m.totalOrders ?? 0,
    total_orders: m.total_orders ?? m.totalOrders ?? 0,
    assignedOrders: m.assigned_orders ?? m.assignedOrders ?? 0,
    assigned_orders: m.assigned_orders ?? m.assignedOrders ?? 0,
    unassignedOrders: m.unassigned_orders ?? m.unassignedOrders ?? 0,
    unassigned_orders: m.unassigned_orders ?? m.unassignedOrders ?? 0,
    pgpOrders: m.pgp_orders ?? m.pgpOrders ?? 0,
    pgp_orders: m.pgp_orders ?? m.pgpOrders ?? 0,
    activeRoutes: m.active_routes ?? m.activeRoutes ?? 0,
    active_routes: m.active_routes ?? m.activeRoutes ?? 0,
    totalTravelSec: m.total_travel_sec ?? m.totalTravelSec ?? 0,
    total_travel_sec: m.total_travel_sec ?? m.totalTravelSec ?? 0,
    avgTravelSecPerRoute: m.avg_travel_sec_per_route ?? m.avgTravelSecPerRoute ?? 0,
  }

  const unassigned = (plan.unassigned_orders || plan.unassignedOrders || []).map((uo: any) => ({
    ...uo,
    orderId: uo.order_code || uo.orderCode || uo.order_id || uo.orderId,
    order_id: uo.order_id || uo.orderId,
    orderCode: uo.order_code || uo.orderCode,
    reasonText: uo.reason_text || uo.reasonText || uo.reason || '',
    reason_text: uo.reason_text || uo.reasonText || uo.reason || '',
    suggestedAction: uo.suggested_action || uo.suggestedAction || '',
  }))

  const pgpGroups = (plan.pgp_groups || plan.pgpGroups || []).map((pgp: any) => ({
    ...pgp,
    code: pgp.code,
    accessNodeCode: pgp.access_node_code || pgp.accessNodeCode,
    access_node_code: pgp.access_node_code || pgp.accessNodeCode,
    orderCodes: pgp.order_codes || pgp.orderCodes || [],
    order_codes: pgp.order_codes || pgp.orderCodes || [],
  }))

  return {
    ...plan,
    planVersion: plan.plan_version ?? plan.planVersion ?? 1,
    plan_version: plan.plan_version ?? plan.planVersion ?? 1,
    metrics,
    routes: (plan.routes || []).map(normalizeRoute),
    unassignedOrders: unassigned,
    unassigned_orders: unassigned,
    pgpGroups,
    pgp_groups: pgpGroups,
    alerts: plan.alerts || [],
  }
}

export const usePlan = (date: string) => {
  return useQuery({
    queryKey: ['plan', date],
    queryFn: async () => {
      const response = await daysApi.plan.get(date)
      return normalizePlan(response.data)
    },
    enabled: !!date,
  })
}

export const useCreateEvent = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ date, data }: { date: string; data: any }) => daysApi.events.create(date, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan'] })
      queryClient.invalidateQueries({ queryKey: ['day'] })
    },
  })
}