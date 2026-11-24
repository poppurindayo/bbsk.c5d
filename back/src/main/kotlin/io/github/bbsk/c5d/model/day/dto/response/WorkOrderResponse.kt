package io.github.bbsk.c5d.model.day.dto.response

import com.fasterxml.jackson.annotation.JsonProperty
import io.github.bbsk.c5d.model.day.enums.OrderStatus
import io.github.bbsk.c5d.model.reference.dto.EquipmentDto
import io.github.bbsk.c5d.model.reference.enums.BuildingType
import io.github.bbsk.c5d.model.reference.enums.WorkTypeCode
import io.swagger.v3.oas.annotations.media.Schema
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID

@Schema(description = "Информация о наряде на выполнение выездных работ")
data class WorkOrderResponse(
    @field:Schema(
        description = "Уникальный внутренний идентификатор наряда (UUID)",
        example = "7ca85f64-5717-4562-b3fc-2c963f66afa9",
        requiredMode = Schema.RequiredMode.REQUIRED
    )
    val id: UUID,

    @field:JsonProperty("order_id")
    @field:Schema(
        description = "Уникальный строковый бизнес-код наряда",
        example = "ORD-20261026-0001",
        requiredMode = Schema.RequiredMode.REQUIRED
    )
    val orderId: String,

    @field:JsonProperty("day_id")
    @field:Schema(
        description = "UUID рабочего дня",
        example = "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
        requiredMode = Schema.RequiredMode.REQUIRED
    )
    val dayId: UUID,

    @field:JsonProperty("day_date")
    @field:Schema(
        description = "Дата рабочего дня",
        example = "2026-10-26",
        requiredMode = Schema.RequiredMode.REQUIRED
    )
    val dayDate: LocalDate,

    @field:JsonProperty("service_center_id")
    @field:Schema(
        description = "UUID сервисного центра зоны наряда",
        example = "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e"
    )
    val serviceCenterId: UUID? = null,

    @field:JsonProperty("service_center_code")
    @field:Schema(
        description = "Код сервисного центра зоны наряда",
        example = "SC-01"
    )
    val serviceCenterCode: String? = null,

    @field:JsonProperty("work_type_id")
    @field:Schema(
        description = "UUID типа работ",
        example = "c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f",
        requiredMode = Schema.RequiredMode.REQUIRED
    )
    val workTypeId: UUID,

    @field:JsonProperty("work_type_code")
    @field:Schema(
        description = "Нормативный код типа работ",
        example = "INSTALL_INTERNET_ROUTER",
        requiredMode = Schema.RequiredMode.REQUIRED
    )
    val workTypeCode: WorkTypeCode,

    @field:JsonProperty("work_type_name")
    @field:Schema(
        description = "Наименование типа работ",
        example = "Подключение ШПД + настройка роутера",
        requiredMode = Schema.RequiredMode.REQUIRED
    )
    val workTypeName: String,

    @field:JsonProperty("building_id")
    @field:Schema(
        description = "UUID здания / объекта обслуживания",
        example = "4ba85f64-5717-4562-b3fc-2c963f66afa7",
        requiredMode = Schema.RequiredMode.REQUIRED
    )
    val buildingId: UUID,

    @field:JsonProperty("building_code")
    @field:Schema(
        description = "Код здания из реестра",
        example = "B-00412",
        requiredMode = Schema.RequiredMode.REQUIRED
    )
    val buildingCode: String,

    @field:Schema(
        description = "Фактический адрес объекта",
        example = "г. Екатеринбург, ул. Учителей, 18",
        requiredMode = Schema.RequiredMode.REQUIRED
    )
    val address: String,

    @field:Schema(
        description = "Географическая широта объекта",
        example = "56.8712",
        requiredMode = Schema.RequiredMode.REQUIRED
    )
    val lat: Double,

    @field:Schema(
        description = "Географическая долгота объекта",
        example = "60.6531",
        requiredMode = Schema.RequiredMode.REQUIRED
    )
    val lon: Double,

    @field:JsonProperty("building_type")
    @field:Schema(
        description = "Тип здания (MKD / PRIVATE)",
        example = "MKD",
        requiredMode = Schema.RequiredMode.REQUIRED
    )
    val buildingType: BuildingType,

    @field:JsonProperty("requires_height")
    @field:Schema(
        description = "Требуется ли допуск к работам на высоте (частный сектор с подключением по ВЛС)",
        example = "false",
        requiredMode = Schema.RequiredMode.REQUIRED
    )
    val requiresHeight: Boolean,

    @field:JsonProperty("access_node_id")
    @field:Schema(
        description = "UUID узла доступа связи",
        example = "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        requiredMode = Schema.RequiredMode.REQUIRED
    )
    val accessNodeId: UUID,

    @field:JsonProperty("access_node_code")
    @field:Schema(
        description = "Код узла доступа связи",
        example = "AN-0031",
        requiredMode = Schema.RequiredMode.REQUIRED
    )
    val accessNodeCode: String,

    @field:JsonProperty("registered_at")
    @field:Schema(
        description = "Момент регистрации наряда",
        example = "2026-10-25T14:30:00+05:00",
        requiredMode = Schema.RequiredMode.REQUIRED
    )
    val registeredAt: OffsetDateTime,

    @field:JsonProperty("slot")
    @field:Schema(
        description = "Согласованный с абонентом временной интервал",
        requiredMode = Schema.RequiredMode.REQUIRED
    )
    val slot: io.github.bbsk.c5d.model.day.dto.TimeWindowDto,

    @field:JsonProperty("slot_start")
    @field:Schema(
        description = "Начало согласованного слота",
        example = "2026-10-26T09:00:00+05:00",
        requiredMode = Schema.RequiredMode.REQUIRED
    )
    val slotStart: OffsetDateTime,

    @field:JsonProperty("slot_end")
    @field:Schema(
        description = "Окончание согласованного слота",
        example = "2026-10-26T11:00:00+05:00",
        requiredMode = Schema.RequiredMode.REQUIRED
    )
    val slotEnd: OffsetDateTime,

    @field:JsonProperty("latest_start")
    @field:Schema(
        description = "Крайний допустимый момент начала выполнения",
        example = "2026-10-26T09:10:00+05:00",
        requiredMode = Schema.RequiredMode.REQUIRED
    )
    val latestStart: OffsetDateTime,

    @field:JsonProperty("deadline")
    @field:Schema(
        description = "Контрольный срок выполнения наряда",
        example = "2026-10-26T10:10:00+05:00",
        requiredMode = Schema.RequiredMode.REQUIRED
    )
    val deadline: OffsetDateTime,

    @field:JsonProperty("required_equipment")
    @field:Schema(
        description = "Потребность в абонентском оборудовании (ONT, ROUTER, STB)",
        requiredMode = Schema.RequiredMode.REQUIRED
    )
    val requiredEquipment: EquipmentDto,

    @field:JsonProperty("is_repeat")
    @field:Schema(
        description = "Признак повторного обращения абонента в течение 7 дней",
        example = "false",
        requiredMode = Schema.RequiredMode.REQUIRED
    )
    val isRepeat: Boolean,

    @field:JsonProperty("previous_order_id")
    @field:Schema(
        description = "Код предыдущего наряда абонента (при повторном обращении)",
        example = "ORD-20261020-0045"
    )
    val previousOrderId: String? = null,

    @field:JsonProperty("status")
    @field:Schema(
        description = "Текущий статус наряда",
        example = "PENDING",
        requiredMode = Schema.RequiredMode.REQUIRED
    )
    val status: OrderStatus,

    @field:JsonProperty("is_generated")
    @field:Schema(
        description = "Признак сгенерированного (тестового) наряда",
        example = "false",
        requiredMode = Schema.RequiredMode.REQUIRED
    )
    val isGenerated: Boolean = false
)
