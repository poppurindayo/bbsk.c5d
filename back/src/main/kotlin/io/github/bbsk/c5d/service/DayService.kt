package io.github.bbsk.c5d.service

import io.github.bbsk.c5d.exception.BadRequestException
import io.github.bbsk.c5d.exception.NotFoundException
import io.github.bbsk.c5d.model.day.dto.request.DayInputDto
import io.github.bbsk.c5d.model.day.dto.request.DayOrderInputDto
import io.github.bbsk.c5d.model.day.dto.response.DayResponse
import io.github.bbsk.c5d.model.day.entity.WorkDay
import io.github.bbsk.c5d.model.day.entity.WorkOrder
import io.github.bbsk.c5d.model.day.enums.OrderStatus
import io.github.bbsk.c5d.model.reference.entity.AccessNode
import io.github.bbsk.c5d.model.reference.entity.Building
import io.github.bbsk.c5d.model.reference.entity.ServiceCenter
import io.github.bbsk.c5d.model.reference.entity.WorkType
import io.github.bbsk.c5d.model.reference.enums.DeadlineKind
import io.github.bbsk.c5d.model.reference.enums.WorkTypeCode
import io.github.bbsk.c5d.repository.*
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

@Service
class DayService(
    private val workDayRepository: WorkDayRepository,
    private val workOrderRepository: WorkOrderRepository,
    private val workTypeRepository: WorkTypeRepository,
    private val buildingRepository: BuildingRepository,
    private val accessNodeRepository: AccessNodeRepository,
    private val serviceCenterRepository: ServiceCenterRepository,
    private val staffRepository: StaffRepository,
    private val routeRepository: RouteRepository,
    private val unassignedOrderRepository: UnassignedOrderRepository,
    private val pgpGroupRepository: PgpGroupRepository,
    private val alertRepository: AlertRepository
) {

    @Transactional
    fun initializeDay(targetDate: LocalDate, request: DayInputDto): DayResponse {
        val date = request.date ?: targetDate
        var day = workDayRepository.findByDate(date)

        val defaultNow = date.atTime(8, 0).atOffset(ZoneOffset.ofHours(5))
        val currentNow = request.now ?: defaultNow

        if (day != null) {
            alertRepository.deleteAllByDayId(day.id)
            unassignedOrderRepository.deleteAllByDayId(day.id)
            routeRepository.deleteAllByDayId(day.id)
            pgpGroupRepository.deleteAllByDayId(day.id)

            // Remove day orders that are not in the new requested pool
            val requestedCodes = request.orders.map { it.orderId.trim() }.toSet()
            val existingDayOrders = workOrderRepository.findAllByDayId(day.id)
            val ordersToRemove = existingDayOrders.filter { it.code !in requestedCodes }
            if (ordersToRemove.isNotEmpty()) {
                workOrderRepository.deleteAll(ordersToRemove)
            }
            workOrderRepository.flush()

            day.absentStaff.clear()
            day.currentNow = currentNow
            day.planVersion = 1
            day.basedOnEventId = null
        } else {
            day = WorkDay(
                date = date,
                currentNow = currentNow,
                planVersion = 1
            )
        }

        day = workDayRepository.save(day)

        // Process absent staff
        val absentStaffEntities = request.absentStaff.mapNotNull { ref ->
            resolveStaff(ref.trim())
        }.toMutableSet()
        day.absentStaff.addAll(absentStaffEntities)
        day = workDayRepository.save(day)

        // Process orders (upsert existing or create new)
        val ordersToSave = request.orders.map { orderDto ->
            val code = orderDto.orderId.trim()
            val existing = workOrderRepository.findByCode(code)
            if (existing != null) {
                applyDtoToWorkOrder(existing, orderDto, day)
                existing
            } else {
                mapToWorkOrder(orderDto, day)
            }
        }

        workOrderRepository.saveAll(ordersToSave)

        return DayResponse(
            id = day.id,
            date = day.date,
            currentNow = day.currentNow,
            planVersion = day.planVersion,
            basedOnEventId = day.basedOnEventId,
            ordersCount = ordersToSave.size,
            absentStaffCount = day.absentStaff.size,
            absentStaffCodes = day.absentStaff.map { it.code }
        )
    }

    @Transactional(readOnly = true)
    fun getDay(date: LocalDate): DayResponse {
        val day = workDayRepository.findByDate(date)
            ?: throw NotFoundException("DAY_NOT_FOUND", "Рабочий день на дату '$date' не найден")

        val orders = workOrderRepository.findAllByDayId(day.id)

        return DayResponse(
            id = day.id,
            date = day.date,
            currentNow = day.currentNow,
            planVersion = day.planVersion,
            basedOnEventId = day.basedOnEventId,
            ordersCount = orders.size,
            absentStaffCount = day.absentStaff.size,
            absentStaffCodes = day.absentStaff.map { it.code }
        )
    }

    private fun mapToWorkOrder(orderDto: DayOrderInputDto, day: WorkDay): WorkOrder {
        val code = orderDto.orderId.trim()

        val building = resolveBuilding(orderDto.buildingId.trim())
            ?: throw BadRequestException("BUILDING_NOT_FOUND", "Здание '${orderDto.buildingId}' для наряда '$code' не найдено")

        val workType = resolveWorkType(orderDto.workTypeId?.trim() ?: orderDto.workTypeCode?.trim())
            ?: throw BadRequestException("WORK_TYPE_NOT_FOUND", "Тип работ для наряда '$code' не найден")

        val accessNode = if (!orderDto.accessNodeId.isNullOrBlank()) {
            resolveAccessNode(orderDto.accessNodeId.trim())
                ?: throw BadRequestException("ACCESS_NODE_NOT_FOUND", "Узел доступа '${orderDto.accessNodeId}' не найден")
        } else {
            building.accessNode
        }

        val serviceCenter = if (!orderDto.serviceCenterId.isNullOrBlank()) {
            resolveServiceCenter(orderDto.serviceCenterId.trim())
                ?: throw BadRequestException("SERVICE_CENTER_NOT_FOUND", "Сервисный центр '${orderDto.serviceCenterId}' не найден")
        } else {
            building.zoneServiceCenter
        }

        val resolvedSlotStart = orderDto.slot?.start ?: orderDto.slotStart
            ?: throw BadRequestException("SLOT_REQUIRED", "Для наряда '$code' не указано начало слота")
        val resolvedSlotEnd = orderDto.slot?.end ?: orderDto.slotEnd
            ?: throw BadRequestException("SLOT_REQUIRED", "Для наряда '$code' не указано окончание слота")

        val latestStart = orderDto.latestStart ?: calculateLatestStart(resolvedSlotStart, resolvedSlotEnd, workType)
        val deadline = orderDto.deadline ?: calculateDeadline(latestStart, resolvedSlotEnd, workType)

        val ont = orderDto.requiredEquipment?.ont ?: orderDto.requiredOnt ?: 0
        val router = orderDto.requiredEquipment?.router ?: orderDto.requiredRouter ?: 0
        val stb = orderDto.requiredEquipment?.stb ?: orderDto.requiredStb ?: 0

        return WorkOrder(
            code = code,
            day = day,
            serviceCenter = serviceCenter,
            workType = workType,
            building = building,
            accessNode = accessNode,
            registeredAt = orderDto.registeredAt,
            slotStart = resolvedSlotStart,
            slotEnd = resolvedSlotEnd,
            latestStart = latestStart,
            deadline = deadline,
            requiredOnt = ont,
            requiredRouter = router,
            requiredStb = stb,
            isRepeat = orderDto.isRepeat,
            previousOrderId = orderDto.previousOrderId?.trim(),
            isGenerated = orderDto.isGenerated,
            status = OrderStatus.PENDING
        )
    }

    private fun applyDtoToWorkOrder(order: WorkOrder, orderDto: DayOrderInputDto, day: WorkDay) {
        val building = resolveBuilding(orderDto.buildingId.trim())
            ?: throw BadRequestException("BUILDING_NOT_FOUND", "Здание '${orderDto.buildingId}' для наряда '${order.code}' не найдено")

        val workType = resolveWorkType(orderDto.workTypeId?.trim() ?: orderDto.workTypeCode?.trim())
            ?: throw BadRequestException("WORK_TYPE_NOT_FOUND", "Тип работ для наряда '${order.code}' не найден")

        val accessNode = if (!orderDto.accessNodeId.isNullOrBlank()) {
            resolveAccessNode(orderDto.accessNodeId.trim())
                ?: throw BadRequestException("ACCESS_NODE_NOT_FOUND", "Узел доступа '${orderDto.accessNodeId}' не найден")
        } else {
            building.accessNode
        }

        val serviceCenter = if (!orderDto.serviceCenterId.isNullOrBlank()) {
            resolveServiceCenter(orderDto.serviceCenterId.trim())
                ?: throw BadRequestException("SERVICE_CENTER_NOT_FOUND", "Сервисный центр '${orderDto.serviceCenterId}' не найден")
        } else {
            building.zoneServiceCenter
        }

        val resolvedSlotStart = orderDto.slot?.start ?: orderDto.slotStart
            ?: throw BadRequestException("SLOT_REQUIRED", "Для наряда '${order.code}' не указано начало слота")
        val resolvedSlotEnd = orderDto.slot?.end ?: orderDto.slotEnd
            ?: throw BadRequestException("SLOT_REQUIRED", "Для наряда '${order.code}' не указано окончание слота")

        val latestStart = orderDto.latestStart ?: calculateLatestStart(resolvedSlotStart, resolvedSlotEnd, workType)
        val deadline = orderDto.deadline ?: calculateDeadline(latestStart, resolvedSlotEnd, workType)

        val ont = orderDto.requiredEquipment?.ont ?: orderDto.requiredOnt ?: 0
        val router = orderDto.requiredEquipment?.router ?: orderDto.requiredRouter ?: 0
        val stb = orderDto.requiredEquipment?.stb ?: orderDto.requiredStb ?: 0

        order.day = day
        order.serviceCenter = serviceCenter
        order.workType = workType
        order.building = building
        order.accessNode = accessNode
        order.registeredAt = orderDto.registeredAt
        order.slotStart = resolvedSlotStart
        order.slotEnd = resolvedSlotEnd
        order.latestStart = latestStart
        order.deadline = deadline
        order.requiredOnt = ont
        order.requiredRouter = router
        order.requiredStb = stb
        order.isRepeat = orderDto.isRepeat
        order.previousOrderId = orderDto.previousOrderId?.trim()
        order.isGenerated = orderDto.isGenerated
        order.status = OrderStatus.PENDING
    }

    private fun resolveStaff(ref: String): io.github.bbsk.c5d.model.reference.entity.Staff? {
        val uuid = try { UUID.fromString(ref) } catch (_: Exception) { null }
        if (uuid != null) {
            val byId = staffRepository.findById(uuid).orElse(null)
            if (byId != null) return byId
        }
        return staffRepository.findByCode(ref)
    }

    private fun resolveBuilding(ref: String): Building? {
        val uuid = try { UUID.fromString(ref) } catch (_: Exception) { null }
        if (uuid != null) {
            val byId = buildingRepository.findById(uuid).orElse(null)
            if (byId != null) return byId
        }
        return buildingRepository.findByCode(ref)
    }

    private fun resolveWorkType(ref: String?): WorkType? {
        if (ref.isNullOrBlank()) return null
        val uuid = try { UUID.fromString(ref) } catch (_: Exception) { null }
        if (uuid != null) {
            val byId = workTypeRepository.findById(uuid).orElse(null)
            if (byId != null) return byId
        }
        val enumCode = try { WorkTypeCode.valueOf(ref) } catch (_: Exception) { null }
        if (enumCode != null) {
            val byCode = workTypeRepository.findByCode(enumCode)
            if (byCode != null) return byCode
        }
        return null
    }

    private fun resolveAccessNode(ref: String): AccessNode? {
        val uuid = try { UUID.fromString(ref) } catch (_: Exception) { null }
        if (uuid != null) {
            val byId = accessNodeRepository.findById(uuid).orElse(null)
            if (byId != null) return byId
        }
        return accessNodeRepository.findByCode(ref)
    }

    private fun resolveServiceCenter(ref: String): ServiceCenter? {
        val uuid = try { UUID.fromString(ref) } catch (_: Exception) { null }
        if (uuid != null) {
            val byId = serviceCenterRepository.findById(uuid).orElse(null)
            if (byId != null) return byId
        }
        return serviceCenterRepository.findByCode(ref)
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
}
