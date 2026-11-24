package io.github.bbsk.c5d.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource

@Configuration
@EnableWebSecurity
class SecurityConfig(
    private val jwtAuthenticationFilter: JwtAuthenticationFilter
) {

    @Bean
    fun passwordEncoder(): PasswordEncoder = BCryptPasswordEncoder()

    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain {
        http
            .csrf { it.disable() }
            .cors { it.configurationSource(corsConfigurationSource()) }
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .authorizeHttpRequests { auth ->
                auth
                    .requestMatchers("/api/v1/health").permitAll()
                    .requestMatchers("/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**").permitAll()
                    .requestMatchers("/auth/**", "/api/auth/**").permitAll()
                    // Reference / НСИ — только ADMIN
                    .requestMatchers("/api/v1/reference/**").hasRole("ADMIN")
                    // Staff CRUD — только ADMIN
                    .requestMatchers("/api/v1/staff/**").hasRole("ADMIN")
                    // Buildings / Service Centers / Access Nodes — только ADMIN
                    .requestMatchers("/api/v1/buildings/**").hasRole("ADMIN")
                    // Work Types — только ADMIN
                    .requestMatchers("/api/v1/work-types/**").hasRole("ADMIN")
                    // Days init / events — DISPATCHER и ADMIN
                    .requestMatchers("/api/v1/days/*/events").hasAnyRole("DISPATCHER", "ADMIN")
                    .requestMatchers("/api/v1/days/*/plan").hasAnyRole("DISPATCHER", "ADMIN")
                    .requestMatchers("/api/v1/days/*").hasAnyRole("DISPATCHER", "ADMIN")
                    // Orders — DISPATCHER и ADMIN
                    .requestMatchers("/api/v1/orders/**").hasAnyRole("DISPATCHER", "ADMIN")
                    // Solver — DISPATCHER и ADMIN
                    .requestMatchers("/api/v1/solver/**").hasAnyRole("DISPATCHER", "ADMIN")
                    // Everything else requires authentication
                    .anyRequest().authenticated()
            }
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter::class.java)

        return http.build()
    }

    @Bean
    fun corsConfigurationSource(): CorsConfigurationSource {
        val configuration = CorsConfiguration().apply {
            allowedOriginPatterns = listOf("*")
            allowedMethods = listOf("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH")
            allowedHeaders = listOf("*")
            allowCredentials = true
        }
        val source = UrlBasedCorsConfigurationSource()
        source.registerCorsConfiguration("/**", configuration)
        return source
    }
}
