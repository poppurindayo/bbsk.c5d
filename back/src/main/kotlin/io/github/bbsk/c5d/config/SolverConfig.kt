package io.github.bbsk.c5d.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.client.SimpleClientHttpRequestFactory
import org.springframework.web.client.RestClient
import java.time.Duration

@Configuration
class SolverConfig(
    @Value("\${app.solver.url:http://localhost:8000}")
    val url: String,

    @Value("\${app.solver.connect-timeout-ms:3000}")
    val connectTimeoutMs: Long,

    @Value("\${app.solver.read-timeout-ms:300000}")
    val readTimeoutMs: Long
) {

    @Bean
    fun solverRestClient(): RestClient {
        val requestFactory = SimpleClientHttpRequestFactory().apply {
            setConnectTimeout(Duration.ofMillis(connectTimeoutMs))
            setReadTimeout(Duration.ofMillis(readTimeoutMs))
        }
        return RestClient.builder()
            .baseUrl(url)
            .requestFactory(requestFactory)
            .build()
    }
}
