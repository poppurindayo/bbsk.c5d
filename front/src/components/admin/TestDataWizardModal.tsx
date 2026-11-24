import React, { useState } from 'react'
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Sparkles, Building2, Wifi, Users, Wrench, Download, Upload, CheckCircle2, AlertTriangle, Loader2, ArrowRight, ArrowLeft, RefreshCw, Plus, Trash2 } from 'lucide-react'
import { useLoadReference, useLoadTravelMatrix } from '@/hooks/useApi'

// Базовый набор (используется как источник types работ и fallback)
const BASE_SEED = {
  service_centers: [
    {
      service_center_id: 'SC-01',
      name: 'СЦ «Север» (Базовое депо №1)',
      address: 'г. Екатеринбург, ул. Победы, 30',
      lat: 56.8941,
      lon: 60.6105,
      opening_hours: { open: '08:00', close: '21:00' },
      restock_duration_min: 15,
    },
    {
      service_center_id: 'SC-02',
      name: 'СЦ «Юг» (Базовое депо №2)',
      address: 'г. Екатеринбург, ул. 8 Марта, 150',
      lat: 56.8123,
      lon: 60.6012,
      opening_hours: { open: '08:00', close: '20:00' },
      restock_duration_min: 15,
    },
  ],
  access_nodes: [
    {
      access_node_id: 'AN-001',
      node_type: 'OLT',
      technology: 'PON',
      name: 'OLT Орджоникидзевский-1',
      address: 'ул. Победы, 32',
      lat: 56.895,
      lon: 60.611,
      buildings: [
        {
          building_id: 'B-001',
          address: 'ул. Победы, 34',
          lat: 56.896,
          lon: 60.612,
          building_type: 'MKD',
          overhead_line: false,
          zone_service_center_id: 'SC-01',
        },
        {
          building_id: 'B-002',
          address: 'ул. Победы, 36',
          lat: 56.897,
          lon: 60.613,
          building_type: 'MKD',
          overhead_line: false,
          zone_service_center_id: 'SC-01',
        },
      ],
    },
    {
      access_node_id: 'AN-002',
      node_type: 'SWITCH',
      technology: 'FTTB',
      name: 'SWITCH Чкаловский-1',
      address: 'ул. 8 Марта, 152',
      lat: 56.813,
      lon: 60.602,
      buildings: [
        {
          building_id: 'B-003',
          address: 'ул. 8 Марта, 154',
          lat: 56.814,
          lon: 60.603,
          building_type: 'MKD',
          overhead_line: false,
          zone_service_center_id: 'SC-02',
        },
        {
          building_id: 'B-004',
          address: 'ул. Авиационная, 10',
          lat: 56.815,
          lon: 60.604,
          building_type: 'PRIVATE',
          overhead_line: true,
          zone_service_center_id: 'SC-02',
        },
      ],
    },
  ],
  staff: [
    {
      staff_id: 'TECH-01',
      name: 'Иванов Иван Иванович',
      service_center_id: 'SC-01',
      shift: {
        start: '08:00',
        end: '20:00',
        break_duration_min: 60,
        break_window: { from: '12:00', to: '15:00' },
      },
      profiles: ['INSTALL'],
      technologies: ['PON', 'FTTB'],
      equipment_start: { ONT: 4, ROUTER: 2, STB: 2 },
      equipment_capacity: { ONT: 6, ROUTER: 4, STB: 4 },
      height_permit: false,
      experience_years: 3.5,
    },
    {
      staff_id: 'TECH-02',
      name: 'Петров Петр Сергеевич',
      service_center_id: 'SC-01',
      shift: {
        start: '09:00',
        end: '18:00',
        break_duration_min: 60,
        break_window: { from: '13:00', to: '15:00' },
      },
      profiles: ['LTP3'],
      technologies: ['PON'],
      equipment_start: { ONT: 2, ROUTER: 2, STB: 1 },
      equipment_capacity: { ONT: 4, ROUTER: 4, STB: 2 },
      height_permit: true,
      experience_years: 5.0,
    },
    {
      staff_id: 'TECH-03',
      name: 'Сидоров Алексей Михайлович',
      service_center_id: 'SC-02',
      shift: {
        start: '08:00',
        end: '20:00',
        break_duration_min: 60,
        break_window: { from: '12:00', to: '14:00' },
      },
      profiles: ['INSTALL', 'LTP3'],
      technologies: ['FTTB'],
      equipment_start: { ONT: 3, ROUTER: 3, STB: 2 },
      equipment_capacity: { ONT: 5, ROUTER: 5, STB: 3 },
      height_permit: true,
      experience_years: 4.0,
    },
  ],
  work_types: [
    {
      code: 'INST_PON_MKD',
      name: 'Инсталляция ШПД/IPTV, МКД, PON',
      duration_min: 90,
      max_start_delay_min: 10,
      deadline_kind: 'WORKING_DAYS',
      deadline_value: 3,
      pgp_relevant: false,
      profiles: ['INSTALL'],
    },
    {
      code: 'INST_FTTB_MKD',
      name: 'Инсталляция ШПД/IPTV, МКД, FTTB',
      duration_min: 60,
      max_start_delay_min: 10,
      deadline_kind: 'WORKING_DAYS',
      deadline_value: 3,
      pgp_relevant: false,
      profiles: ['INSTALL'],
    },
    {
      code: 'INST_PRIVATE_VLS',
      name: 'Инсталляция, частный сектор, с ВЛС',
      duration_min: 180,
      max_start_delay_min: 10,
      deadline_kind: 'WORKING_DAYS',
      deadline_value: 5,
      pgp_relevant: false,
      profiles: ['INSTALL'],
    },
    {
      code: 'ADD_SERVICE',
      name: 'Доподключение услуги (IPTV, Wi-Fi-роутер)',
      duration_min: 40,
      deadline_kind: 'SLOT',
      pgp_relevant: false,
      profiles: ['INSTALL'],
    },
    {
      code: 'SURVEY_PRIVATE',
      name: 'Обследование (частный сектор)',
      duration_min: 45,
      deadline_kind: 'WORKING_DAYS',
      deadline_value: 2,
      pgp_relevant: false,
      profiles: ['INSTALL', 'LTP3'],
    },
    {
      code: 'REPAIR',
      name: 'Устранение неисправности (обращение абонента)',
      duration_min: 60,
      deadline_kind: 'HOURS',
      deadline_value: 24,
      repeat_deadline_value: 12,
      pgp_relevant: true,
      profiles: ['LTP3'],
    },
    {
      code: 'DEGRADATION',
      name: 'Устранение деградации',
      duration_min: 45,
      deadline_kind: 'HOURS',
      deadline_value: 48,
      pgp_relevant: true,
      profiles: ['LTP3'],
    },
  ],
}

// ─── Генератор реалистичного эталона: Екатеринбург, 4 СЦ по районам ──────────
// Здания кластеризуются вокруг «своего» СЦ (смещения ~200–700 м), а районы разнесены
// на 3–7 км. Это даёт компактные маршруты (минимум перегонов) и корректную балансировку
// по зонам: наряд достаётся ближайшему квалифицированному сотруднику своего района.
function buildSeedData() {
  const zones = [
    { id: 'SC-01', name: 'СЦ «Север» (Орджоникидзевский)', address: 'ул. Победы, 30', district: 'Орджоникидзевский', street: 'ул. Победы', lat: 56.885, lon: 60.61, staff: ['Иванов Иван Иванович', 'Петров Пётр Сергеевич', 'Кузнецов Олег Иванович', 'Смирнов Дмитрий Андреевич'] },
    { id: 'SC-02', name: 'СЦ «Юг» (Чкаловский)', address: 'ул. 8 Марта, 150', district: 'Чкаловский', street: 'ул. 8 Марта', lat: 56.8, lon: 60.605, staff: ['Сидоров Алексей Михайлович', 'Морозов Игорь Валерьевич', 'Волков Сергей Николаевич', 'Зайцев Павел Олегович'] },
    { id: 'SC-03', name: 'СЦ «Восток» (Кировский)', address: 'ул. Луначарского, 80', district: 'Кировский', street: 'ул. Луначарского', lat: 56.85, lon: 60.69, staff: ['Павлов Роман Викторович', 'Орлов Денис Алексеевич', 'Макаров Илья Сергеевич', 'Фролов Антон Игоревич'] },
    { id: 'SC-04', name: 'СЦ «Запад» (Верх-Исетский)', address: 'ул. Толмачёва, 20', district: 'Верх-Исетский', street: 'ул. Толмачёва', lat: 56.855, lon: 60.535, staff: ['Егоров Максим Павлович', 'Никитин Артём Валерьевич', 'Беляев Кирилл Дмитриевич', 'Гусев Никита Олегович'] },
  ]

  // Смещения (deg) для кластеризации зданий вокруг СЦ — примерно 200–700 м
  const offsets: Array<[number, number]> = [
    [0.002, 0.001], [0.0038, -0.0016], [0.0011, 0.0032], [-0.0026, 0.0021],
    [0.0042, 0.0026], [-0.0031, -0.0022], [0.0016, -0.0033], [0.0052, -0.0011],
    [-0.0017, 0.0043], [0.0027, 0.0048], [-0.0042, 0.0012], [0.0033, -0.0044],
    [0.0058, 0.0013], [-0.0052, 0.0032], [0.0012, -0.0052], [0.0047, 0.0037],
  ]

  const service_centers = zones.map((z) => ({
    service_center_id: z.id,
    name: z.name,
    address: z.address,
    lat: z.lat,
    lon: z.lon,
    opening_hours: { open: '08:00', close: '21:00' },
    restock_duration_min: 15,
  }))

  const access_nodes: any[] = []
  const staff: any[] = []
  let buildingCounter = 0

  zones.forEach((z, zi) => {
    // 2 узла доступа на район: PON (OLT) и FTTB (SWITCH)
    for (let n = 0; n < 2; n++) {
      const tech = n === 0 ? 'PON' : 'FTTB'
      const nodeType = n === 0 ? 'OLT' : 'SWITCH'
      const buildings: any[] = []

      // 4 здания на узел, кластером вокруг СЦ
      for (let b = 0; b < 4; b++) {
        const off = offsets[(zi * 8 + n * 4 + b) % offsets.length]
        buildingCounter += 1
        const isPrivate = tech === 'FTTB' && b >= 2
        buildings.push({
          building_id: `B-${String(buildingCounter).padStart(3, '0')}`,
          address: `${z.street}, ${b + 1}`,
          lat: +(z.lat + off[0]).toFixed(6),
          lon: +(z.lon + off[1]).toFixed(6),
          building_type: isPrivate ? 'PRIVATE' : 'MKD',
          overhead_line: isPrivate,
          zone_service_center_id: z.id,
        })
      }

      access_nodes.push({
        access_node_id: `AN-${String(zi * 2 + n + 1).padStart(3, '0')}`,
        node_type: nodeType,
        technology: tech,
        name: `${nodeType} ${z.district}-${n + 1}`,
        address: `${z.street}, ${n + 1}`,
        lat: +(z.lat + (n === 0 ? 0.0008 : -0.0008)).toFixed(6),
        lon: +(z.lon + (n === 0 ? 0.0008 : -0.0008)).toFixed(6),
        buildings,
      })
    }

    // 4 сотрудника на район: 2 инсталлятора + 2 3ЛТП
    for (let s = 0; s < 4; s++) {
      const isInstaller = s < 2
      staff.push({
        staff_id: `TECH-${String(staff.length + 1).padStart(2, '0')}`,
        name: z.staff[s],
        service_center_id: z.id,
        shift: {
          start: s % 2 === 0 ? '08:00' : '09:00',
          end: s % 2 === 0 ? '20:00' : '18:00',
          break_duration_min: 60,
          break_window: { from: '12:00', to: '15:00' },
        },
        profiles: [isInstaller ? 'INSTALL' : 'LTP3'],
        technologies: ['PON', 'FTTB'],
        equipment_start: { ONT: 4, ROUTER: 3, STB: 2 },
        equipment_capacity: { ONT: 6, ROUTER: 5, STB: 4 },
        height_permit: s === 1 || s === 2,
        experience_years: 2 + s,
      })
    }
  })

  return { service_centers, access_nodes, staff, work_types: BASE_SEED.work_types }
}

const DEFAULT_SEED_DATA = buildSeedData()

interface TestDataWizardModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const TestDataWizardModal: React.FC<TestDataWizardModalProps> = ({
  open,
  onOpenChange,
}) => {
  const [activeStep, setActiveStep] = useState<string>('sc')
  const [dataset, setDataset] = useState(DEFAULT_SEED_DATA)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadReference = useLoadReference()
  const loadTravelMatrix = useLoadTravelMatrix()

  // Reset to default seed
  const handleResetToDefault = () => {
    setDataset(JSON.parse(JSON.stringify(DEFAULT_SEED_DATA)))
    setStatusMessage({ type: 'success', text: 'Данные сброшены к типовому эталонному набору Екатеринбурга.' })
  }

  // Calculate coordinates distance in meters
  const calcDistMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000 // meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return Math.round(R * c)
  }

  // Generate travel matrix for all points in dataset
  const generateMatrixPayload = () => {
    const pointsList: Array<{ code: string; lat: number; lon: number }> = []

    dataset.service_centers.forEach((sc) => {
      pointsList.push({ code: sc.service_center_id, lat: sc.lat, lon: sc.lon })
    })

    dataset.access_nodes.forEach((an: any) => {
      an.buildings.forEach((b: any) => {
        pointsList.push({ code: b.building_id, lat: b.lat, lon: b.lon })
      })
    })

    const n = pointsList.length
    const points = pointsList.map((p) => p.code)
    const durations: number[][] = []
    const distances: number[][] = []

    for (let i = 0; i < n; i++) {
      durations[i] = []
      distances[i] = []
      for (let j = 0; j < n; j++) {
        if (i === j) {
          durations[i][j] = 0
          distances[i][j] = 0
        } else {
          const dist = calcDistMeters(
            pointsList[i].lat,
            pointsList[i].lon,
            pointsList[j].lat,
            pointsList[j].lon
          )
          // Average city speed 30 km/h = 8.33 m/s
          const duration = Math.max(120, Math.round(dist / 8.33))
          distances[i][j] = dist
          durations[i][j] = duration
        }
      }
    }

    return {
      matrix_id: `custom-matrix-${Date.now()}`,
      points,
      durations_sec: durations,
      distances_m: distances,
    }
  }

  // Apply to backend system
  const handleApplyToSystem = async () => {
    setStatusMessage(null)

    try {
      // 1. Send Reference data
      const refRes: any = await loadReference.mutateAsync(dataset)

      // 2. Build and send travel matrix for all generated points
      const matrixPayload = generateMatrixPayload()
      await loadTravelMatrix.mutateAsync(matrixPayload)

      setStatusMessage({
        type: 'success',
        text: `Тестовые данные успешно внедрены в систему! Создано: ${refRes?.data?.counts?.service_centers || dataset.service_centers.length} СЦ, ${refRes?.data?.counts?.buildings || 4} зданий, ${refRes?.data?.counts?.staff || dataset.staff.length} сотрудников. Матрица путей (${matrixPayload.points.length} точек) рассчитана и загружена!`,
      })
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Ошибка загрузки тестовых данных',
      })
    }
  }

  // Download reference.json
  const handleDownloadJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(dataset, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', 'reference.json')
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  const allBuildings = dataset.access_nodes.flatMap((an: any) =>
    an.buildings.map((b: any) => ({ ...b, access_node_id: an.access_node_id }))
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-full max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pr-6">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-6 w-6 text-primary" />
              Поэтапный мастер генерации тестовых данных
            </DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetToDefault}
              className="text-xs gap-1 self-start sm:self-auto"
              title="Восстановить типовой набор Екатеринбурга"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Сброс к эталону
            </Button>
          </div>
          <DialogDescription>
            Настройте тестовую инфраструктуру по шагам (СЦ, узлы, дома, инженеры, типы работ), проверьте JSON и загрузите в систему в один клик.
          </DialogDescription>
        </DialogHeader>

        {statusMessage && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <Tabs value={activeStep} onValueChange={setActiveStep} className="space-y-4">
          <TabsList className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 p-1.5 h-auto bg-muted/70 rounded-lg">
            <TabsTrigger value="sc" className="py-2 px-2 text-xs font-medium">
              1. СЦ ({dataset.service_centers.length})
            </TabsTrigger>
            <TabsTrigger value="an" className="py-2 px-2 text-xs font-medium">
              2. Узлы ({dataset.access_nodes.length})
            </TabsTrigger>
            <TabsTrigger value="buildings" className="py-2 px-2 text-xs font-medium">
              3. Здания ({allBuildings.length})
            </TabsTrigger>
            <TabsTrigger value="staff" className="py-2 px-2 text-xs font-medium">
              4. Сотрудники ({dataset.staff.length})
            </TabsTrigger>
            <TabsTrigger value="work_types" className="py-2 px-2 text-xs font-medium">
              5. Типы работ ({dataset.work_types.length})
            </TabsTrigger>
            <TabsTrigger value="preview" className="py-2 px-2 text-xs font-semibold text-primary">
              6. Применить JSON
            </TabsTrigger>
          </TabsList>

          {/* Step 1: Service Centers */}
          <TabsContent value="sc" className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Сервисные центры (базовые склады)</h3>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Код СЦ</TableHead>
                    <TableHead>Название</TableHead>
                    <TableHead>Адрес</TableHead>
                    <TableHead>Координаты</TableHead>
                    <TableHead>Часы работы</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dataset.service_centers.map((sc, idx) => (
                    <TableRow key={sc.service_center_id}>
                      <TableCell className="font-mono font-bold text-primary">{sc.service_center_id}</TableCell>
                      <TableCell className="font-medium">{sc.name}</TableCell>
                      <TableCell className="text-xs">{sc.address}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{sc.lat}, {sc.lon}</TableCell>
                      <TableCell className="font-mono text-xs">{sc.opening_hours.open} – {sc.opening_hours.close}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Step 2: Access Nodes */}
          <TabsContent value="an" className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Узлы доступа связи (OLT, SWITCH...)</h3>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Код узла</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead>Технология</TableHead>
                    <TableHead>Название</TableHead>
                    <TableHead>Адрес</TableHead>
                    <TableHead>Домов к узлу</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dataset.access_nodes.map((an) => (
                    <TableRow key={an.access_node_id}>
                      <TableCell className="font-mono font-bold text-primary">{an.access_node_id}</TableCell>
                      <TableCell><Badge variant="outline">{an.node_type}</Badge></TableCell>
                      <TableCell><Badge variant="secondary">{an.technology}</Badge></TableCell>
                      <TableCell className="font-medium">{an.name}</TableCell>
                      <TableCell className="text-xs">{an.address}</TableCell>
                      <TableCell><Badge>{an.buildings.length} шт.</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Step 3: Buildings */}
          <TabsContent value="buildings" className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Обслуживаемые здания и адреса</h3>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Код здания</TableHead>
                    <TableHead>Адрес</TableHead>
                    <TableHead>Тип застройки</TableHead>
                    <TableHead>Узел доступа</TableHead>
                    <TableHead>СЦ зоны</TableHead>
                    <TableHead>ВЛС</TableHead>
                    <TableHead>Координаты</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allBuildings.map((b) => (
                    <TableRow key={b.building_id}>
                      <TableCell className="font-mono font-bold text-primary">{b.building_id}</TableCell>
                      <TableCell className="font-medium text-xs">{b.address}</TableCell>
                      <TableCell><Badge variant={b.building_type === 'MKD' ? 'secondary' : 'default'}>{b.building_type}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{b.access_node_id}</TableCell>
                      <TableCell><Badge variant="outline">{b.zone_service_center_id}</Badge></TableCell>
                      <TableCell><Badge variant={b.overhead_line ? 'success' : 'secondary'}>{b.overhead_line ? 'Да' : 'Нет'}</Badge></TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{b.lat}, {b.lon}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Step 4: Staff */}
          <TabsContent value="staff" className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Выездные инженеры и бригады</h3>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Код инженера</TableHead>
                    <TableHead>ФИО</TableHead>
                    <TableHead>Базовый СЦ</TableHead>
                    <TableHead>Смена</TableHead>
                    <TableHead>Профили</TableHead>
                    <TableHead>Технологии</TableHead>
                    <TableHead>Старт АО</TableHead>
                    <TableHead>Вмест. АО</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dataset.staff.map((st) => (
                    <TableRow key={st.staff_id}>
                      <TableCell className="font-mono font-bold text-primary">{st.staff_id}</TableCell>
                      <TableCell className="font-medium">{st.name}</TableCell>
                      <TableCell><Badge variant="outline">{st.service_center_id}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{st.shift.start} – {st.shift.end}</TableCell>
                      <TableCell className="text-xs">{st.profiles.join(', ')}</TableCell>
                      <TableCell className="text-xs">{st.technologies.join(', ')}</TableCell>
                      <TableCell className="font-mono text-xs">{st.equipment_start.ONT}/{st.equipment_start.ROUTER}/{st.equipment_start.STB}</TableCell>
                      <TableCell className="font-mono text-xs">{st.equipment_capacity.ONT}/{st.equipment_capacity.ROUTER}/{st.equipment_capacity.STB}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Step 5: Work Types */}
          <TabsContent value="work_types" className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Нормативные типы работ</h3>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Код</TableHead>
                    <TableHead>Название работы</TableHead>
                    <TableHead>Длительность</TableHead>
                    <TableHead>Дедлайн</TableHead>
                    <TableHead>Профили</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dataset.work_types.map((wt) => (
                    <TableRow key={wt.code}>
                      <TableCell className="font-mono font-bold text-primary">{wt.code}</TableCell>
                      <TableCell className="font-medium text-xs">{wt.name}</TableCell>
                      <TableCell className="font-mono text-xs">{wt.duration_min} мин</TableCell>
                      <TableCell className="text-xs">{wt.deadline_kind} ({wt.deadline_value ?? '—'})</TableCell>
                      <TableCell className="text-xs">{wt.profiles.join(', ')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Step 6: Preview & Apply */}
          <TabsContent value="preview" className="space-y-4">
            <div className="p-4 bg-muted/30 rounded-lg border space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-sm">Сформированный reference.json</h4>
                  <p className="text-xs text-muted-foreground">
                    Готов к прямой загрузке в базу данных через PUT /api/v1/reference
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleDownloadJson} className="gap-1.5 text-xs">
                    <Download className="h-3.5 w-3.5" />
                    Скачать .json
                  </Button>
                </div>
              </div>

              <pre className="bg-slate-950 text-slate-100 p-3 rounded-lg text-[11px] font-mono max-h-56 overflow-y-auto">
                {JSON.stringify(dataset, null, 2)}
              </pre>
            </div>

            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h4 className="font-bold text-sm text-foreground">Загрузка и автоматическая маршрутизация</h4>
              </div>
              <p className="text-xs text-muted-foreground">
                При нажатии кнопка загрузит полный пакет справочников (`PUT /api/v1/reference`), сгенерирует и отправит матрицу расстояний OSRM (`PUT /api/v1/reference/travel-matrix`), восстановив готовность системы к планированию нарядов.
              </p>
              <Button
                onClick={handleApplyToSystem}
                disabled={loadReference.isPending || loadTravelMatrix.isPending}
                className="w-full sm:w-auto shadow-sm"
              >
                {(loadReference.isPending || loadTravelMatrix.isPending) ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Загрузка и расчет матрицы...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Применить тестовые данные в систему
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex items-center justify-between border-t pt-3">
          <div className="flex items-center gap-2">
            {activeStep !== 'sc' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const steps = ['sc', 'an', 'buildings', 'staff', 'work_types', 'preview']
                  const prevIdx = steps.indexOf(activeStep) - 1
                  if (prevIdx >= 0) setActiveStep(steps[prevIdx])
                }}
              >
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                Назад
              </Button>
            )}
            {activeStep !== 'preview' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const steps = ['sc', 'an', 'buildings', 'staff', 'work_types', 'preview']
                  const nextIdx = steps.indexOf(activeStep) + 1
                  if (nextIdx < steps.length) setActiveStep(steps[nextIdx])
                }}
              >
                Далее
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
