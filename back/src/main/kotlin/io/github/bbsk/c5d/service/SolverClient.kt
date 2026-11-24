package io.github.bbsk.c5d.service

import io.github.bbsk.c5d.exception.ApiException
import io.github.bbsk.c5d.model.solver.dto.SolverRequestDto
import io.github.bbsk.c5d.model.solver.dto.SolverResponseDto
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.stereotype.Service
import org.springframework.web.client.RestClient

@Service
class SolverClient(
    private val solverRestClient: RestClient
) {
    private val logger = LoggerFactory.getLogger(SolverClient::class.java)

    fun optimize(request: SolverRequestDto): SolverResponseDto {
        logger.info("Sending optimize request to solver for date={}, staffCount={}, ordersCount={}",
            request.date, request.staff.size, request.orders.size)

        return try {
            solverRestClient.post()
                .uri("/api/v1/solver/optimize")
                .contentType(MediaType.APPLICATION_JSON)
                .body(request)
                .retrieve()
                .body(SolverResponseDto::class.java)
                ?: throw ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "SOLVER_EMPTY_RESPONSE", "Солвер вернул пустой ответ")
        } catch (e: Exception) {
            logger.error("Error communicating with Python Solver: {}", e.message, e)
            throw ApiException(HttpStatus.SERVICE_UNAVAILABLE, "SOLVER_UNAVAILABLE", "Ошибка обращения к сервису оптимизации маршрутов: ${e.message}", cause = e)
        }
    }

    /**
     * Проверка доступности солвера (GET /health). Используется фронтендом через
     * бэкенд-прокси, чтобы не обращаться к внутреннему сервису напрямую из браузера.
     */
    fun ping(): Boolean {
        return try {
            solverRestClient.get()
                .uri("/health")
                .retrieve()
                .toBodilessEntity()
            true
        } catch (e: Exception) {
            logger.warn("Solver health check failed: {}", e.message)
            false
        }
    }
}
