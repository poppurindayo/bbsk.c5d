import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/store/authStore'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().user?.token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  register: (data: { username: string; password: string; role: string }) =>
    api.post('/auth/register', data),
  login: (data: { username: string; password: string }) =>
    api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
}

export const healthApi = {
  check: () => api.get('/v1/health'),
}

export const staffApi = {
  list: (params?: { profile?: string; technology?: string; serviceCenterId?: string }) =>
    api.get('/v1/staff', { params }),
  get: (id: string) => api.get(`/v1/staff/${id}`),
  create: (data: any) => api.post('/v1/staff', data),
  update: (id: string, data: any) => api.put(`/v1/staff/${id}`, data),
  delete: (id: string) => api.delete(`/v1/staff/${id}`),
  shifts: {
    list: () => api.get('/v1/staff/shifts'),
    get: (id: string) => api.get(`/v1/staff/shifts/${id}`),
    create: (data: any) => api.post('/v1/staff/shifts', data),
    update: (id: string, data: any) => api.put(`/v1/staff/shifts/${id}`, data),
    delete: (id: string) => api.delete(`/v1/staff/shifts/${id}`),
  },
}

export const buildingsApi = {
  list: (params?: { buildingType?: string; accessNodeId?: string; serviceCenterId?: string }) =>
    api.get('/v1/buildings', { params }),
  get: (id: string) => api.get(`/v1/buildings/${id}`),
  create: (data: any) => api.post('/v1/buildings', data),
  update: (id: string, data: any) => api.put(`/v1/buildings/${id}`, data),
  delete: (id: string) => api.delete(`/v1/buildings/${id}`),
  accessNodes: {
    list: (params?: { technology?: string }) => api.get('/v1/buildings/access-nodes', { params }),
    get: (id: string) => api.get(`/v1/buildings/access-nodes/${id}`),
    create: (data: any) => api.post('/v1/buildings/access-nodes', data),
    update: (id: string, data: any) => api.put(`/v1/buildings/access-nodes/${id}`, data),
    delete: (id: string) => api.delete(`/v1/buildings/access-nodes/${id}`),
  },
  serviceCenters: {
    list: () => api.get('/v1/buildings/service-centers'),
    get: (id: string) => api.get(`/v1/buildings/service-centers/${id}`),
    create: (data: any) => api.post('/v1/buildings/service-centers', data),
    update: (id: string, data: any) => api.put(`/v1/buildings/service-centers/${id}`, data),
    delete: (id: string) => api.delete(`/v1/buildings/service-centers/${id}`),
  },
}

export const workTypesApi = {
  list: () => api.get('/v1/work-types'),
  get: (id: string) => api.get(`/v1/work-types/${id}`),
  create: (data: any) => api.post('/v1/work-types', data),
  update: (id: string, data: any) => api.put(`/v1/work-types/${id}`, data),
  delete: (id: string) => api.delete(`/v1/work-types/${id}`),
}

export const referenceApi = {
  loadReference: (data: any) => api.put('/v1/reference', data),
  loadTravelMatrix: (data: any) => api.put('/v1/reference/travel-matrix', data),
  init: (data?: any) => api.put('/v1/reference', data || {}),
  travelMatrix: (data?: any) => api.put('/v1/reference/travel-matrix', data || {}),
}

export const ordersApi = {
  list: (params?: { dayId?: string; date?: string; status?: string; buildingId?: string; workTypeId?: string }) =>
    api.get('/v1/orders', { params }),
  get: (id: string) => api.get(`/v1/orders/${id}`),
  create: (data: any) => api.post('/v1/orders', data),
  update: (id: string, data: any) => api.put(`/v1/orders/${id}`, data),
  delete: (id: string) => api.delete(`/v1/orders/${id}`),
}

export const daysApi = {
  init: (date: string, data: any) => api.put(`/v1/days/${date}`, data),
  get: (date: string) => api.get(`/v1/days/${date}`),
  plan: {
    create: (date: string) => api.post(`/v1/days/${date}/plan`),
    get: (date: string) => api.get(`/v1/days/${date}/plan`),
  },
  events: {
    create: (date: string, data: any) => api.post(`/v1/days/${date}/events`, data),
  },
}

export const solverApi = {
  health: () => axios.get('http://localhost:8000/health'),
  optimize: (data: any) => axios.post('http://localhost:8000/api/v1/solver/optimize', data),
}