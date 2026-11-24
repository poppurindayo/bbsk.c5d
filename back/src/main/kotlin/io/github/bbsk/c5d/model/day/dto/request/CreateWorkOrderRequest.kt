package io.github.bbsk.c5d.model.day.dto.request

import com.fasterxml.jackson.annotation.JsonProperty
import io.github.bbsk.c5d.model.day.enums.OrderStatus
import io.github.bbsk.c5d.model.reference.dto.EquipmentDto
import io.swagger.v3.oas.annotations.media.Schema
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Pattern
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID

@Schema(description = "Запрос на создание нового наряда на выездные работы")
data class CreateWorkOrderRequest(
    @field:JsonProperty("order_id")
    @field:NotBlank(message = "Код наряда (order_id) обязателен")
    @field:Pattern(
        regexp = "^ORD-[0-9]{8}-[0-9]{4}$",
        message = "Код наряда должен соответствовать формату ORD-YYYYMMDD-XXXX (например ORD-20261026-0001)"
    )
    @field:Schema(
        description = "Уникальный строковый бизнес-код наряда (формат ORD-YYYYMMDD-XXXX)",
        example = "ORD-20261026-0001",
        requiredMode = Schema.RequiredMode.REQUIRED
    )
    val orderId: String,

    @field:JsonProperty("day_id")
    @field:Schema(
        description = "UUID рабочего дня (если не указан, день будет найден или создан по дате day_date или slot_start)",
        example = "3fa85f64-5717-4562-b3fc-2c963f66afa6"
    )
    val dayId: UUID? = null,

    @field:JsonProperty("day_date")
    @field:Schema(
        description = "Дата рабочего дня (используется для автоматического поиска или создания дня, если day_id не передан)",
        example = "2026-10-26"
    )
    val dayDate: LocalDate? = null,

    @field:JsonProperty("work_type_id")
    @field:NotNull(message = "UUID типа работ (work_type_id) обязателен")
    @field:Schema(
        description = "Уникальный идентификатор (UUID) типа работ из справочника",
        example = "c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f",
        requiredMode = Schema.RequiredMode.REQUIRED
    )
    val workTypeId: UUID,

    @field:JsonProperty("building_id")
    @field:NotNull(message = "UUID здания (building_id) обязателен")
    @field:Schema(
        description = "Уникальный идентификатор (UUID) обслуживаемого здания/объекта",
        example = "4ba85f64-5717-4562-b3fc-2c963f66afa7",
        requiredMode = Schema.RequiredMode.REQUIRED
    )
    val buildingId: UUID,

    @field:JsonProperty("access_node_id")
    @field:Schema(
        description = "UUID узла доступа связи (если не передан, наследуется от здания)",
        example = "2ea85f64-5717-4562-b3fc-2c963f66afa5"
    )
    val accessNodeId: UUID? = null,

    @field:JsonProperty("service_center_id")
    @field:Schema(
        description = "UUID сервисного центра (если не передан, наследуется от зоны обслуживания здания)",
        example = "1fa85f64-5717-4562-b3fc-2c963f66afa4"
    )
    val serviceCenterId: UUID? = null,

    @field:JsonProperty("registered_at")
    @field:NotNull(message = "Момент регистрации наряда (registered_at) обязателен")
    @field:Schema(
        description = "Дата и время регистрации наряда клиентом/оператором",
        example = "2026-10-25T14:30:00+05:00",
        requiredMode = Schema.RequiredMode.REQUIRED
    )
    val registeredAt: OffsetDateTime,

    @field:JsonProperty("slot")
    @field:Schema(
        description = "Согласованный с абонентом 2-часовой временной интервал (если указан, имеет приоритет над slot_start / slot_end)"
    )
    val slot: io.github.bbsk.c5d.model.day.dto.TimeWindowDto? = null,

    @field:JsonProperty("slot_start")
    @field:Schema(
        description = "Начало согласованного 2-часового временного интервала",
        example = "2026-10-26T09:00:00+05:00"
    )
    val slotStart: OffsetDateTime? = null,

    @field:JsonProperty("slot_end")
    @field:Schema(
        description = "Окончание согласованного временного интервала",
        example = "2026-10-26T11:00:00+05:00"
    )
    val slotEnd: OffsetDateTime? = null,

    @field:JsonProperty("latest_start")
    @field:Schema(
        description = "Крайний допустимый момент начала визита (по умолчанию min(slot_end, slot_start + max_start_delay))",
        example = "2026-10-26T09:10:00+05:00"
    )
    val latestStart: OffsetDateTime? = null,

    @field:JsonProperty("deadline")
    @field:Schema(
        description = "Контрольный срок завершения работ (по умолчанию рассчитывается по нормативу типа работ)",
        example = "2026-10-26T10:10:00+05:00"
    )
    val deadline: OffsetDateTime? = null,

    @field:JsonProperty("required_ont")
    @field:Schema(description = "Требуемое количество оптических терминалов (ONT)", example = "0", defaultValue = "0")
    val requiredOnt: Int = 0,

    @field:JsonProperty("required_router")
    @field:Schema(description = "Требуемое количество роутеров/модемов (ROUTER)", example = "1", defaultValue = "0")
    val requiredRouter: Int = 0,

    @field:JsonProperty("required_stb")
    @field:Schema(description = "Требуемое количество ТВ-приставок (STB)", example = "0", defaultValue = "0")
    val requiredStb: Int = 0,

    @field:JsonProperty("required_equipment")
    @field:Schema(description = "Агрегированная потребность в оборудовании (при передаче переопределяет отдельные поля required_*)")
    val requiredEquipment: EquipmentDto? = null,

    @field:JsonProperty("is_repeat")
    @field:Schema(
        description = "Признак повторного обращения абонента в течение 7 дней (удваивает штраф в функции потерь)",
        example = "false",
        defaultValue = "false"
    )
    val isRepeat: Boolean = false,

    @field:JsonProperty("previous_order_id")
    @field:Schema(
        description = "Код предыдущего наряда абонента (при повторном обращении)",
        example = "ORD-20261020-0045"
    )
    val previousOrderId: String? = null,

    @field:JsonProperty("status")
    @field:Schema(
        description = "Статус наряда (PENDING, ASSIGNED, COMPLETED, CANCELLED, UNASSIGNED)",
        example = "PENDING",
        defaultValue = "PENDING"
    )
    val status: OrderStatus = OrderStatus.PENDING,

    @field:JsonProperty("is_generated")
    @field:Schema(
        description = "Признак сгенерированного (тестового) наряда — такие наряды можно массово удалить",
        example = "false",
        defaultValue = "false"
    )
    val isGenerated: Boolean = false
)
