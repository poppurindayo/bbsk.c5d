package io.github.bbsk.c5d.service

import io.github.bbsk.c5d.exception.BadRequestException
import io.github.bbsk.c5d.exception.ConflictException
import io.github.bbsk.c5d.exception.NotFoundException
import io.github.bbsk.c5d.model.day.dto.TimeWindowDto
import io.github.bbsk.c5d.model.day.dto.request.CreateWorkOrderRequest
import io.github.bbsk.c5d.model.day.dto.request.UpdateWorkOrderRequest
import io.github.bbsk.c5d.model.day.dto.response.WorkOrderResponse
import io.github.bbsk.c5d.model.day.entity.WorkDay
import io.github.bbsk.c5d.model.day.entity.WorkOrder
import io.github.bbsk.c5d.model.day.enums.OrderStatus
import io.github.bbsk.c5d.model.reference.dto.EquipmentDto
import io.github.bbsk.c5d.model.reference.entity.Building
import io.github.bbsk.c5d.model.reference.entity.WorkType
import io.github.bbsk.c5d.model.reference.enums.BuildingType
import io.github.bbsk.c5d.model.reference.enums.DeadlineKind
import io.github.bbsk.c5d.repository.*
import jakarta.persistence.criteria.Predicate
import org.springframework.data.jpa.domain.Specification
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

@Service
class WorkOrderService(
    private val workOrderRepository: WorkOrderRepository,
    private val workDayRepository: WorkDayRepository,
    private val workTypeRepository: WorkTypeRepository,
    private val buildingRepository: BuildingRepository,
    private val accessNodeRepository: AccessNodeRepository,
    private val serviceCenterRepository: ServiceCenterRepository,
    private val routeRepository: RouteRepository
) {

    @Transactional(readOnly = true)
    fun getAll(
        dayId: UUID? = null,
        date: LocalDate? = null,
        status: OrderStatus? = null,
        buildingId: UUID? = null,
        workTypeId: UUID? = null
    ): List<WorkOrderResponse> {
        val spec = Specification<WorkOrder> { root, _, cb ->
            val predicates = mutableListOf<Predicate>()
            dayId?.let { predicates.add(cb.equal(root.get<WorkDay>("day").get<UUID>("id"), it)) }
            date?.let { predicates.add(cb.equal(root.get<WorkDay>("day").get<LocalDate>("date"), it)) }
            status?.let { predicates.add(cb.equal(root.get<OrderStatus>("status"), it)) }
            buildingId?.let { predicates.add(cb.equal(root.get<Building>("building").get<UUID>("id"), it)) }
            workTypeId?.let { predicates.add(cb.equal(root.get<WorkType>("workType").get<UUID>("id"), it)) }
            cb.and(*predicates.toTypedArray())
        }

        return workOrderRepository.findAll(spec).map { it.toDto() }
    }

    @Transactional(readOnly = true)
    fun getById(id: UUID): WorkOrderResponse {
        val order = workOrderRepository.findById(id).orElseThrow {
            NotFoundException("ORDER_NOT_FOUND", "Наряд с id '$id' не найден")
        }
        return order.toDto()
    }

    @Transactional(readOnly = true)
    fun getByCode(code: String): WorkOrderResponse {
        val order = workOrderRepository.findByCode(code.trim())
            ?: throw NotFoundException("ORDER_NOT_FOUND", "Наряд с кодом '$code' не найден")
        return order.toDto()
    }

    @Transactional
    fun create(request: CreateWorkOrderRequest): WorkOrderResponse {
        val trimmedCode = request.orderId.trim()
        if (workOrderRepository.existsByCode(trimmedCode)) {
            throw ConflictException("ORDER_ALREADY_EXISTS", "Наряд с кодом '$trimmedCode' уже существует")
        }

        val workType = workTypeRepository.findById(request.workTypeId).orElseThrow {
            NotFoundException("WORK_TYPE_NOT_FOUND", "Тип работ с id '${request.workTypeId}' не найден")
        }

        val building = buildingRepository.findById(request.buildingId).orElseThrow {
            NotFoundException("BUILDING_NOT_FOUND", "Здание с id '${request.buildingId}' не найдено")
        }

        val accessNode = if (request.accessNodeId != null) {
            accessNodeRepository.findById(request.accessNodeId).orElseThrow {
                NotFoundException("ACCESS_NODE_NOT_FOUND", "Узел доступа с id '${request.accessNodeId}' не найден")
            }
        } else {
            building.accessNode
        }

        val serviceCenter = if (request.serviceCenterId != null) {
            serviceCenterRepository.findById(request.serviceCenterId).orElseThrow {
                NotFoundException("SERVICE_CENTER_NOT_FOUND", "Сервисный центр с id '${request.serviceCenterId}' не найден")
            }
        } else {
            building.zoneServiceCenter
        }

        val resolvedSlotStart = request.slot?.start ?: request.slotStart
            ?: throw BadRequestException("SLOT_REQUIRED", "Необходимо указать начало слота (slot.start или slot_start)")
        val resolvedSlotEnd = request.slot?.end ?: request.slotEnd
            ?: throw BadRequestException("SLOT_REQUIRED", "Необходимо указать окончание слота (slot.end или slot_end)")

        val day = resolveWorkDay(request.dayId, request.dayDate, resolvedSlotStart)

        val latestStart = request.latestStart ?: calculateLatestStart(resolvedSlotStart, resolvedSlotEnd, workType)
        val deadline = request.deadline ?: calculateDeadline(latestStart, resolvedSlotEnd, workType)

        val (ont, router, stb) = if (request.requiredEquipment != null) {
            Triple(request.requiredEquipment.ont, request.requiredEquipment.router, request.requiredEquipment.stb)
        } else {
            Triple(request.requiredOnt, request.requiredRouter, request.requiredStb)
        }

        val order = WorkOrder(
            code = trimmedCode,
            day = day,
            serviceCenter = serviceCenter,
            workType = workType,
            building = building,
            accessNode = accessNode,
            registeredAt = request.registeredAt,
            slotStart = resolvedSlotStart,
            slotEnd = resolvedSlotEnd,
            latestStart = latestStart,
            deadline = deadline,
            requiredOnt = ont,
            requiredRouter = router,
            requiredStb = stb,
            isRepeat = request.isRepeat,
            previousOrderId = request.previousOrderId?.trim(),
            isGenerated = request.isGenerated,
            status = request.status
        )

        return workOrderRepository.save(order).toDto()
    }

    @Transactional
    fun update(id: UUID, request: UpdateWorkOrderRequest): WorkOrderResponse {
        val order = workOrderRepository.findById(id).orElseThrow {
            NotFoundException("ORDER_NOT_FOUND", "Наряд с id '$id' не найден")
        }

        request.workTypeId?.let {
            order.workType = workTypeRepository.findById(it).orElseThrow {
                NotFoundException("WORK_TYPE_NOT_FOUND", "Тип работ с id '$it' не найден")
            }
        }

        request.buildingId?.let {
            val newBuilding = buildingRepository.findById(it).orElseThrow {
                NotFoundException("BUILDING_NOT_FOUND", "Здание с id '$it' не найдено")
            }
            order.building = newBuilding
            if (request.accessNodeId == null) {
                order.accessNode = newBuilding.accessNode
            }
            if (request.serviceCenterId == null && newBuilding.zoneServiceCenter != null) {
                order.serviceCenter = newBuilding.zoneServiceCenter
            }
        }

        request.accessNodeId?.let {
            order.accessNode = accessNodeRepository.findById(it).orElseThrow {
                NotFoundException("ACCESS_NODE_NOT_FOUND", "Узел доступа с id '$it' не найден")
            }
        }

        if (request.serviceCenterId != null) {
            order.serviceCenter = serviceCenterRepository.findById(request.serviceCenterId).orElseThrow {
                NotFoundException("SERVICE_CENTER_NOT_FOUND", "Сервисный центр с id '${request.serviceCenterId}' не найден")
            }
        }

        request.status?.let { order.status = it }
        request.registeredAt?.let { order.registeredAt = it }
        request.slotStart?.let { order.slotStart = it }
        request.slotEnd?.let { order.slotEnd = it }
        request.latestStart?.let { order.latestStart = it }
        request.deadline?.let { order.deadline = it }

        if (request.requiredEquipment != null) {
            order.requiredOnt = request.requiredEquipment.ont
            order.requiredRouter = request.requiredEquipment.router
            order.requiredStb = request.requiredEquipment.stb
        } else {
            request.requiredOnt?.let { order.requiredOnt = it }
            request.requiredRouter?.let { order.requiredRouter = it }
            request.requiredStb?.let { order.requiredStb = it }
        }

        request.isRepeat?.let { order.isRepeat = it }
        request.previousOrderId?.let { order.previousOrderId = it.trim() }

        return workOrderRepository.save(order).toDto()
    }

    @Transactional
    fun delete(id: UUID) {
        val order = workOrderRepository.findById(id).orElseThrow {
            NotFoundException("ORDER_NOT_FOUND", "Наряд с id '$id' не найден")
        }
        workOrderRepository.delete(order)
    }

    /**
     * Удаляет только сгенерированные (тестовые) наряды дня, сохраняя вручную созданные.
     * Сначала убирает ссылки на них из маршрутов (стопы), затем удаляет сами наряды.
     */
    @Transactional
    fun deleteGenerated(date: LocalDate): Int {
        val day = workDayRepository.findByDate(date) ?: return 0
        val allOrders = workOrderRepository.findAllByDayId(day.id)
        val generated = allOrders.filter { it.isGenerated }
        if (generated.isEmpty()) return 0

        val generatedIds = generated.map { it.id }.toSet()

        // Удаляем стопы маршрутов, ссылающиеся на сгенерированные наряды (иначе FK-конфликт)
        val routes = routeRepository.findAllByDayId(day.id)
        var routesChanged = false
        for (route in routes) {
            val toRemove = route.stops.filter { stop -> stop.order?.id in generatedIds }
            if (toRemove.isNotEmpty()) {
                route.stops.removeAll(toRemove)
                routesChanged = true
            }
        }
        if (routesChanged) {
            routeRepository.saveAll(routes)
            routeRepository.flush()
        }

        workOrderRepository.deleteAll(generated)
        workOrderRepository.flush()
        return generated.size
    }

    private fun resolveWorkDay(dayId: UUID?, dayDate: LocalDate?, slotStart: OffsetDateTime): WorkDay {
        if (dayId != null) {
            return workDayRepository.findById(dayId).orElseThrow {
                NotFoundException("WORK_DAY_NOT_FOUND", "Рабочий день с id '$dayId' не найден")
            }
        }

        // Jackson приводит OffsetDateTime к UTC ("09:00+05:00" -> "04:00Z"), а рабочий день
        // живёт по UTC+5: дату и "сейчас" считаем в местном офсете, а не в том, что пришёл.
        val slotLocal = slotStart.withOffsetSameInstant(ZoneOffset.ofHours(5))
        val targetDate = dayDate ?: slotLocal.toLocalDate()
        val existingDay = workDayRepository.findByDate(targetDate)
        if (existingDay != null) {
            return existingDay
        }

        val defaultNow = slotLocal.withHour(8).withMinute(30).withSecond(0).withNano(0)
        val newDay = WorkDay(
            date = targetDate,
            currentNow = defaultNow,
            planVersion = 1
        )
        return workDayRepository.save(newDay)
    }

    private fun calculateLatestStart(slotStart: OffsetDateTime, slotEnd: OffsetDateTime, workType: WorkType): OffsetDateTime {
        val maxDelay = workType.maxStartDelayMin ?: 120
        val candidate = slotStart.plusMinutes(maxDelay.toLong())
        return if (candidate.isBefore(slotEnd)) candidate else slotEnd
    }

    private fun calculateDeadline(latestStart: OffsetDateTime, slotEnd: OffsetDateTime, workType: WorkType): OffsetDateTime {
        return if (workType.deadlineKind == DeadlineKind.SLOT) {
            latestStart.plusMinutes(workType.durationMin.toLong())
        } else {
            slotEnd
        }
    }

    private fun WorkOrder.toDto(): WorkOrderResponse {
        val b = building
        val sc = serviceCenter ?: b.zoneServiceCenter
        val requiresHeight = b.buildingType == BuildingType.PRIVATE && b.overheadLine

        return WorkOrderResponse(
            id = id,
            orderId = code,
            dayId = day.id,
            dayDate = day.date,
            serviceCenterId = sc?.id,
            serviceCenterCode = sc?.code,
            workTypeId = workType.id,
            workTypeCode = workType.code,
            workTypeName = workType.name,
            buildingId = b.id,
            buildingCode = b.code,
            address = b.address,
            lat = b.lat,
            lon = b.lon,
            buildingType = b.buildingType,
            requiresHeight = requiresHeight,
            accessNodeId = accessNode.id,
            accessNodeCode = accessNode.code,
            registeredAt = registeredAt,
            slot = TimeWindowDto(start = slotStart, end = slotEnd),
            slotStart = slotStart,
            slotEnd = slotEnd,
            latestStart = latestStart,
            deadline = deadline,
            requiredEquipment = EquipmentDto(
                ont = requiredOnt,
                router = requiredRouter,
                stb = requiredStb
            ),
            isRepeat = isRepeat,
            previousOrderId = previousOrderId,
            isGenerated = isGenerated,
            status = status
        )
    }
}
