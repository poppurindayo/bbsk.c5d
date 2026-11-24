package io.github.bbsk.c5d.service

import io.github.bbsk.c5d.exception.NotFoundException
import io.github.bbsk.c5d.model.day.entity.WorkDay
import io.github.bbsk.c5d.model.day.enums.OrderStatus
import io.github.bbsk.c5d.model.plan.dto.response.*
import io.github.bbsk.c5d.model.plan.entity.Alert
import io.github.bbsk.c5d.model.plan.entity.Route
import io.github.bbsk.c5d.model.plan.entity.RouteStop
import io.github.bbsk.c5d.model.plan.entity.UnassignedOrder
import io.github.bbsk.c5d.model.plan.enums.*
import io.github.bbsk.c5d.model.solver.dto.*
import io.github.bbsk.c5d.repository.*
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.util.UUID

@Service
class PlanService(
    private val workDayRepository: WorkDayRepository,
    private val workOrderRepository: WorkOrderRepository,
    private val staffRepository: StaffRepository,
    private val serviceCenterRepository: ServiceCenterRepository,
    private val routeRepository: RouteRepository,
    private val routeStopRepository: RouteStopRepository,
    private val unassignedOrderRepository: UnassignedOrderRepository,
    private val pgpGroupRepository: PgpGroupRepository,
    private val alertRepository: AlertRepository,
    private val pgpDetectorService: PgpDetectorService,
    private val solverClient: SolverClient
) {

    @Transactional
    fun calculatePlan(
        targetDate: LocalDate,
        frozenStopsByStaffCode: Map<String, List<SolverFrozenStopDto>> = emptyMap()
    ): PlanResponse {
        val day = workDayRepository.findByDate(targetDate)
            ?: throw NotFoundException("DAY_NOT_FOUND", "Рабочий день на дату '$targetDate' не найден")

        val allOrders = workOrderRepository.findAllByDayId(day.id)

        // ВАЖНО: перед детекцией ПГП удаляем старые PGP-группы И алерты дня. Их коды детерминированы
        // (PGP-<дата>-<узел>-N и ALT-PGP-...), а pgpDetector создаёт новые с теми же кодами. Без
        // предварительного удаления существующие строки вызывают нарушение уникальных ограничений
        // pgp_group_code_key и alert_code_key при flush.
        val existingPgpGroups = pgpGroupRepository.findAllByDayId(day.id)
        if (existingPgpGroups.isNotEmpty()) {
            pgpGroupRepository.deleteAll(existingPgpGroups)
        }
        val existingAlerts = alertRepository.findAllByDayId(day.id)
        if (existingAlerts.isNotEmpty()) {
            alertRepository.deleteAll(existingAlerts)
        }
        if (existingPgpGroups.isNotEmpty() || existingAlerts.isNotEmpty()) {
            alertRepository.flush()
        }

        // 1. Детекция ПГП (H9)
        val pgpResult = pgpDetectorService.detect(day, allOrders, day.currentNow)
        if (pgpResult.groups.isNotEmpty()) {
            pgpGroupRepository.saveAll(pgpResult.groups)
            alertRepository.saveAll(pgpResult.alerts)
        }
        val affectedOrderIds = pgpResult.affectedOrders.map { it.id }.toSet()

        // 2. Формирование пула для солвера: исключаем заказы из ПГП и отмененные
        val eligibleOrders = allOrders.filter { order ->
            order.status != OrderStatus.CANCELLED && order.id !in affectedOrderIds
        }

        // 3. Активные сотрудники (исключая absent_staff)
        val absentIds = day.absentStaff.map { it.id }.toSet()
        val activeStaff = staffRepository.findAll().filter { it.id !in absentIds }

        // 4. Сервисные центры
        val serviceCenters = serviceCenterRepository.findAll()

        // Маппинг для обратного сопоставления
        val staffByCode = activeStaff.associateBy { it.code }
        val orderByCode = eligibleOrders.associateBy { it.code }

        // Построение SolverRequestDto
        val solverRequest = SolverRequestDto(
            date = day.date.format(DateTimeFormatter.ISO_DATE),
            now = day.currentNow,
            serviceCenters = serviceCenters.map { sc ->
                SolverServiceCenterDto(
                    id = sc.code,
                    buildingId = sc.code,
                    openFrom = sc.openTime.toString().substring(0, 5),
                    openTo = sc.closeTime.toString().substring(0, 5),
                    restockDurationMin = sc.restockDurationMin
                )
            },
            staff = activeStaff.map { st ->
                SolverStaffDto(
                    staffId = st.code,
                    serviceCenterId = st.serviceCenter.code,
                    profiles = st.profiles.map { it.name },
                    technologies = st.technologies.map { it.name },
                    heightPermit = st.heightPermit,
                    shift = SolverShiftDto(
                        start = st.shift.startTime.toString().substring(0, 5),
                        end = st.shift.endTime.toString().substring(0, 5),
                        breakDurationMin = st.shift.breakDurationMin,
                        breakWindow = SolverBreakWindowDto(
                            from = st.shift.breakWindowFrom.toString().substring(0, 5),
                            to = st.shift.breakWindowTo.toString().substring(0, 5)
                        )
                    ),
                    equipmentStart = mapOf(
                        "ONT" to st.equipmentStartOnt,
                        "ROUTER" to st.equipmentStartRouter,
                        "STB" to st.equipmentStartStb
                    ),
                    equipmentCapacity = mapOf(
                        "ONT" to st.equipmentCapacityOnt,
                        "ROUTER" to st.equipmentCapacityRouter,
                        "STB" to st.equipmentCapacityStb
                    ),
                    frozenStops = frozenStopsByStaffCode[st.code] ?: emptyList()
                )
            },
            orders = eligibleOrders.map { ord ->
                SolverOrderDto(
                    orderId = ord.code,
                    buildingId = ord.building.code,
                    workType = ord.workType.code.name,
                    profiles = ord.workType.profiles.map { it.name },
                    technology = ord.building.accessNode.technology.name,
                    requiresHeight = ord.building.overheadLine,
                    durationMin = ord.workType.durationMin,
                    slot = SolverSlotDto(start = ord.slotStart, end = ord.slotEnd),
                    latestStart = ord.latestStart,
                    deadline = ord.deadline,
                    requiredEquipment = mapOf(
                        "ONT" to ord.requiredOnt,
                        "ROUTER" to ord.requiredRouter,
                        "STB" to ord.requiredStb
                    ),
                    isRepeat = ord.isRepeat
                )
            }
        )

        // 5. Вызов Python Solver
        val solverResponse = solverClient.optimize(solverRequest)

        // 6. Очистка старых маршрутов, нераспределенных заказов и алертов опоздания дня с принудительным flush
        val existingRoutes = routeRepository.findAllByDayId(day.id)
        routeRepository.deleteAll(existingRoutes)
        routeRepository.flush()

        val existingUnassigned = unassignedOrderRepository.findAllByDayId(day.id)
        unassignedOrderRepository.deleteAll(existingUnassigned)
        unassignedOrderRepository.flush()

        // 7. Сохранение результатов оптимизации
        val savedRoutes = mutableListOf<Route>()
        val lateRiskAlerts = mutableListOf<Alert>()
        var assignedOrdersCount = 0

        for (routeDto in solverResponse.routes) {
            val staff = staffByCode[routeDto.staffId] ?: continue
            val route = Route(
                day = day,
                staff = staff,
                serviceCenter = staff.serviceCenter,
                status = RouteStatus.ACTIVE
            )

            for (stopDto in routeDto.stops) {
                val stopType = try { StopType.valueOf(stopDto.type) } catch (_: Exception) { StopType.VISIT }
                val order = if (stopDto.orderId != null) orderByCode[stopDto.orderId] else null

                val routeStop = RouteStop(
                    route = route,
                    seq = stopDto.seq,
                    type = stopType,
                    locationCode = stopDto.buildingId.take(255),
                    order = order,
                    arrival = stopDto.arrival,
                    startTime = stopDto.start,
                    endTime = stopDto.end,
                    travelSec = stopDto.travelSec,
                    status = StopStatus.PLANNED,
                    equipmentAfterOnt = stopDto.equipmentAfter["ONT"],
                    equipmentAfterRouter = stopDto.equipmentAfter["ROUTER"],
                    equipmentAfterStb = stopDto.equipmentAfter["STB"]
                )
                route.stops.add(routeStop)

                if (order != null) {
                    order.status = OrderStatus.ASSIGNED
                    workOrderRepository.save(order)
                    assignedOrdersCount++

                    // Детекция риска опоздания (LATE_RISK)
                    if (stopDto.arrival.isAfter(order.latestStart)) {
                        val alert = Alert(
                            code = "ALT-LATE-${order.code}",
                            day = day,
                            createdAt = day.currentNow,
                            type = AlertType.LATE_RISK,
                            status = AlertStatus.ACTIVE,
                            order = order,
                            staff = staff,
                            suggestedAction = AlertSuggestedAction.RESCHEDULE,
                            message = "Риск опоздания: наряд ${order.code}, ожидаемое прибытие ${stopDto.arrival}, слот до ${order.latestStart}"
                        )
                        lateRiskAlerts.add(alert)
                    }
                }
            }

            savedRoutes.add(routeRepository.save(route))
        }

        if (lateRiskAlerts.isNotEmpty()) {
            alertRepository.saveAll(lateRiskAlerts)
        }

        // Сохранение нераспределенных нарядов
        val savedUnassigned = mutableListOf<UnassignedOrder>()
        for (uDto in solverResponse.unassignedOrders) {
            val order = orderByCode[uDto.orderId] ?: continue
            order.status = OrderStatus.UNASSIGNED
            workOrderRepository.save(order)

            val reasonCode = try {
                UnassignedReasonCode.valueOf(uDto.reason)
            } catch (_: Exception) {
                UnassignedReasonCode.OTHER
            }

            val unassigned = UnassignedOrder(
                day = day,
                order = order,
                reasonCode = reasonCode,
                reasonText = "Наряд не распределен солвером по причине: ${uDto.reason}",
                suggestedAction = SuggestedAction.RESCHEDULE,
                since = day.currentNow
            )
            savedUnassigned.add(unassignedOrderRepository.save(unassigned))
        }

        // Обновляем версию плана дня
        day.planVersion += 1
        workDayRepository.save(day)

        return buildPlanResponse(day, savedRoutes, pgpGroupRepository.findAllByDayId(day.id), savedUnassigned, alertRepository.findAllByDayId(day.id), allOrders.size)
    }

    @Transactional(readOnly = true)
    fun getPlan(targetDate: LocalDate): PlanResponse {
        val day = workDayRepository.findByDate(targetDate)
            ?: throw NotFoundException("DAY_NOT_FOUND", "Рабочий день на дату '$targetDate' не найден")

        val routes = routeRepository.findAllByDayId(day.id)
        val pgpGroups = pgpGroupRepository.findAllByDayId(day.id)
        val unassigned = unassignedOrderRepository.findAllByDayId(day.id)
        val alerts = alertRepository.findAllByDayId(day.id)
        val totalOrders = workOrderRepository.findAllByDayId(day.id).size

        if (routes.isEmpty() && unassigned.isEmpty() && pgpGroups.isEmpty()) {
            throw NotFoundException("PLAN_NOT_FOUND", "План для дня '$targetDate' еще не рассчитан")
        }

        return buildPlanResponse(day, routes, pgpGroups, unassigned, alerts, totalOrders)
    }

    private fun buildPlanResponse(
        day: WorkDay,
        routes: List<Route>,
        pgpGroups: List<io.github.bbsk.c5d.model.plan.entity.PgpGroup>,
        unassigned: List<UnassignedOrder>,
        alerts: List<Alert>,
        totalOrdersCount: Int
    ): PlanResponse {
        val routesDto = routes.map { route ->
            val stopsDto = route.stops.map { stop ->
                StopPlanResponse(
                    id = stop.id,
                    seq = stop.seq,
                    type = stop.type,
                    orderId = stop.order?.id,
                    orderCode = stop.order?.code,
                    locationCode = stop.locationCode,
                    arrival = stop.arrival,
                    startTime = stop.startTime,
                    endTime = stop.endTime,
                    travelSec = stop.travelSec,
                    status = stop.status,
                    equipmentAfter = mapOf(
                        "ONT" to (stop.equipmentAfterOnt ?: 0),
                        "ROUTER" to (stop.equipmentAfterRouter ?: 0),
                        "STB" to (stop.equipmentAfterStb ?: 0)
                    )
                )
            }

            val totalTravel = stopsDto.sumOf { it.travelSec }
            val totalWorkMin = stopsDto.filter { it.type == StopType.VISIT }
                .sumOf { (it.endTime.toEpochSecond() - it.startTime.toEpochSecond()).toInt() / 60 }
            val ordersInRoute = stopsDto.count { it.type == StopType.VISIT }

            RoutePlanResponse(
                routeId = route.id,
                staffId = route.staff.id,
                staffCode = route.staff.code,
                staffName = route.staff.displayName,
                serviceCenterCode = route.serviceCenter.code,
                status = route.status,
                stops = stopsDto,
                totalTravelSec = totalTravel,
                totalWorkMin = totalWorkMin,
                totalOrders = ordersInRoute
            )
        }

        val pgpDto = pgpGroups.map { g ->
            PgpGroupPlanResponse(
                id = g.id,
                code = g.code,
                accessNodeCode = g.accessNode.code,
                orderCodes = g.orders.map { it.code },
                detectedAt = g.detectedAt,
                action = g.action,
                comment = g.comment
            )
        }

        val unassignedDto = unassigned.map { u ->
            UnassignedOrderPlanResponse(
                id = u.id,
                orderId = u.order.id,
                orderCode = u.order.code,
                reasonCode = u.reasonCode,
                reasonText = u.reasonText,
                suggestedAction = u.suggestedAction,
                since = u.since
            )
        }

        val alertsDto = alerts.map { a ->
            AlertPlanResponse(
                id = a.id,
                code = a.code,
                type = a.type,
                status = a.status,
                suggestedAction = a.suggestedAction,
                orderId = a.order?.id,
                staffId = a.staff?.id,
                message = a.message,
                createdAt = a.createdAt
            )
        }

        val totalTravelSec = routesDto.sumOf { it.totalTravelSec }
        val avgTravel = if (routesDto.isNotEmpty()) totalTravelSec.toDouble() / routesDto.size else 0.0
        val assignedCount = routesDto.sumOf { it.totalOrders }
        val pgpOrdersCount = pgpDto.sumOf { it.orderCodes.size }

        val metrics = PlanMetricsDto(
            totalOrders = totalOrdersCount,
            assignedOrders = assignedCount,
            unassignedOrders = unassignedDto.size,
            pgpOrders = pgpOrdersCount,
            activeRoutes = routesDto.size,
            totalTravelSec = totalTravelSec,
            avgTravelSecPerRoute = avgTravel
        )

        return PlanResponse(
            dayId = day.id,
            date = day.date,
            planVersion = day.planVersion,
            routes = routesDto,
            pgpGroups = pgpDto,
            unassignedOrders = unassignedDto,
            alerts = alertsDto,
            metrics = metrics
        )
    }
}
