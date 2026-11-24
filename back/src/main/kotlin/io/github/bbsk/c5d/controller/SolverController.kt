package io.github.bbsk.c5d.controller

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@Tag(name = "Солвер маршрутизации", description = "Проверка доступности Python-солвера через бэкенд")
@RestController
@RequestMapping("/api/v1/solver")
class SolverController(
    private val solverClient: io.github.bbsk.c5d.service.SolverClient
) {

    @Operation(
        summary = "Статус солвера",
        description = "Проверяет доступность Python-сервиса оптимизации маршрутов (GET /health) и возвращает online/offline."
    )
    @ApiResponse(responseCode = "200", description = "Статус солвера получен")
    @GetMapping("/health")
    fun health(): ResponseEntity<Map<String, Any>> {
        val online = solverClient.ping()
        return ResponseEntity.ok(
            mapOf(
                "status" to if (online) "online" else "offline",
                "service" to "solver"
            )
        )
    }
}