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
import { Plus, Loader2, Edit, Trash2 } from 'lucide-react'
import { useWorkTypes, useCreateWorkType, useUpdateWorkType, useDeleteWorkType } from '@/hooks/useApi'

// Коды типов работ, совпадающие с enum WorkTypeCode на бэкенде
const WORK_TYPE_CODES = [
  { value: 'INST_PON_MKD', label: 'Инсталляция PON (МКД)' },
  { value: 'INST_FTTB_MKD', label: 'Инсталляция FTTB (МКД)' },
  { value: 'INST_PRIVATE_VLS', label: 'Инсталляция (частный сектор, ВЛС)' },
  { value: 'ADD_SERVICE', label: 'Доп. подключение услуги' },
  { value: 'SURVEY_PRIVATE', label: 'Обследование (частный сектор)' },
  { value: 'REPAIR', label: 'Устранение неисправности' },
  { value: 'DEGRADATION', label: 'Устранение деградации' },
  { value: 'DISMANTLE', label: 'Демонтаж оборудования' },
]

// Препроцессор: пустое поле → undefined (чтобы опциональные поля были реально опциональными)
const optionalNumber = (min: number) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : Number(v)),
    z.number().min(min).optional().nullable()
  )

const workTypeSchema = z.object({
  code: z.string().min(1, 'Код обязателен'),
  name: z.string().min(1, 'Название обязательно'),
  duration_min: z.preprocess(
    (v) => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : Number(v)),
    z.number().min(1, 'Длительность должна быть > 0')
  ),
  max_start_delay_min: optionalNumber(0),
  deadline_kind: z.enum(['WORKING_DAYS', 'HOURS', 'SLOT']),
  deadline_value: optionalNumber(1),
  repeat_deadline_value: optionalNumber(1),
  pgp_relevant: z.boolean().default(false),
  profiles: z.array(z.string()).default([]),
})

type WorkTypeForm = z.infer<typeof workTypeSchema>

const PROFILES = ['INSTALL', 'LTP3']
const DEADLINE_KINDS = ['WORKING_DAYS', 'HOURS', 'SLOT']

interface WorkTypesPageProps {
  hideTitle?: boolean
}

export const WorkTypesPage = ({ hideTitle = false }: WorkTypesPageProps) => {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingWt, setEditingWt] = useState<any>(null)

  const { data: workTypes, isLoading, refetch } = useWorkTypes()
  const createWorkType = useCreateWorkType()
  const updateWorkType = useUpdateWorkType()
  const deleteWorkType = useDeleteWorkType()

  const form = useForm<WorkTypeForm>({
    resolver: zodResolver(workTypeSchema),
    defaultValues: {
      code: '',
      name: '',
      duration_min: 60,
      max_start_delay_min: 10,
      deadline_kind: 'WORKING_DAYS',
      deadline_value: 3,
      repeat_deadline_value: null,
      pgp_relevant: false,
      profiles: ['INSTALL'],
    },
  })

  const openCreate = () => {
    setEditingWt(null)
    form.reset({ code: '', name: '', duration_min: 60, max_start_delay_min: 10, deadline_kind: 'WORKING_DAYS', deadline_value: 3, repeat_deadline_value: null, pgp_relevant: false, profiles: ['INSTALL'] })
    setDialogOpen(true)
  }

  const openEdit = (wt: any) => {
    setEditingWt(wt)
    form.reset({
      code: wt.code,
      name: wt.name,
      duration_min: wt.duration_min ?? wt.durationMin ?? 60,
      max_start_delay_min: wt.max_start_delay_min ?? wt.maxStartDelayMin ?? null,
      deadline_kind: wt.deadline_kind ?? wt.deadlineKind ?? 'WORKING_DAYS',
      deadline_value: wt.deadline_value ?? wt.deadlineValue ?? null,
      repeat_deadline_value: wt.repeat_deadline_value ?? wt.repeatDeadlineValue ?? null,
      pgp_relevant: wt.pgp_relevant ?? wt.pgpRelevant ?? false,
      profiles: wt.profiles || [],
    })
    setDialogOpen(true)
  }

  const onSubmit = (data: WorkTypeForm) => {
    // Пустые опциональные поля отправляем как null, заполненные — как число
    const payload: any = {
      code: data.code,
      name: data.name,
      duration_min: data.duration_min,
      max_start_delay_min: data.max_start_delay_min ?? null,
      deadline_kind: data.deadline_kind,
      deadline_value: data.deadline_value ?? null,
      repeat_deadline_value: data.repeat_deadline_value ?? null,
      pgp_relevant: data.pgp_relevant,
      profiles: data.profiles,
    }

    const onSuccess = () => { setDialogOpen(false); refetch() }
    const onError = (err: any) => {
      const msg = err.response?.data?.message || 'Ошибка сохранения типа работ'
      form.setError('root', { message: msg })
    }

    if (editingWt) {
      updateWorkType.mutate({ id: editingWt.id, data: payload }, { onSuccess, onError })
    } else {
      createWorkType.mutate(payload, { onSuccess, onError })
    }
  }

  const handleDelete = (wt: any) => {
    if (!window.confirm(`Удалить тип работ "${wt.name}"?`)) return
    deleteWorkType.mutate(wt.id, { onSuccess: () => refetch() })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {!hideTitle ? (
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Типы работ</h1>
            <p className="text-muted-foreground">Справочник нормативных работ со сроками выполнения и требуемыми квалификациями</p>
          </div>
        ) : <div />}
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Добавить тип работ
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Список типов работ ({workTypes?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Код</TableHead>
                  <TableHead>Название</TableHead>
                  <TableHead>Длительность (мин)</TableHead>
                  <TableHead>Макс задержка</TableHead>
                  <TableHead>Дедлайн</TableHead>
                  <TableHead>Значение</TableHead>
                  <TableHead>Повтор</TableHead>
                  <TableHead>PGP</TableHead>
                  <TableHead>Профили</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workTypes?.map((wt: any) => {
                  const durationMin = wt.duration_min ?? wt.durationMin ?? '—'
                  const maxDelay = wt.max_start_delay_min ?? wt.maxStartDelayMin ?? '-'
                  const deadlineKind = wt.deadline_kind ?? wt.deadlineKind ?? '—'
                  const deadlineValue = wt.deadline_value ?? wt.deadlineValue ?? '-'
                  const repeatValue = wt.repeat_deadline_value ?? wt.repeatDeadlineValue ?? '-'
                  const pgpRelevant = wt.pgp_relevant ?? wt.pgpRelevant ?? false
                  const profiles = wt.profiles ?? []

                  return (
                    <TableRow key={wt.id}>
                      <TableCell className="font-mono font-medium">{wt.code}</TableCell>
                      <TableCell className="max-w-[300px] truncate">{wt.name}</TableCell>
                      <TableCell>{durationMin}</TableCell>
                      <TableCell>{maxDelay}</TableCell>
                      <TableCell><Badge variant="secondary">{deadlineKind}</Badge></TableCell>
                      <TableCell>{deadlineValue}</TableCell>
                      <TableCell>{repeatValue}</TableCell>
                      <TableCell><Badge variant={pgpRelevant ? 'destructive' : 'default'}>{pgpRelevant ? 'Да' : 'Нет'}</Badge></TableCell>
                      <TableCell>{profiles.join(', ') || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(wt)} title="Редактировать"><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(wt)} title="Удалить"><Trash2 className="h-4 w-4" /></Button>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingWt ? 'Редактировать тип работ' : 'Создать тип работ'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4">
            {form.formState.errors.root && (
              <div className="p-3 text-xs bg-destructive/10 text-destructive rounded-lg">
                {form.formState.errors.root.message}
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Код</Label>
                <Select
                  value={form.watch('code')}
                  onValueChange={(v) => form.setValue('code', v, { shouldValidate: true })}
                  disabled={!!editingWt}
                >
                  <SelectTrigger><SelectValue placeholder="Выберите код" /></SelectTrigger>
                  <SelectContent>
                    {WORK_TYPE_CODES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.value} — {c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Название</Label><Input {...form.register('name')} placeholder="Инсталляция ШПД/IPTV, МКД, PON" /></div>
              <div className="space-y-2"><Label>Длительность (мин)</Label><Input type="number" {...form.register('duration_min')} /></div>
              <div className="space-y-2"><Label>Макс. задержка старта (мин) — опц.</Label><Input type="number" {...form.register('max_start_delay_min')} placeholder="Опционально" /></div>
              <div className="space-y-2">
                <Label>Тип дедлайна</Label>
                <Select value={form.watch('deadline_kind')} onValueChange={(v) => form.setValue('deadline_kind', v as any)}>
                  <SelectTrigger><SelectValue placeholder="Тип" /></SelectTrigger>
                  <SelectContent>{DEADLINE_KINDS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Значение дедлайна — опц.</Label><Input type="number" {...form.register('deadline_value')} placeholder="Опционально" /></div>
              <div className="space-y-2"><Label>Значение для повторных — опц.</Label><Input type="number" {...form.register('repeat_deadline_value')} placeholder="Опционально" /></div>
              <div className="space-y-2 flex items-end"><Label>PGP релевантен</Label><Input type="checkbox" {...form.register('pgp_relevant')} /></div>
            </div>
            <div className="space-y-2">
              <Label>Профили</Label>
              <div className="flex flex-wrap gap-2">
                {PROFILES.map(p => (
                  <label key={p} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" {...form.register('profiles')} value={p} />
                    <span>{p}</span>
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Отмена</Button>
              <Button type="submit" disabled={createWorkType.isPending || updateWorkType.isPending}>
                {editingWt ? 'Сохранить' : 'Создать'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}