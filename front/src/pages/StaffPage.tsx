import { useState } from 'react'
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
import { Plus, Search, Loader2, Edit, Trash2, User, Clock, AlertTriangle } from 'lucide-react'
import { useStaff, useCreateStaff, useUpdateStaff, useDeleteStaff, useShifts, useCreateShift, useUpdateShift, useDeleteShift, useServiceCenters } from '@/hooks/useApi'
import { cn } from '@/utils/cn'

const staffSchema = z.object({
  staffId: z.string().min(1, 'Код обязателен'),
  displayName: z.string().min(1, 'Имя обязательно'),
  serviceCenterId: z.string().min(1, 'Сервисный центр обязателен'),
  shiftId: z.string().optional(),
  heightPermit: z.boolean().default(false),
  experienceYears: z.coerce.number().min(0).default(0),
  equipmentStart: z.object({
    ONT: z.coerce.number().min(0).default(0),
    ROUTER: z.coerce.number().min(0).default(0),
    STB: z.coerce.number().min(0).default(0),
  }),
  equipmentCapacity: z.object({
    ONT: z.coerce.number().min(0).default(0),
    ROUTER: z.coerce.number().min(0).default(0),
    STB: z.coerce.number().min(0).default(0),
  }),
  profiles: z.array(z.string()).default([]),
  technologies: z.array(z.string()).default([]),
})

const shiftSchema = z.object({
  startTime: z.string().min(1, 'Начало смены обязательно'),
  endTime: z.string().min(1, 'Конец смены обязателен'),
  breakDurationMin: z.coerce.number().min(0).default(60),
  breakWindowFrom: z.string().min(1, 'Окно перерыва от обязательно'),
  breakWindowTo: z.string().min(1, 'Окно перерыва до обязательно'),
})

type StaffForm = z.infer<typeof staffSchema>
type ShiftForm = z.infer<typeof shiftSchema>

const PROFILES = ['INSTALL', 'LTP3']
const TECHNOLOGIES = ['PON', 'FTTB', 'XDSL', 'DOCSIS']

interface StaffPageProps {
  defaultTab?: string
  hideTitle?: boolean
}

export const StaffPage = ({ defaultTab = 'staff', hideTitle = false }: StaffPageProps) => {
  const [search, setSearch] = useState('')
  const [profileFilter, setProfileFilter] = useState('')
  const [techFilter, setTechFilter] = useState('')
  const [scFilter, setScFilter] = useState('')
  const [activeTab, setActiveTab] = useState<string>(defaultTab)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<any>(null)
  const [editingShift, setEditingShift] = useState<any>(null)
  const [dialogError, setDialogError] = useState<string>('')

  const { data: staff = [], isLoading: staffLoading, refetch: refetchStaff } = useStaff()
  const { data: shifts = [], isLoading: shiftsLoading, refetch: refetchShifts } = useShifts()
  const { data: serviceCenters = [] } = useServiceCenters()

  const createStaff = useCreateStaff()
  const updateStaff = useUpdateStaff()
  const deleteStaff = useDeleteStaff()
  const createShift = useCreateShift()
  const updateShift = useUpdateShift()
  const deleteShift = useDeleteShift()

  const staffForm = useForm<StaffForm>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      staffId: '',
      displayName: '',
      serviceCenterId: '',
      shiftId: '',
      heightPermit: false,
      experienceYears: 0,
      equipmentStart: { ONT: 0, ROUTER: 0, STB: 0 },
      equipmentCapacity: { ONT: 0, ROUTER: 0, STB: 0 },
      profiles: [],
      technologies: [],
    },
  })

  const shiftForm = useForm<ShiftForm>({
    resolver: zodResolver(shiftSchema),
    defaultValues: {
      startTime: '08:00',
      endTime: '17:00',
      breakDurationMin: 60,
      breakWindowFrom: '12:00',
      breakWindowTo: '14:00',
    },
  })

  const openCreateStaff = () => {
    setEditingStaff(null)
    setDialogError('')
    staffForm.reset({
      staffId: '',
      displayName: '',
      serviceCenterId: serviceCenters[0]?.id || '',
      shiftId: shifts[0]?.id || '',
      heightPermit: false,
      experienceYears: 0,
      equipmentStart: { ONT: 4, ROUTER: 2, STB: 2 },
      equipmentCapacity: { ONT: 6, ROUTER: 4, STB: 4 },
      profiles: ['INSTALL'],
      technologies: ['PON', 'FTTB'],
    })
    setDialogOpen(true)
  }

  const openEditStaff = (s: any) => {
    setEditingStaff(s)
    setDialogError('')
    staffForm.reset({
      staffId: s.staff_id || s.code || s.staffId || '',
      displayName: s.display_name || s.displayName || '',
      serviceCenterId: s.service_center_id || s.serviceCenterId || '',
      shiftId: s.shift_id || s.shiftId || '',
      heightPermit: s.height_permit ?? s.heightPermit ?? false,
      experienceYears: s.experience_years ?? s.experienceYears ?? 0,
      equipmentStart: s.equipment_start || {
        ONT: s.equipmentStartOnt ?? 0,
        ROUTER: s.equipmentStartRouter ?? 0,
        STB: s.equipmentStartStb ?? 0,
      },
      equipmentCapacity: s.equipment_capacity || {
        ONT: s.equipmentCapacityOnt ?? 0,
        ROUTER: s.equipmentCapacityRouter ?? 0,
        STB: s.equipmentCapacityStb ?? 0,
      },
      profiles: s.profiles || [],
      technologies: s.technologies || [],
    })
    setDialogOpen(true)
  }

  const onStaffSubmit = (data: StaffForm) => {
    setDialogError('')
    const payload = {
      staff_id: data.staffId,
      display_name: data.displayName,
      service_center_id: data.serviceCenterId,
      shift_id: data.shiftId || undefined,
      height_permit: data.heightPermit,
      experience_years: data.experienceYears,
      equipment_start: data.equipmentStart,
      equipment_capacity: data.equipmentCapacity,
      profiles: data.profiles,
      technologies: data.technologies,
    }

    if (editingStaff) {
      updateStaff.mutate(
        { id: editingStaff.id, data: payload },
        {
          onSuccess: () => {
            setDialogOpen(false)
            refetchStaff()
          },
          onError: (err: any) => {
            setDialogError(err.response?.data?.message || 'Ошибка обновления сотрудника')
          },
        }
      )
    } else {
      createStaff.mutate(payload, {
        onSuccess: () => {
          setDialogOpen(false)
          refetchStaff()
        },
        onError: (err: any) => {
          setDialogError(err.response?.data?.message || 'Ошибка создания сотрудника')
        },
      })
    }
  }

  const onShiftSubmit = (data: ShiftForm) => {
    setDialogError('')
    const payload = {
      start: data.startTime,
      end: data.endTime,
      break_duration_min: data.breakDurationMin,
      break_window: { from: data.breakWindowFrom, to: data.breakWindowTo },
    }
    const onSuccess = () => { setDialogOpen(false); setEditingShift(null); refetchShifts() }
    const onError = (err: any) => setDialogError(err.response?.data?.message || 'Ошибка сохранения смены')

    if (editingShift) {
      updateShift.mutate({ id: editingShift.id, data: payload }, { onSuccess, onError })
    } else {
      createShift.mutate(payload, { onSuccess, onError })
    }
  }

  const openEditShift = (sh: any) => {
    setEditingShift(sh)
    setDialogError('')
    shiftForm.reset({
      startTime: sh.start || sh.startTime || '08:00',
      endTime: sh.end || sh.endTime || '17:00',
      breakDurationMin: sh.break_duration_min ?? sh.breakDurationMin ?? 60,
      breakWindowFrom: sh.break_window?.from ?? sh.breakWindowFrom ?? '12:00',
      breakWindowTo: sh.break_window?.to ?? sh.breakWindowTo ?? '14:00',
    })
    setDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {!hideTitle ? (
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Сотрудники и смены</h1>
            <p className="text-muted-foreground">Управление персоналом выездных инженеров и рабочими сменами</p>
          </div>
        ) : <div />}
        {activeTab === 'staff' && (
          <Button onClick={openCreateStaff}>
            <Plus className="mr-2 h-4 w-4" />
            Добавить сотрудника
          </Button>
        )}
        {activeTab === 'shifts' && (
          <Button onClick={() => {
            setDialogError('')
            setEditingShift(null)
            shiftForm.reset({ startTime: '08:00', endTime: '17:00', breakDurationMin: 60, breakWindowFrom: '12:00', breakWindowTo: '14:00' })
            setDialogOpen(true)
          }}>
            <Plus className="mr-2 h-4 w-4" />
            Добавить смену
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {!hideTitle && (
          <TabsList>
            <TabsTrigger value="staff"><User className="mr-2 h-4 w-4" />Сотрудники ({staff.length})</TabsTrigger>
            <TabsTrigger value="shifts"><Clock className="mr-2 h-4 w-4" />Смены ({shifts.length})</TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="staff">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle>Список сотрудников ({staff.length})</CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    placeholder="Поиск по коду/имени..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-64 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <Select value={profileFilter} onValueChange={setProfileFilter}>
                    <SelectTrigger className="w-[140px]"><SelectValue placeholder="Профиль" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Все профили</SelectItem>
                      {PROFILES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={techFilter} onValueChange={setTechFilter}>
                    <SelectTrigger className="w-[140px]"><SelectValue placeholder="Технология" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Все технологии</SelectItem>
                      {TECHNOLOGIES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={scFilter} onValueChange={setScFilter}>
                    <SelectTrigger className="w-[160px]"><SelectValue placeholder="СЦ" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Все СЦ</SelectItem>
                      {serviceCenters.map((sc: any) => {
                        const scCode = sc.service_center_id || sc.code
                        return <SelectItem key={sc.id} value={sc.id}>{scCode}</SelectItem>
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {staffLoading ? (
                <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : staff.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">Сотрудники не найдены.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Код инженера</TableHead>
                        <TableHead>ФИО сотрудника</TableHead>
                        <TableHead>Базовый СЦ</TableHead>
                        <TableHead>Смена</TableHead>
                        <TableHead>Профили</TableHead>
                        <TableHead>Технологии</TableHead>
                        <TableHead>Высота (ВЛС)</TableHead>
                        <TableHead>Опыт</TableHead>
                        <TableHead>Старт АО (О/Р/С)</TableHead>
                        <TableHead>Вмест. АО (О/Р/С)</TableHead>
                        <TableHead>Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staff.filter((s: any) => {
                        const code = s.staff_id || s.code || ''
                        const name = s.display_name || s.displayName || ''
                        const scId = s.service_center_id || s.serviceCenterId || ''

                        const matchesSearch = !search || code.toLowerCase().includes(search.toLowerCase()) || name.toLowerCase().includes(search.toLowerCase())
                        const matchesProfile = !profileFilter || profileFilter === 'ALL' || s.profiles?.includes(profileFilter)
                        const matchesTech = !techFilter || techFilter === 'ALL' || s.technologies?.includes(techFilter)
                        const matchesSc = !scFilter || scFilter === 'ALL' || scId === scFilter

                        return matchesSearch && matchesProfile && matchesTech && matchesSc
                      }).map((s: any) => {
                        const staffCode = s.staff_id || s.code || s.staffId
                        const staffName = s.display_name || s.displayName || '—'
                        const scCode = s.service_center_code || serviceCenters.find((sc: any) => sc.id === (s.service_center_id || s.serviceCenterId))?.service_center_id || serviceCenters.find((sc: any) => sc.id === (s.service_center_id || s.serviceCenterId))?.code || '—'
                        const shiftInfo = s.shift ? `${s.shift.start} – ${s.shift.end}` : (shifts.find((sh: any) => sh.id === (s.shift_id || s.shiftId)) ? `${shifts.find((sh: any) => sh.id === (s.shift_id || s.shiftId)).start} – ${shifts.find((sh: any) => sh.id === (s.shift_id || s.shiftId)).end}` : '—')
                        const heightPermit = s.height_permit ?? s.heightPermit ?? false
                        const expYears = s.experience_years ?? s.experienceYears ?? 0
                        const eqStart = s.equipment_start ? `${s.equipment_start.ONT ?? 0}/${s.equipment_start.ROUTER ?? 0}/${s.equipment_start.STB ?? 0}` : `${s.equipmentStartOnt ?? 0}/${s.equipmentStartRouter ?? 0}/${s.equipmentStartStb ?? 0}`
                        const eqCap = s.equipment_capacity ? `${s.equipment_capacity.ONT ?? 0}/${s.equipment_capacity.ROUTER ?? 0}/${s.equipment_capacity.STB ?? 0}` : `${s.equipmentCapacityOnt ?? 0}/${s.equipmentCapacityRouter ?? 0}/${s.equipmentCapacityStb ?? 0}`

                        return (
                          <TableRow key={s.id}>
                            <TableCell className="font-mono font-semibold text-primary">{staffCode}</TableCell>
                            <TableCell className="font-medium">{staffName}</TableCell>
                            <TableCell><Badge variant="outline">{scCode}</Badge></TableCell>
                            <TableCell className="font-mono text-xs">{shiftInfo}</TableCell>
                            <TableCell className="text-xs">{s.profiles?.join(', ') || '—'}</TableCell>
                            <TableCell className="text-xs">{s.technologies?.join(', ') || '—'}</TableCell>
                            <TableCell>
                              <Badge variant={heightPermit ? 'success' : 'secondary'}>
                                {heightPermit ? 'Есть' : 'Нет'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{expYears} г.</TableCell>
                            <TableCell className="font-mono text-xs bg-slate-50 text-center rounded">{eqStart}</TableCell>
                            <TableCell className="font-mono text-xs bg-slate-50 text-center rounded">{eqCap}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openEditStaff(s)} title="Редактировать"><Edit className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteStaff.mutate(s.id, { onSuccess: () => refetchStaff() })} title="Удалить"><Trash2 className="h-4 w-4" /></Button>
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

        <TabsContent value="shifts">
          <Card>
            <CardHeader><CardTitle>Графики смен ({shifts.length})</CardTitle></CardHeader>
            <CardContent>
              {shiftsLoading ? (
                <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : shifts.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">Графики смен не найдены.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Начало смены</TableHead>
                      <TableHead>Окончание смены</TableHead>
                      <TableHead>Перерыв (мин)</TableHead>
                      <TableHead>Окно перерыва (с - по)</TableHead>
                      <TableHead>ID смены</TableHead>
                      <TableHead className="text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shifts.map((sh: any) => {
                      const shStart = sh.start || sh.startTime || '—'
                      const shEnd = sh.end || sh.endTime || '—'
                      const shBreak = sh.break_duration_min ?? sh.breakDurationMin ?? 60
                      const windowFrom = sh.break_window?.from || sh.breakWindowFrom || '—'
                      const windowTo = sh.break_window?.to || sh.breakWindowTo || '—'

                      return (
                        <TableRow key={sh.id}>
                          <TableCell className="font-mono font-semibold text-sm">{shStart}</TableCell>
                          <TableCell className="font-mono font-semibold text-sm">{shEnd}</TableCell>
                          <TableCell><Badge variant="outline">{shBreak} мин</Badge></TableCell>
                          <TableCell className="font-mono text-sm">{windowFrom} – {windowTo}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{sh.id.slice(0, 8)}...</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditShift(sh)} title="Редактировать смену"><Edit className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteShift.mutate(sh.id, { onSuccess: () => refetchShifts() })} title="Удалить смену"><Trash2 className="h-4 w-4" /></Button>
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

      {/* Staff Dialog */}
      <Dialog open={dialogOpen && activeTab === 'staff'} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingStaff ? 'Редактировать сотрудника' : 'Добавить инженера'}</DialogTitle>
          </DialogHeader>
          {dialogError && (
            <div className="p-3 text-xs bg-destructive/10 text-destructive rounded-lg flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>{dialogError}</span>
            </div>
          )}
          <form onSubmit={staffForm.handleSubmit(onStaffSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Код сотрудника (напр. TECH-01)</Label>
                <Input {...staffForm.register('staffId')} placeholder="TECH-01" />
              </div>
              <div className="space-y-1">
                <Label>ФИО сотрудника</Label>
                <Input {...staffForm.register('displayName')} placeholder="Иванов И.И." />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Базовый Сервисный Центр</Label>
                <Select
                  value={staffForm.watch('serviceCenterId')}
                  onValueChange={(val) => staffForm.setValue('serviceCenterId', val)}
                >
                  <SelectTrigger><SelectValue placeholder="Выберите СЦ" /></SelectTrigger>
                  <SelectContent>
                    {serviceCenters.map((sc: any) => (
                      <SelectItem key={sc.id} value={sc.id}>{sc.service_center_id || sc.code} ({sc.name})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>График смены</Label>
                <Select
                  value={staffForm.watch('shiftId')}
                  onValueChange={(val) => staffForm.setValue('shiftId', val)}
                >
                  <SelectTrigger><SelectValue placeholder="Выберите смену" /></SelectTrigger>
                  <SelectContent>
                    {shifts.map((sh: any) => (
                      <SelectItem key={sh.id} value={sh.id}>
                        {sh.start || sh.startTime} – {sh.end || sh.endTime} (обед {sh.break_duration_min || sh.breakDurationMin}м)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Опыт работы (лет)</Label>
                <Input type="number" step="0.5" {...staffForm.register('experienceYears')} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="heightPermit"
                  checked={staffForm.watch('heightPermit')}
                  onChange={(e) => staffForm.setValue('heightPermit', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <Label htmlFor="heightPermit" className="cursor-pointer">Допуск к работам на высоте (ВЛС)</Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Отмена</Button>
              <Button type="submit" disabled={createStaff.isPending || updateStaff.isPending}>Сохранить</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Shift Dialog */}
      <Dialog open={dialogOpen && activeTab === 'shifts'} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingShift ? 'Редактировать рабочую смену' : 'Добавить рабочую смену'}</DialogTitle>
          </DialogHeader>
          {dialogError && (
            <div className="p-3 text-xs bg-destructive/10 text-destructive rounded-lg flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>{dialogError}</span>
            </div>
          )}
          <form onSubmit={shiftForm.handleSubmit(onShiftSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Начало (ЧЧ:ММ)</Label>
                <Input {...shiftForm.register('startTime')} placeholder="08:00" />
              </div>
              <div className="space-y-1">
                <Label>Окончание (ЧЧ:ММ)</Label>
                <Input {...shiftForm.register('endTime')} placeholder="17:00" />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Длительность перерыва (мин)</Label>
              <Input type="number" {...shiftForm.register('breakDurationMin')} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Окно обеда от</Label>
                <Input {...shiftForm.register('breakWindowFrom')} placeholder="12:00" />
              </div>
              <div className="space-y-1">
                <Label>Окно обеда до</Label>
                <Input {...shiftForm.register('breakWindowTo')} placeholder="14:00" />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Отмена</Button>
              <Button type="submit" disabled={createShift.isPending || updateShift.isPending}>
                {editingShift ? 'Сохранить' : 'Добавить смену'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
