package io.github.bbsk.c5d.controller

import io.github.bbsk.c5d.model.common.dto.ErrorResponse
import io.github.bbsk.c5d.model.day.dto.request.CreateWorkOrderRequest
import io.github.bbsk.c5d.model.day.dto.request.UpdateWorkOrderRequest
import io.github.bbsk.c5d.model.day.dto.response.WorkOrderResponse
import io.github.bbsk.c5d.model.day.enums.OrderStatus
import io.github.bbsk.c5d.service.WorkOrderService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.Parameter
import io.swagger.v3.oas.annotations.media.ArraySchema
import io.swagger.v3.oas.annotations.media.Content
import io.swagger.v3.oas.annotations.media.Schema
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.responses.ApiResponses
import io.swagger.v3.oas.annotations.tags.Tag
import jakarta.validation.Valid
import org.springframework.format.annotation.DateTimeFormat
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import java.time.LocalDate
import java.util.UUID

@Tag(
    name = "Наряды на работы (Orders)",
    description = "Управление нарядами на выездные работы: создание, фильтрация, детальный просмотр, обновление параметров и статусов, удаление (CRUD)"
)
@RestController
@RequestMapping("/api/v1/orders")
class OrderController(
    private val workOrderService: WorkOrderService
) {

    @Operation(
        summary = "Получить список нарядов",
        description = "Возвращает список нарядов на выполнение выездных работ с поддержкой фильтрации по рабочему дню, дате, статусу, зданию и типу работ."
    )
    @ApiResponses(
        value = [
            ApiResponse(
                responseCode = "200",
                description = "Список нарядов успешно получен",
                content = [Content(array = ArraySchema(schema = Schema(implementation = WorkOrderResponse::class)))]
            )
        ]
    )
    @GetMapping
    fun getAll(
        @Parameter(description = "Фильтр по UUID рабочего дня", example = "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d")
        @RequestParam(required = false, name = "day_id") dayId: UUID?,

        @Parameter(description = "Фильтр по календарной дате рабочего дня (YYYY-MM-DD)", example = "2026-10-26")
        @RequestParam(required = false, name = "date") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) date: LocalDate?,

        @Parameter(description = "Фильтр по статусу наряда (PENDING, ASSIGNED, COMPLETED, CANCELLED, UNASSIGNED)", example = "PENDING")
        @RequestParam(required = false, name = "status") status: OrderStatus?,

        @Parameter(description = "Фильтр по UUID здания / объекта обслуживания", example = "4ba85f64-5717-4562-b3fc-2c963f66afa7")
        @RequestParam(required = false, name = "building_id") buildingId: UUID?,

        @Parameter(description = "Фильтр по UUID типа работ", example = "c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f")
        @RequestParam(required = false, name = "work_type_id") workTypeId: UUID?
    ): ResponseEntity<List<WorkOrderResponse>> {
        val orders = workOrderService.getAll(
            dayId = dayId,
            date = date,
            status = status,
            buildingId = buildingId,
            workTypeId = workTypeId
        )
        return ResponseEntity.ok(orders)
    }

    @Operation(
        summary = "Получить наряд по ID",
        description = "Возвращает детальную информацию о наряде по его внутреннему идентификатору (UUID)."
    )
    @ApiResponses(
        value = [
            ApiResponse(
                responseCode = "200",
                description = "Наряд найден",
                content = [Content(schema = Schema(implementation = WorkOrderResponse::class))]
            ),
            ApiResponse(
                responseCode = "404",
                description = "Наряд не найден",
                content = [Content(schema = Schema(implementation = ErrorResponse::class))]
            )
        ]
    )
    @GetMapping("/{id}")
    fun getById(
        @Parameter(description = "Уникальный идентификатор наряда (UUID)", example = "7ca85f64-5717-4562-b3fc-2c963f66afa9")
        @PathVariable id: UUID
    ): ResponseEntity<WorkOrderResponse> {
        return ResponseEntity.ok(workOrderService.getById(id))
    }

    @Operation(
        summary = "Создать наряд на работы",
        description = "Создает новый наряд на выездные работы. Проверяет существование связанных сущностей (рабочий день, тип работ, здание, узел доступа, СЦ) и уникальность номера наряда. При отсутствии необязательных параметров (latest_start, deadline, access_node, service_center) вычисляет их автоматически по нормативам."
    )
    @ApiResponses(
        value = [
            ApiResponse(
                responseCode = "201",
                description = "Наряд успешно создан",
                content = [Content(schema = Schema(implementation = WorkOrderResponse::class))]
            ),
            ApiResponse(
                responseCode = "400",
                description = "Некорректные параметры запроса или ошибки валидации",
                content = [Content(schema = Schema(implementation = ErrorResponse::class))]
            ),
            ApiResponse(
                responseCode = "404",
                description = "Связанная сущность (здание, тип работ, СЦ или день) не найдена",
                content = [Content(schema = Schema(implementation = ErrorResponse::class))]
            ),
            ApiResponse(
                responseCode = "409",
                description = "Наряд с таким кодом (order_id) уже существует",
                content = [Content(schema = Schema(implementation = ErrorResponse::class))]
            )
        ]
    )
    @PostMapping
    fun create(
        @Valid @RequestBody request: CreateWorkOrderRequest
    ): ResponseEntity<WorkOrderResponse> {
        val created = workOrderService.create(request)
        return ResponseEntity.status(HttpStatus.CREATED).body(created)
    }

    @Operation(
        summary = "Обновить наряд на работы",
        description = "Частично или полностью обновляет параметры наряда (статус, тип работ, адрес, временной слот, крайний срок, потребность в оборудовании и т.д.)."
    )
    @ApiResponses(
        value = [
            ApiResponse(
                responseCode = "200",
                description = "Наряд успешно обновлен",
                content = [Content(schema = Schema(implementation = WorkOrderResponse::class))]
            ),
            ApiResponse(
                responseCode = "400",
                description = "Ошибки валидации запроса",
                content = [Content(schema = Schema(implementation = ErrorResponse::class))]
            ),
            ApiResponse(
                responseCode = "404",
                description = "Наряд или обновляемая связанная сущность не найдена",
                content = [Content(schema = Schema(implementation = ErrorResponse::class))]
            )
        ]
    )
    @PutMapping("/{id}")
    fun update(
        @Parameter(description = "Уникальный идентификатор наряда (UUID)", example = "7ca85f64-5717-4562-b3fc-2c963f66afa9")
        @PathVariable id: UUID,

        @Valid @RequestBody request: UpdateWorkOrderRequest
    ): ResponseEntity<WorkOrderResponse> {
        val updated = workOrderService.update(id, request)
        return ResponseEntity.ok(updated)
    }

    @Operation(
        summary = "Удалить наряд",
        description = "Удаляет наряд из базы данных по его внутреннему идентификатору (UUID)."
    )
    @ApiResponses(
        value = [
            ApiResponse(
                responseCode = "204",
                description = "Наряд успешно удален"
            ),
            ApiResponse(
                responseCode = "404",
                description = "Наряд не найден",
                content = [Content(schema = Schema(implementation = ErrorResponse::class))]
            )
        ]
    )
    @DeleteMapping("/{id}")
    fun delete(
        @Parameter(description = "Уникальный идентификатор наряда (UUID)", example = "7ca85f64-5717-4562-b3fc-2c963f66afa9")
        @PathVariable id: UUID
    ): ResponseEntity<Void> {
        workOrderService.delete(id)
        return ResponseEntity.noContent().build()
    }

    @Operation(
        summary = "Удалить сгенерированные (тестовые) наряды дня",
        description = "Удаляет только наряды с признаком is_generated=true за указанную дату, сохраняя вручную созданные. Ссылки на них убираются из маршрутов."
    )
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "Возвращает количество удалённых нарядов"),
            ApiResponse(responseCode = "404", description = "День не найден")
        ]
    )
    @DeleteMapping("/generated")
    fun deleteGenerated(
        @Parameter(description = "Дата рабочего дня (YYYY-MM-DD)", example = "2026-10-26")
        @RequestParam(name = "date") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) date: LocalDate
    ): ResponseEntity<Map<String, Int>> {
        val deleted = workOrderService.deleteGenerated(date)
        return ResponseEntity.ok(mapOf("deleted" to deleted))
    }
}
