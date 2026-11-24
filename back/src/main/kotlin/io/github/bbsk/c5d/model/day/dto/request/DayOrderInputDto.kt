package io.github.bbsk.c5d.model.day.dto.request

import com.fasterxml.jackson.annotation.JsonProperty
import io.github.bbsk.c5d.model.day.dto.TimeWindowDto
import io.github.bbsk.c5d.model.reference.dto.EquipmentDto
import io.swagger.v3.oas.annotations.media.Schema
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import java.time.OffsetDateTime

@Schema(description = "Входные данные наряда для пакетной загрузки дня")
data class DayOrderInputDto(
    @field:JsonProperty("order_id")
    @field:NotBlank(message = "Код наряда (order_id) обязателен")
    @field:Schema(description = "Номер / код наряда", example = "ORD-20261026-0001", requiredMode = Schema.RequiredMode.REQUIRED)
    val orderId: String,

    @field:JsonProperty("building_id")
    @field:NotBlank(message = "Идентификатор или код здания (building_id) обязателен")
    @field:Schema(description = "UUID или символьный код здания (например, B-00412)", example = "B-00412", requiredMode = Schema.RequiredMode.REQUIRED)
    val buildingId: String,

    @field:JsonProperty("work_type_id")
    @field:Schema(description = "UUID или символьный код типа работ", example = "INST_PON_MKD")
    val workTypeId: String? = null,

    @field:JsonProperty("work_type")
    @field:Schema(description = "Символьный код типа работ (альтернатива work_type_id)", example = "INST_PON_MKD")
    val workTypeCode: String? = null,

    @field:JsonProperty("access_node_id")
    @field:Schema(description = "UUID или символьный код узла доступа", example = "AN-001")
    val accessNodeId: String? = null,

    @field:JsonProperty("service_center_id")
    @field:Schema(description = "UUID или символьный код сервисного центра", example = "SC-01")
    val serviceCenterId: String? = null,

    @field:JsonProperty("registered_at")
    @field:NotNull(message = "Время регистрации наряда (registered_at) обязательно")
    @field:Schema(description = "Дата и время регистрации заявки в системе", example = "2026-10-25T14:30:00+05:00", requiredMode = Schema.RequiredMode.REQUIRED)
    val registeredAt: OffsetDateTime,

    @field:JsonProperty("slot")
    @field:Schema(description = "Согласованный интервал визита (слот)")
    val slot: TimeWindowDto? = null,

    @field:JsonProperty("slot_start")
    @field:Schema(description = "Начало слота визита (если не передан в объекте slot)", example = "2026-10-26T09:00:00+05:00")
    val slotStart: OffsetDateTime? = null,

    @field:JsonProperty("slot_end")
    @field:Schema(description = "Окончание слота визита (если не передан в объекте slot)", example = "2026-10-26T11:00:00+05:00")
    val slotEnd: OffsetDateTime? = null,

    @field:JsonProperty("latest_start")
    @field:Schema(description = "Крайнее время начала работ", example = "2026-10-26T11:00:00+05:00")
    val latestStart: OffsetDateTime? = null,

    @field:JsonProperty("deadline")
    @field:Schema(description = "Контрольный срок SLA", example = "2026-10-26T18:00:00+05:00")
    val deadline: OffsetDateTime? = null,

    @field:JsonProperty("required_equipment")
    @field:Schema(description = "Потребность в абонентском оборудовании")
    val requiredEquipment: EquipmentDto? = null,

    @field:JsonProperty("required_ont")
    val requiredOnt: Int? = null,

    @field:JsonProperty("required_router")
    val requiredRouter: Int? = null,

    @field:JsonProperty("required_stb")
    val requiredStb: Int? = null,

    @field:JsonProperty("is_repeat")
    @field:Schema(description = "Признак повторного обращения", example = "false")
    val isRepeat: Boolean = false,

    @field:JsonProperty("previous_order_id")
    @field:Schema(description = "Номер первичного наряда при повторном обращении", example = "ORD-20261020-0042")
    val previousOrderId: String? = null,

    @field:JsonProperty("is_generated")
    @field:Schema(description = "Признак сгенерированного (тестового) наряда", example = "false")
    val isGenerated: Boolean = false
)
