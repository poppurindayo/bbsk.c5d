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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Plus, Search, Loader2, Building2, Wifi, MapPin, AlertTriangle, Layers, Map, Edit, Trash2 } from 'lucide-react'
import { useBuildings, useServiceCenters, useAccessNodes, useCreateAccessNode, useCreateBuilding, useCreateServiceCenter, useUpdateAccessNode, useUpdateBuilding, useUpdateServiceCenter, useDeleteAccessNode, useDeleteBuilding, useDeleteServiceCenter } from '@/hooks/useApi'
import { LocationPicker, ExistingLocation } from '@/components/map/LocationPicker'

const buildingSchema = z.object({
  buildingId: z.string().min(1, 'Код обязателен'),
  accessNodeId: z.string().min(1, 'Узел доступа обязателен'),
  zoneServiceCenterId: z.string().optional(),
  address: z.string().min(1, 'Адрес обязателен'),
  lat: z.coerce.number(),
  lon: z.coerce.number(),
  buildingType: z.enum(['MKD', 'PRIVATE']),
  overheadLine: z.boolean().default(false),
})

const accessNodeSchema = z.object({
  accessNodeId: z.string().min(1, 'Код обязателен'),
  nodeType: z.enum(['OLT', 'SWITCH', 'DSLAM', 'CMTS']),
  technology: z.enum(['PON', 'FTTB', 'XDSL', 'DOCSIS']),
  name: z.string().min(1, 'Название обязательно'),
  address: z.string().min(1, 'Адрес обязателен'),
  lat: z.coerce.number(),
  lon: z.coerce.number(),
})

const scSchema = z.object({
  serviceCenterId: z.string().min(1, 'Код обязателен'),
  name: z.string().min(1, 'Название обязательно'),
  address: z.string().min(1, 'Адрес обязателен'),
  lat: z.coerce.number(),
  lon: z.coerce.number(),
  openingHours: z.object({
    open: z.string().min(1, 'Время открытия обязательно'),
    close: z.string().min(1, 'Время закрытия обязательно'),
  }),
  restockDurationMin: z.coerce.number().min(0).default(15),
})

type BuildingForm = z.infer<typeof buildingSchema>
type AccessNodeForm = z.infer<typeof accessNodeSchema>
type SCForm = z.infer<typeof scSchema>

interface BuildingsPageProps {
  defaultTab?: string
  hideTitle?: boolean
}

export const BuildingsPage = ({ defaultTab = 'buildings', hideTitle = false }: BuildingsPageProps) => {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [anFilter, setAnFilter] = useState('ALL')
  const [scFilter, setScFilter] = useState('ALL')
  const [activeTab, setActiveTab] = useState<string>(defaultTab)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogError, setDialogError] = useState<string>('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data: buildings = [], isLoading: buildingsLoading, refetch: refetchBuildings } = useBuildings()
  const { data: accessNodes = [], isLoading: anLoading, refetch: refetchAN } = useAccessNodes()
  const { data: serviceCenters = [], isLoading: scLoading, refetch: refetchSC } = useServiceCenters()

  const createAccessNode = useCreateAccessNode()
  const createBuilding = useCreateBuilding()
  const createServiceCenter = useCreateServiceCenter()
  const updateAccessNode = useUpdateAccessNode()
  const updateBuilding = useUpdateBuilding()
  const updateServiceCenter = useUpdateServiceCenter()
  const deleteAccessNode = useDeleteAccessNode()
  const deleteBuilding = useDeleteBuilding()
  const deleteServiceCenter = useDeleteServiceCenter()

  const buildingForm = useForm<BuildingForm>({
    resolver: zodResolver(buildingSchema),
    defaultValues: {
      buildingId: '',
      accessNodeId: '',
      zoneServiceCenterId: '',
      address: '',
      lat: 56.8389,
      lon: 60.6057,
      buildingType: 'MKD',
      overheadLine: false,
    },
  })

  const anForm = useForm<AccessNodeForm>({
    resolver: zodResolver(accessNodeSchema),
    defaultValues: {
      accessNodeId: '',
      nodeType: 'OLT',
      technology: 'PON',
      name: '',
      address: '',
      lat: 56.8389,
      lon: 60.6057,
    },
  })

  const scForm = useForm<SCForm>({
    resolver: zodResolver(scSchema),
    defaultValues: {
      serviceCenterId: '',
      name: '',
      address: '',
      lat: 56.8389,
      lon: 60.6057,
      openingHours: { open: '08:00', close: '20:00' },
      restockDurationMin: 15,
    },
  })

  // Prepare existing locations to display as context markers on picker map
  const existingLocations: ExistingLocation[] = useMemo(() => {
    const list: ExistingLocation[] = []

    serviceCenters.forEach((sc: any) => {
      if (sc.lat && sc.lon) {
        list.push({
          id: sc.id,
          lat: Number(sc.lat),
          lon: Number(sc.lon),
          label: `СЦ ${sc.service_center_id || sc.code} (${sc.name})`,
          type: 'SC',
        })
      }
    })

    accessNodes.forEach((an: any) => {
      if (an.lat && an.lon) {
        list.push({
          id: an.id,
          lat: Number(an.lat),
          lon: Number(an.lon),
          label: `УД ${an.access_node_id || an.code} (${an.name})`,
          type: 'AN',
        })
      }
    })

    buildings.slice(0, 30).forEach((b: any) => {
      if (b.lat && b.lon) {
        list.push({
          id: b.id,
          lat: Number(b.lat),
          lon: Number(b.lon),
          label: `${b.building_id || b.code}: ${b.address}`,
          type: 'BLD',
        })
      }
    })

    return list
  }, [serviceCenters, accessNodes, buildings])

  const openCreate = (type: typeof activeTab) => {
    setDialogError('')
    setEditingId(null)
    if (type === 'buildings') {
      buildingForm.reset({
        buildingId: `B-${String(buildings.length + 1).padStart(3, '0')}`,
        accessNodeId: accessNodes[0]?.id || '',
        zoneServiceCenterId: serviceCenters[0]?.id || '',
        address: '',
        lat: 56.8389,
        lon: 60.6057,
        buildingType: 'MKD',
        overheadLine: false,
      })
    }
    if (type === 'access-nodes') {
      anForm.reset({
        accessNodeId: `AN-${String(accessNodes.length + 1).padStart(3, '0')}`,
        nodeType: 'OLT',
        technology: 'PON',
        name: '',
        address: '',
        lat: 56.8389,
        lon: 60.6057,
      })
    }
    if (type === 'service-centers') {
      scForm.reset({
        serviceCenterId: `SC-${String(serviceCenters.length + 1).padStart(2, '0')}`,
        name: '',
        address: '',
        lat: 56.8389,
        lon: 60.6057,
        openingHours: { open: '08:00', close: '20:00' },
        restockDurationMin: 15,
      })
    }
    setDialogOpen(true)
  }

  const handleBuildingSubmit = (data: BuildingForm) => {
    setDialogError('')
    const payload = {
      building_id: data.buildingId,
      access_node_id: data.accessNodeId,
      zone_service_center_id: data.zoneServiceCenterId ? data.zoneServiceCenterId : null,
      address: data.address,
      lat: Number(data.lat),
      lon: Number(data.lon),
      building_type: data.buildingType,
      overhead_line: data.overheadLine,
    }
    const onSuccess = () => {
      setDialogOpen(false)
      setEditingId(null)
      refetchBuildings()
    }
    const onError = (err: any) => setDialogError(err.response?.data?.message || 'Ошибка сохранения здания')

    if (editingId) {
      updateBuilding.mutate({ id: editingId, data: payload }, { onSuccess, onError })
    } else {
      createBuilding.mutate(payload, { onSuccess, onError })
    }
  }

  const handleANSubmit = (data: AccessNodeForm) => {
    setDialogError('')
    const payload = {
      access_node_id: data.accessNodeId,
      node_type: data.nodeType,
      technology: data.technology,
      name: data.name,
      address: data.address,
      lat: Number(data.lat),
      lon: Number(data.lon),
    }
    const onSuccess = () => {
      setDialogOpen(false)
      setEditingId(null)
      refetchAN()
    }
    const onError = (err: any) => setDialogError(err.response?.data?.message || 'Ошибка сохранения узла')

    if (editingId) {
      updateAccessNode.mutate({ id: editingId, data: payload }, { onSuccess, onError })
    } else {
      createAccessNode.mutate(payload, { onSuccess, onError })
    }
  }

  const handleSCSubmit = (data: SCForm) => {
    setDialogError('')
    const payload = {
      service_center_id: data.serviceCenterId,
      name: data.name,
      address: data.address,
      lat: Number(data.lat),
      lon: Number(data.lon),
      opening_hours: { open: data.openingHours.open, close: data.openingHours.close },
      restock_duration_min: Number(data.restockDurationMin),
    }
    const onSuccess = () => {
      setDialogOpen(false)
      setEditingId(null)
      refetchSC()
    }
    const onError = (err: any) => setDialogError(err.response?.data?.message || 'Ошибка сохранения СЦ')

    if (editingId) {
      updateServiceCenter.mutate({ id: editingId, data: payload }, { onSuccess, onError })
    } else {
      createServiceCenter.mutate(payload, { onSuccess, onError })
    }
  }

  // ─── Edit handlers: pre-fill forms from existing rows ────────────────────────
  const openEditBuilding = (b: any) => {
    setEditingId(b.id)
    setDialogError('')
    buildingForm.reset({
      buildingId: b.building_id || b.code || b.buildingId || '',
      accessNodeId: b.access_node_id || b.accessNodeId || '',
      zoneServiceCenterId: b.zone_service_center_id || b.zoneServiceCenterId || '',
      address: b.address || '',
      lat: Number(b.lat),
      lon: Number(b.lon),
      buildingType: b.building_type || b.buildingType || 'MKD',
      overheadLine: b.overhead_line ?? b.overheadLine ?? false,
    })
    setDialogOpen(true)
  }

  const openEditAN = (an: any) => {
    setEditingId(an.id)
    setDialogError('')
    anForm.reset({
      accessNodeId: an.access_node_id || an.code || an.accessNodeId || '',
      nodeType: an.node_type || an.nodeType || 'OLT',
      technology: an.technology || 'PON',
      name: an.name || '',
      address: an.address || '',
      lat: Number(an.lat),
      lon: Number(an.lon),
    })
    setDialogOpen(true)
  }

  const openEditSC = (sc: any) => {
    setEditingId(sc.id)
    setDialogError('')
    scForm.reset({
      serviceCenterId: sc.service_center_id || sc.code || sc.serviceCenterId || '',
      name: sc.name || '',
      address: sc.address || '',
      lat: Number(sc.lat),
      lon: Number(sc.lon),
      openingHours: {
        open: sc.opening_hours?.open || sc.openingHours?.open || sc.openTime || '08:00',
        close: sc.opening_hours?.close || sc.openingHours?.close || sc.closeTime || '20:00',
      },
      restockDurationMin: sc.restock_duration_min ?? sc.restockDurationMin ?? 15,
    })
    setDialogOpen(true)
  }

  const handleDelete = (type: 'buildings' | 'access-nodes' | 'service-centers', id: string) => {
    if (!window.confirm('Удалить запись? Это действие необратимо.')) return
    if (type === 'buildings') deleteBuilding.mutate(id, { onSuccess: () => refetchBuildings() })
    if (type === 'access-nodes') deleteAccessNode.mutate(id, { onSuccess: () => refetchAN() })
    if (type === 'service-centers') deleteServiceCenter.mutate(id, { onSuccess: () => refetchSC() })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {!hideTitle ? (
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Инфраструктура и здания</h1>
            <p className="text-muted-foreground">
              Управление зданиями, узлами доступа и сервисными центрами с интерактивным выбором координат на карте
            </p>
          </div>
        ) : (
          <div />
        )}
        <Button onClick={() => openCreate(activeTab)}>
          <Plus className="mr-2 h-4 w-4" />
          {activeTab === 'buildings' && 'Добавить здание'}
          {activeTab === 'access-nodes' && 'Добавить узел доступа'}
          {activeTab === 'service-centers' && 'Добавить сервисный центр'}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {!hideTitle && (
          <TabsList>
            <TabsTrigger value="buildings">
              <Building2 className="mr-2 h-4 w-4" />
              Здания ({buildings.length})
            </TabsTrigger>
            <TabsTrigger value="access-nodes">
              <Wifi className="mr-2 h-4 w-4" />
              Узлы доступа ({accessNodes.length})
            </TabsTrigger>
            <TabsTrigger value="service-centers">
              <MapPin className="mr-2 h-4 w-4" />
              Сервисные центры ({serviceCenters.length})
            </TabsTrigger>
          </TabsList>
        )}

        {/* 1. Buildings */}
        <TabsContent value="buildings">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle>Список зданий ({buildings.length})</CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    placeholder="Поиск по коду/адресу..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-64 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Тип" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Все типы</SelectItem>
                      <SelectItem value="MKD">МКД</SelectItem>
                      <SelectItem value="PRIVATE">Частный сектор</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={anFilter} onValueChange={setAnFilter}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Узел доступа" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Все узлы</SelectItem>
                      {accessNodes.map((an: any) => (
                        <SelectItem key={an.id} value={an.id}>
                          {an.access_node_id || an.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={scFilter} onValueChange={setScFilter}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="СЦ зоны" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Все СЦ</SelectItem>
                      {serviceCenters.map((sc: any) => (
                        <SelectItem key={sc.id} value={sc.id}>
                          {sc.service_center_id || sc.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {buildingsLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : buildings.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">Здания не найдены.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Код здания</TableHead>
                        <TableHead>Адрес объекта</TableHead>
                        <TableHead>Тип застройки</TableHead>
                        <TableHead>Узел доступа</TableHead>
                        <TableHead>СЦ зоны</TableHead>
                        <TableHead>ВЛС (высота)</TableHead>
                        <TableHead>Координаты</TableHead>
                        <TableHead className="text-right">Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {buildings
                        .filter((b: any) => {
                          const bCode = b.building_id || b.code || ''
                          const bAddr = b.address || ''
                          const bType = b.building_type || b.buildingType || ''
                          const anId = b.access_node_id || b.accessNodeId || ''
                          const scId = b.zone_service_center_id || b.zoneServiceCenterId || ''

                          const matchesSearch =
                            !search ||
                            bCode.toLowerCase().includes(search.toLowerCase()) ||
                            bAddr.toLowerCase().includes(search.toLowerCase())
                          const matchesType = !typeFilter || typeFilter === 'ALL' || bType === typeFilter
                          const matchesAn = !anFilter || anFilter === 'ALL' || anId === anFilter
                          const matchesSc = !scFilter || scFilter === 'ALL' || scId === scFilter

                          return matchesSearch && matchesType && matchesAn && matchesSc
                        })
                        .map((b: any) => {
                          const bCode = b.building_id || b.code || b.buildingId
                          const bType = b.building_type || b.buildingType || 'MKD'
                          const overheadLine = b.overhead_line ?? b.overheadLine ?? false
                          const anCode =
                            b.access_node_code ||
                            accessNodes.find((an: any) => an.id === (b.access_node_id || b.accessNodeId))
                              ?.access_node_id ||
                            accessNodes.find((an: any) => an.id === (b.access_node_id || b.accessNodeId))?.code ||
                            '—'
                          const scCode =
                            b.zone_service_center_code ||
                            serviceCenters.find(
                              (sc: any) => sc.id === (b.zone_service_center_id || b.zoneServiceCenterId)
                            )?.service_center_id ||
                            serviceCenters.find(
                              (sc: any) => sc.id === (b.zone_service_center_id || b.zoneServiceCenterId)
                            )?.code ||
                            '—'

                          return (
                            <TableRow key={b.id}>
                              <TableCell className="font-mono font-semibold text-primary">{bCode}</TableCell>
                              <TableCell className="max-w-[260px] truncate font-medium">{b.address}</TableCell>
                              <TableCell>
                                <Badge variant={bType === 'MKD' ? 'secondary' : 'default'}>
                                  {bType === 'MKD' ? 'МКД' : 'Частный'}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-xs">{anCode}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{scCode}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={overheadLine ? 'success' : 'secondary'}>
                                  {overheadLine ? 'Да' : 'Нет'}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {Number(b.lat).toFixed(4)}, {Number(b.lon).toFixed(4)}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button variant="ghost" size="icon" onClick={() => openEditBuilding(b)} title="Редактировать">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete('buildings', b.id)} title="Удалить">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
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
        </TabsContent>

        {/* 2. Access Nodes */}
        <TabsContent value="access-nodes">
          <Card>
            <CardHeader>
              <CardTitle>Узлы доступа ({accessNodes.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {anLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : accessNodes.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">Узлы доступа не найдены.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Код узла</TableHead>
                        <TableHead>Тип оборудования</TableHead>
                        <TableHead>Технология</TableHead>
                        <TableHead>Название узла</TableHead>
                        <TableHead>Адрес размещения</TableHead>
                        <TableHead>Координаты</TableHead>
                        <TableHead className="text-right">Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accessNodes.map((an: any) => {
                        const anCode = an.access_node_id || an.code || an.accessNodeId
                        const nodeType = an.node_type || an.nodeType || 'OLT'

                        return (
                          <TableRow key={an.id}>
                            <TableCell className="font-mono font-semibold text-primary">{anCode}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{nodeType}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{an.technology}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">{an.name}</TableCell>
                            <TableCell className="max-w-[240px] truncate">{an.address}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {Number(an.lat).toFixed(4)}, {Number(an.lon).toFixed(4)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openEditAN(an)} title="Редактировать">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete('access-nodes', an.id)} title="Удалить">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
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
        </TabsContent>

        {/* 3. Service Centers */}
        <TabsContent value="service-centers">
          <Card>
            <CardHeader>
              <CardTitle>Сервисные центры и склады ({serviceCenters.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {scLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : serviceCenters.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  Сервисные центры не найдены.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Код СЦ</TableHead>
                      <TableHead>Название СЦ / Депо</TableHead>
                      <TableHead>Адрес</TableHead>
                      <TableHead>Режим работы</TableHead>
                      <TableHead>Пополнение АО</TableHead>
                      <TableHead>Координаты</TableHead>
                      <TableHead className="text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {serviceCenters.map((sc: any) => {
                      const scCode = sc.service_center_id || sc.code || sc.serviceCenterId
                      const openHours = sc.opening_hours
                        ? `${sc.opening_hours.open} – ${sc.opening_hours.close}`
                        : sc.openingHours
                        ? `${sc.openingHours.open} – ${sc.openingHours.close}`
                        : sc.openTime
                        ? `${sc.openTime} – ${sc.closeTime}`
                        : '08:00 – 20:00'
                      const restock = sc.restock_duration_min ?? sc.restockDurationMin ?? 15

                      return (
                        <TableRow key={sc.id}>
                          <TableCell className="font-mono font-bold text-primary">{scCode}</TableCell>
                          <TableCell className="font-medium">{sc.name}</TableCell>
                          <TableCell className="max-w-[240px] truncate">{sc.address}</TableCell>
                          <TableCell className="font-mono text-sm">{openHours}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{restock} мин</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {Number(sc.lat).toFixed(4)}, {Number(sc.lon).toFixed(4)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditSC(sc)} title="Редактировать">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete('service-centers', sc.id)} title="Удалить">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Building Dialog - Step-by-step: Type & Links -> Interactive Map -> Address & Coordinates */}
      <Dialog open={dialogOpen && activeTab === 'buildings'} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Добавить здание в инфраструктуру
            </DialogTitle>
          </DialogHeader>

          {dialogError && (
            <div className="p-3 text-xs bg-destructive/10 text-destructive rounded-lg flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>{dialogError}</span>
            </div>
          )}

          <form onSubmit={buildingForm.handleSubmit(handleBuildingSubmit)} className="space-y-4">
            {/* Step 1: Type & Links First (As requested by user!) */}
            <div className="p-3 bg-muted/40 rounded-lg border space-y-3">
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-primary" />
                1. Тип здания и привязка к инфраструктуре (СЦ / Узел)
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Тип застройки</Label>
                  <Select
                    value={buildingForm.watch('buildingType')}
                    onValueChange={(val: any) => buildingForm.setValue('buildingType', val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MKD">МКД (Многоквартирный дом)</SelectItem>
                      <SelectItem value="PRIVATE">Частный сектор</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Узел доступа (УД)</Label>
                  <Select
                    value={buildingForm.watch('accessNodeId')}
                    onValueChange={(val) => buildingForm.setValue('accessNodeId', val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите УД" />
                    </SelectTrigger>
                    <SelectContent>
                      {accessNodes.map((an: any) => (
                        <SelectItem key={an.id} value={an.id}>
                          {an.access_node_id || an.code} ({an.name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Сервисный центр (СЦ зоны)</Label>
                  <Select
                    value={buildingForm.watch('zoneServiceCenterId')}
                    onValueChange={(val) => buildingForm.setValue('zoneServiceCenterId', val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите СЦ" />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceCenters.map((sc: any) => (
                        <SelectItem key={sc.id} value={sc.id}>
                          {sc.service_center_id || sc.code} ({sc.name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Step 2: Interactive Map Picker with Auto-Geocoding */}
            <div className="p-3 bg-muted/40 rounded-lg border space-y-2">
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                <Map className="h-4 w-4 text-primary" />
                2. Выбор точки на интерактивной карте
              </h4>

              <LocationPicker
                lat={buildingForm.watch('lat')}
                lon={buildingForm.watch('lon')}
                existingLocations={existingLocations}
                height="260px"
                onLocationChange={(newLat, newLon, newAddress) => {
                  buildingForm.setValue('lat', newLat)
                  buildingForm.setValue('lon', newLon)
                  if (newAddress) {
                    buildingForm.setValue('address', newAddress)
                  }
                }}
              />
            </div>

            {/* Step 3: Address & Coordinates confirmation */}
            <div className="p-3 bg-muted/40 rounded-lg border space-y-3">
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                3. Адрес и параметры здания
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <Label>Адрес (автоматически определен по карте, можно отредактировать)</Label>
                  <Input
                    {...buildingForm.register('address')}
                    placeholder="г. Екатеринбург, ул. Победы, 34"
                  />
                  {buildingForm.formState.errors.address && (
                    <p className="text-xs text-destructive">
                      {buildingForm.formState.errors.address.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label>Код здания</Label>
                  <Input {...buildingForm.register('buildingId')} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Широта (lat)</Label>
                  <Input type="number" step="0.0001" {...buildingForm.register('lat')} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Долгота (lon)</Label>
                  <Input type="number" step="0.0001" {...buildingForm.register('lon')} />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="overheadLine"
                  checked={buildingForm.watch('overheadLine')}
                  onChange={(e) => buildingForm.setValue('overheadLine', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary"
                />
                <Label htmlFor="overheadLine" className="cursor-pointer text-xs font-normal">
                  Требуются работы на высоте (воздушно-кабельный ввод / ВЛС)
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={createBuilding.isPending || updateBuilding.isPending}>
                {createBuilding.isPending || updateBuilding.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingId ? 'Сохранить здание' : 'Добавить здание'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Access Node Dialog */}
      <Dialog open={dialogOpen && activeTab === 'access-nodes'} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-primary" />
              Добавить узел доступа (УД)
            </DialogTitle>
          </DialogHeader>

          {dialogError && (
            <div className="p-3 text-xs bg-destructive/10 text-destructive rounded-lg flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>{dialogError}</span>
            </div>
          )}

          <form onSubmit={anForm.handleSubmit(handleANSubmit)} className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label>Код узла</Label>
                <Input {...anForm.register('accessNodeId')} placeholder="AN-001" />
              </div>
              <div className="space-y-1">
                <Label>Тип оборудования</Label>
                <Select
                  value={anForm.watch('nodeType')}
                  onValueChange={(val: any) => anForm.setValue('nodeType', val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OLT">OLT</SelectItem>
                    <SelectItem value="SWITCH">SWITCH</SelectItem>
                    <SelectItem value="DSLAM">DSLAM</SelectItem>
                    <SelectItem value="CMTS">CMTS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Технология</Label>
                <Select
                  value={anForm.watch('technology')}
                  onValueChange={(val: any) => anForm.setValue('technology', val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PON">PON</SelectItem>
                    <SelectItem value="FTTB">FTTB</SelectItem>
                    <SelectItem value="XDSL">XDSL</SelectItem>
                    <SelectItem value="DOCSIS">DOCSIS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Название узла</Label>
              <Input {...anForm.register('name')} placeholder="OLT Орджоникидзевский-1" />
            </div>

            {/* Map Picker */}
            <div className="space-y-2">
              <Label>Геопозиция на карте</Label>
              <LocationPicker
                lat={anForm.watch('lat')}
                lon={anForm.watch('lon')}
                existingLocations={existingLocations}
                height="220px"
                onLocationChange={(newLat, newLon, newAddress) => {
                  anForm.setValue('lat', newLat)
                  anForm.setValue('lon', newLon)
                  if (newAddress) anForm.setValue('address', newAddress)
                }}
              />
            </div>

            <div className="space-y-1">
              <Label>Адрес размещения</Label>
              <Input {...anForm.register('address')} placeholder="ул. Победы, 32" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Широта (lat)</Label>
                <Input type="number" step="0.0001" {...anForm.register('lat')} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Долгота (lon)</Label>
                <Input type="number" step="0.0001" {...anForm.register('lon')} />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={createAccessNode.isPending || updateAccessNode.isPending}>
                {createAccessNode.isPending || updateAccessNode.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingId ? 'Сохранить узел' : 'Добавить узел'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Service Center Dialog */}
      <Dialog open={dialogOpen && activeTab === 'service-centers'} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Добавить Сервисный Центр (СЦ)
            </DialogTitle>
          </DialogHeader>

          {dialogError && (
            <div className="p-3 text-xs bg-destructive/10 text-destructive rounded-lg flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>{dialogError}</span>
            </div>
          )}

          <form onSubmit={scForm.handleSubmit(handleSCSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Код СЦ (напр. SC-01)</Label>
                <Input {...scForm.register('serviceCenterId')} placeholder="SC-01" />
              </div>
              <div className="space-y-1">
                <Label>Название СЦ / Депо</Label>
                <Input {...scForm.register('name')} placeholder="СЦ «Север» (Депо №1)" />
              </div>
            </div>

            {/* Map Picker */}
            <div className="space-y-2">
              <Label>Местоположение СЦ на карте</Label>
              <LocationPicker
                lat={scForm.watch('lat')}
                lon={scForm.watch('lon')}
                existingLocations={existingLocations}
                height="220px"
                onLocationChange={(newLat, newLon, newAddress) => {
                  scForm.setValue('lat', newLat)
                  scForm.setValue('lon', newLon)
                  if (newAddress) scForm.setValue('address', newAddress)
                }}
              />
            </div>

            <div className="space-y-1">
              <Label>Адрес</Label>
              <Input {...scForm.register('address')} placeholder="г. Екатеринбург, ул. Победы, 30" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Открытие (ЧЧ:ММ)</Label>
                <Input {...scForm.register('openingHours.open')} placeholder="08:00" />
              </div>
              <div className="space-y-1">
                <Label>Закрытие (ЧЧ:ММ)</Label>
                <Input {...scForm.register('openingHours.close')} placeholder="21:00" />
              </div>
              <div className="space-y-1">
                <Label>Пополнение АО (мин)</Label>
                <Input type="number" {...scForm.register('restockDurationMin')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Широта (lat)</Label>
                <Input type="number" step="0.0001" {...scForm.register('lat')} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Долгота (lon)</Label>
                <Input type="number" step="0.0001" {...scForm.register('lon')} />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={createServiceCenter.isPending || updateServiceCenter.isPending}>
                {createServiceCenter.isPending || updateServiceCenter.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingId ? 'Сохранить СЦ' : 'Добавить Сервисный Центр'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
