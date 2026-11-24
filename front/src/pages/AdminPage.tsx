import React, { useState, useRef } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Settings, Users, Clock, Building2, Radio, Wrench, Database, Sparkles, CheckCircle2, AlertTriangle, Loader2, Upload, FileText, ArrowRight, Wand2 } from 'lucide-react'
import { StaffPage } from './StaffPage'
import { BuildingsPage } from './BuildingsPage'
import { WorkTypesPage } from './WorkTypesPage'
import { useInitReference, useInitTravelMatrix, useLoadReference, useLoadTravelMatrix } from '@/hooks/useApi'
import { TestDataWizardModal } from '@/components/admin/TestDataWizardModal'
import { TestOrdersGeneratorModal } from '@/components/orders/TestOrdersGeneratorModal'
import { SystemStatsCard } from '@/components/admin/SystemStatsCard'
import { useDayStore } from '@/store/dayStore'

export const AdminPage = () => {
  const { currentDate } = useDayStore()
  const [activeTab, setActiveTab] = useState('staff')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [ordersGenOpen, setOrdersGenOpen] = useState(false)
  const [systemMessage, setSystemMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // File Upload states
  const [refFile, setRefFile] = useState<{ name: string; size: number; content: any } | null>(null)
  const [matrixFile, setMatrixFile] = useState<{ name: string; size: number; content: any } | null>(null)
  const [fileError, setFileError] = useState<string>('')

  const refInputRef = useRef<HTMLInputElement>(null)
  const matrixInputRef = useRef<HTMLInputElement>(null)

  const initReference = useInitReference()
  const initTravelMatrix = useInitTravelMatrix()
  const loadReference = useLoadReference()
  const loadTravelMatrix = useLoadTravelMatrix()

  // Handle file select for reference.json
  const handleRefFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError('')
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string
        const parsed = JSON.parse(text)
        if (!parsed.service_centers && !parsed.staff && !parsed.access_nodes && !parsed.work_types) {
          throw new Error('Файл не содержит ожидаемых разделов reference.json (service_centers, staff, access_nodes, work_types)')
        }
        setRefFile({ name: file.name, size: file.size, content: parsed })
      } catch (err: any) {
        setFileError(`Ошибка чтения JSON: ${err.message}`)
        setRefFile(null)
      }
    }
    reader.readAsText(file)
  }

  // Handle file select for travel_matrix.json
  const handleMatrixFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError('')
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string
        const parsed = JSON.parse(text)
        if (!parsed.points || !parsed.durations_sec) {
          throw new Error('Файл не содержит ожидаемых полей travel_matrix.json (points, durations_sec)')
        }
        setMatrixFile({ name: file.name, size: file.size, content: parsed })
      } catch (err: any) {
        setFileError(`Ошибка чтения JSON: ${err.message}`)
        setMatrixFile(null)
      }
    }
    reader.readAsText(file)
  }

  // Send uploaded reference.json to backend
  const handleUploadRef = () => {
    if (!refFile?.content) return
    setSystemMessage(null)

    loadReference.mutate(refFile.content, {
      onSuccess: (res: any) => {
        setSystemMessage({
          type: 'success',
          text: `Справочники из файла "${refFile.name}" успешно загружены в базу! Загружено: СЦ (${res.data?.counts?.service_centers || 0}), Узлов (${res.data?.counts?.access_nodes || 0}), Зданий (${res.data?.counts?.buildings || 0}), Сотрудников (${res.data?.counts?.staff || 0}), Типов работ (${res.data?.counts?.work_types || 0})`,
        })
        setRefFile(null)
        if (refInputRef.current) refInputRef.current.value = ''
      },
      onError: (err: any) => {
        setSystemMessage({
          type: 'error',
          text: err.response?.data?.message || 'Ошибка загрузки справочников из файла',
        })
      },
    })
  }

  // Send uploaded travel_matrix.json to backend
  const handleUploadMatrix = () => {
    if (!matrixFile?.content) return
    setSystemMessage(null)

    loadTravelMatrix.mutate(matrixFile.content, {
      onSuccess: (res: any) => {
        setSystemMessage({
          type: 'success',
          text: `Матрица расстояний из файла "${matrixFile.name}" успешно загружена! Точек: ${res.data?.counts?.points || matrixFile.content.points?.length || 'OK'}`,
        })
        setMatrixFile(null)
        if (matrixInputRef.current) matrixInputRef.current.value = ''
      },
      onError: (err: any) => {
        setSystemMessage({
          type: 'error',
          text: err.response?.data?.message || 'Ошибка загрузки матрицы из файла',
        })
      },
    })
  }

  const handleInitRef = () => {
    setSystemMessage(null)
    initReference.mutate(undefined, {
      onSuccess: (res: any) => {
        setSystemMessage({
          type: 'success',
          text: `Справочники успешно перезагружены! Загружено: СЦ (${res.data?.counts?.service_centers || 0}), Сотрудников (${res.data?.counts?.staff || 0}), Зданий (${res.data?.counts?.buildings || 0}), Узлов (${res.data?.counts?.access_nodes || 0}), Типов работ (${res.data?.counts?.work_types || 0})`,
        })
      },
      onError: (err: any) => {
        setSystemMessage({
          type: 'error',
          text: err.response?.data?.message || 'Ошибка инициализации справочников',
        })
      },
    })
  }

  const handleInitMatrix = () => {
    setSystemMessage(null)
    initTravelMatrix.mutate(undefined, {
      onSuccess: (res: any) => {
        setSystemMessage({
          type: 'success',
          text: `Матрица расстояний и времени успешно рассчитана через OSRM! Точек: ${res.data?.counts?.points || 'OK'}`,
        })
      },
      onError: (err: any) => {
        setSystemMessage({
          type: 'error',
          text: err.response?.data?.message || 'Ошибка расчета матрицы расстояний',
        })
      },
    })
  }

  return (
    <div className="space-y-6">
      {/* Page Header with Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="h-7 w-7 text-primary" />
            Панель администрирования
          </h1>
          <p className="text-muted-foreground">
            Управление нормативно-справочной информацией, сотрудниками, графиками смен, сервисными центрами и узлами связи
          </p>
        </div>

        {/* Action Buttons for test data */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setOrdersGenOpen(true)}
            className="gap-2 border-primary/40 text-primary hover:bg-primary/5"
            title="Сгенерировать тестовые наряды на выбранную дату"
          >
            <Wand2 className="h-4 w-4" />
            Генератор нарядов
          </Button>
          <Button onClick={() => setWizardOpen(true)} className="gap-2 shadow">
            <Sparkles className="h-4 w-4" />
            Мастер тестовых данных
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-1 h-auto p-1 bg-muted/60">
          <TabsTrigger value="staff" className="flex items-center gap-1.5 py-2 text-xs">
            <Users className="h-4 w-4" />
            <span>Сотрудники</span>
          </TabsTrigger>
          <TabsTrigger value="shifts" className="flex items-center gap-1.5 py-2 text-xs">
            <Clock className="h-4 w-4" />
            <span>Графики смен</span>
          </TabsTrigger>
          <TabsTrigger value="service-centers" className="flex items-center gap-1.5 py-2 text-xs">
            <Building2 className="h-4 w-4" />
            <span>Сервисные центры</span>
          </TabsTrigger>
          <TabsTrigger value="access-nodes" className="flex items-center gap-1.5 py-2 text-xs">
            <Radio className="h-4 w-4" />
            <span>Узлы доступа</span>
          </TabsTrigger>
          <TabsTrigger value="buildings" className="flex items-center gap-1.5 py-2 text-xs">
            <Building2 className="h-4 w-4" />
            <span>Здания</span>
          </TabsTrigger>
          <TabsTrigger value="work-types" className="flex items-center gap-1.5 py-2 text-xs">
            <Wrench className="h-4 w-4" />
            <span>Типы работ</span>
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-1.5 py-2 text-xs">
            <Database className="h-4 w-4" />
            <span>Загрузка файлов / OSRM</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Staff */}
        <TabsContent value="staff" className="space-y-4">
          <StaffPage defaultTab="staff" hideTitle />
        </TabsContent>

        {/* Tab 2: Shifts */}
        <TabsContent value="shifts" className="space-y-4">
          <StaffPage defaultTab="shifts" hideTitle />
        </TabsContent>

        {/* Tab 3: Service Centers */}
        <TabsContent value="service-centers" className="space-y-4">
          <BuildingsPage defaultTab="service-centers" hideTitle />
        </TabsContent>

        {/* Tab 4: Access Nodes */}
        <TabsContent value="access-nodes" className="space-y-4">
          <BuildingsPage defaultTab="access-nodes" hideTitle />
        </TabsContent>

        {/* Tab 5: Buildings */}
        <TabsContent value="buildings" className="space-y-4">
          <BuildingsPage defaultTab="buildings" hideTitle />
        </TabsContent>

        {/* Tab 6: Work Types */}
        <TabsContent value="work-types" className="space-y-4">
          <WorkTypesPage hideTitle />
        </TabsContent>

        {/* Tab 7: System Operations & File Uploads (Requirement 2 & 3) */}
        <TabsContent value="system" className="space-y-6">
          {/* Статистика и производительность системы */}
          <SystemStatsCard />

          {systemMessage && (
            <div
              className={`p-4 rounded-lg flex items-center gap-3 text-sm ${
                systemMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {systemMessage.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              )}
              <span>{systemMessage.text}</span>
            </div>
          )}

          {fileError && (
            <div className="p-3 text-xs bg-destructive/10 text-destructive rounded-lg flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>{fileError}</span>
            </div>
          )}

          {/* Section: Upload .JSON files from browser (Requirement 2) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Загрузка файлов конфигурации с компьютера (.json)
              </CardTitle>
              <CardDescription>
                Так как проект запущен в Docker-контейнерах, вы можете выбрать готовые файлы `reference.json` и `travel_matrix.json` со своего компьютера и загрузить их прямо через веб-интерфейс.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Reference JSON Upload */}
                <div className="p-4 border rounded-lg bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      1. Файл справочников (reference.json)
                    </h3>
                    <Badge variant="outline">СЦ, УД, Здания, Персонал</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Выберите JSON-файл со структурой service_centers, staff, access_nodes, work_types.
                  </p>

                  <input
                    ref={refInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleRefFileChange}
                    className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                  />

                  {refFile && (
                    <div className="p-3 bg-background rounded-lg border text-xs space-y-2">
                      <div className="flex items-center justify-between font-mono">
                        <span className="font-semibold text-primary">{refFile.name}</span>
                        <span className="text-muted-foreground">{Math.round(refFile.size / 1024)} КБ</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground pt-1 border-t">
                        <span>СЦ: <strong>{refFile.content.service_centers?.length || 0}</strong></span>
                        <span>Узлов: <strong>{refFile.content.access_nodes?.length || 0}</strong></span>
                        <span>Сотрудников: <strong>{refFile.content.staff?.length || 0}</strong></span>
                        <span>Типов работ: <strong>{refFile.content.work_types?.length || 0}</strong></span>
                      </div>
                      <Button
                        size="sm"
                        onClick={handleUploadRef}
                        disabled={loadReference.isPending}
                        className="w-full mt-2"
                      >
                        {loadReference.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Загрузить reference.json в систему
                      </Button>
                    </div>
                  )}
                </div>

                {/* 2. Travel Matrix JSON Upload */}
                <div className="p-4 border rounded-lg bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Radio className="h-4 w-4 text-primary" />
                      2. Файл матрицы путей (travel_matrix.json)
                    </h3>
                    <Badge variant="outline">Матрица расстояний</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Выберите JSON-файл с точками points, distances_m и durations_sec.
                  </p>

                  <input
                    ref={matrixInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleMatrixFileChange}
                    className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                  />

                  {matrixFile && (
                    <div className="p-3 bg-background rounded-lg border text-xs space-y-2">
                      <div className="flex items-center justify-between font-mono">
                        <span className="font-semibold text-primary">{matrixFile.name}</span>
                        <span className="text-muted-foreground">{Math.round(matrixFile.size / 1024)} КБ</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground pt-1 border-t">
                        <span>Точек в матрице: <strong>{matrixFile.content.points?.length || 0}</strong></span>
                      </div>
                      <Button
                        size="sm"
                        onClick={handleUploadMatrix}
                        disabled={loadTravelMatrix.isPending}
                        className="w-full mt-2"
                      >
                        {loadTravelMatrix.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Загрузить travel_matrix.json в систему
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section: Test Data Generator Wizard card */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2 text-foreground">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Генератор тестовых данных без файлов (Wizard)
                </CardTitle>
                <Button onClick={() => setWizardOpen(true)} size="sm" className="gap-1.5 shadow-sm">
                  <span>Открыть мастер</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              <p>
                Позволяет поэтапно настроить тестовые данные (СЦ, узлы, дома, инженеров со сменами и нормативы работ) в интерактивном окне, скорректировать их перед применением и сразу залить в систему с расчетом матрицы перемещений.
              </p>
            </CardContent>
          </Card>

          {/* Section: Quick Actions / Re-init */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg space-y-3 bg-muted/20">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Повторная инициализация справочников
              </h3>
              <p className="text-xs text-muted-foreground">
                Считывает дефолтный `reference.json` бэкенда и восстанавливает начальные справочные данные.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleInitRef}
                disabled={initReference.isPending}
              >
                {initReference.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Инициализировать справочники
              </Button>
            </div>

            <div className="p-4 border rounded-lg space-y-3 bg-muted/20">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Radio className="h-4 w-4 text-primary" />
                Перерасчет матрицы OSRM роутером
              </h3>
              <p className="text-xs text-muted-foreground">
                Отправляет запросы к локальному роутеру OSRM (порт 5000) для всех пар координат и сохраняет `travel_matrix.json`.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleInitMatrix}
                disabled={initTravelMatrix.isPending}
              >
                {initTravelMatrix.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Вызвать OSRM роутер
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Test Data Wizard Modal */}
      <TestDataWizardModal open={wizardOpen} onOpenChange={setWizardOpen} />

      {/* Test Orders Generator Modal */}
      <TestOrdersGeneratorModal open={ordersGenOpen} onOpenChange={setOrdersGenOpen} targetDate={currentDate} />
    </div>
  )
}
