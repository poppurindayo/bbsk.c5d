// API Types based on backend API.md

export interface HealthResponse {
  status: string
  team: string
  version: string
}

export interface AuthRegisterRequest {
  username: string
  password: string
  role: string
}

export interface AuthLoginRequest {
  username: string
  password: string
}

export interface AuthResponse {
  id: string
  username: string
  role: string
}

export interface User {
  id: string
  username: string
  role: string
}

export interface Staff {
  id: string
  code: string
  displayName: string
  serviceCenterId: string
  shiftId: string
  heightPermit: boolean
  experienceYears: number
  equipmentStartOnt: number
  equipmentStartRouter: number
  equipmentStartStb: number
  equipmentCapacityOnt: number
  equipmentCapacityRouter: number
  equipmentCapacityStb: number
  profiles: string[]
  technologies: string[]
}

export interface StaffCreateRequest {
  staff_id: string
  display_name: string
  service_center_id: string
  shift_id?: string
  height_permit?: boolean
  experience_years?: number
  equipment_start: {
    ONT: number
    ROUTER: number
    STB: number
  }
  equipment_capacity: {
    ONT: number
    ROUTER: number
    STB: number
  }
  profiles: string[]
  technologies: string[]
}

export interface Shift {
  id: string
  startTime: string
  endTime: string
  breakDurationMin: number
  breakWindowFrom: string
  breakWindowTo: string
}

export interface ShiftCreateRequest {
  start: string
  end: string
  break_duration_min?: number
  break_window: {
    from: string
    to: string
  }
}

export interface ServiceCenter {
  id: string
  code: string
  name: string
  address: string
  lat: number
  lon: number
  openTime: string
  closeTime: string
  restockDurationMin: number
}

export interface ServiceCenterCreateRequest {
  code: string
  name: string
  address: string
  lat: number
  lon: number
  openTime: string
  closeTime: string
  restockDurationMin?: number
}

export interface AccessNode {
  id: string
  code: string
  nodeType: string
  technology: string
  name: string
  address: string
  lat: number
  lon: number
}

export interface AccessNodeCreateRequest {
  code: string
  nodeType: string
  technology: string
  name: string
  address: string
  lat: number
  lon: number
}

export interface Building {
  id: string
  code: string
  accessNodeId: string
  zoneServiceCenterId: string | null
  address: string
  lat: number
  lon: number
  buildingType: string
  overheadLine: boolean
}

export interface BuildingCreateRequest {
  code: string
  accessNodeId: string
  zoneServiceCenterId?: string
  address: string
  lat: number
  lon: number
  buildingType: string
  overheadLine?: boolean
}

export interface WorkType {
  id: string
  code: string
  name: string
  durationMin: number
  maxStartDelayMin: number | null
  deadlineKind: string
  deadlineValue: number | null
  repeatDeadlineValue: number | null
  pgpRelevant: boolean
  profiles: string[]
}

export interface WorkTypeCreateRequest {
  code: string
  name: string
  durationMin: number
  maxStartDelayMin?: number
  deadlineKind: string
  deadlineValue?: number
  repeatDeadlineValue?: number
  pgpRelevant?: boolean
  profiles: string[]
}

export interface WorkOrder {
  id: string
  code: string
  dayId: string
  serviceCenterId: string | null
  workTypeId: string
  buildingId: string
  accessNodeId: string
  registeredAt: string
  slotStart: string
  slotEnd: string
  latestStart: string
  deadline: string
  requiredOnt: number
  requiredRouter: number
  requiredStb: number
  isRepeat: boolean
  previousOrderId: string | null
  status: string
}

export interface CreateWorkOrderRequest {
  orderId: string
  dayId: string
  workTypeId: string
  buildingId: string
  registeredAt: string
  slot: {
    start: string
    end: string
  }
  requiredEquipment: {
    ONT: number
    ROUTER: number
    STB: number
  }
  isRepeat?: boolean
  accessNodeId?: string
  serviceCenterId?: string
  latestStart?: string
  deadline?: string
}

export interface DayInputDto {
  date: string
  now: string
  orders: Array<{
    orderId: string
    buildingId: string
    workType: string
    registeredAt: string
    slot: {
      start: string
      end: string
    }
    requiredEquipment: {
      ONT: number
      ROUTER: number
      STB: number
    }
    isRepeat?: boolean
  }>
  absentStaff: string[]
}

export interface DayResponse {
  id: string
  date: string
  currentNow: string
  planVersion: number
  ordersCount: number
  absentStaffCount: number
  absentStaffCodes: string[]
}

export interface RouteStop {
  seq: number
  type: string
  locationCode: string
  orderId: string | null
  arrival: string
  startTime: string
  endTime: string
  travelSec: number
  distanceM: number
  status: string
  equipmentAfterOnt: number | null
  equipmentAfterRouter: number | null
  equipmentAfterStb: number | null
}

export interface Route {
  routeId: string
  staffId: string
  staffCode: string
  staffName: string
  serviceCenterCode: string
  status: string
  stops: RouteStop[]
  totalTravelSec: number
  totalWorkMin: number
  totalOrders: number
}

export interface PlanResponse {
  dayId: string
  date: string
  planVersion: number
  routes: Route[]
  pgpGroups: any[]
  unassignedOrders: any[]
  alerts: any[]
  metrics: {
    totalOrders: number
    assignedOrders: number
    unassignedOrders: number
    pgpOrders: number
    activeRoutes: number
    totalTravelSec: number
    avgTravelSecPerRoute: number
  }
}

export interface EventInputDto {
  type: string
  timestamp: string
  orderId?: string
  reason?: string
  staffId?: string
  [key: string]: any
}

export interface EventResultResponse {
  eventId: string
  code: string
  type: string
  timestamp: string
  processedAt: string
  message: string
  plan: PlanResponse
}

export interface ReferenceInitResponse {
  status: string
  counts: {
    serviceCenters: number
    staff: number
    accessNodes: number
    buildings: number
    workTypes: number
  }
}

export interface TravelMatrixResponse {
  status: string
  counts: {
    points: number
  }
}

export interface PaginatedResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}