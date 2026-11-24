/**
 * Время в системе — по Екатеринбургу (UTC+5), см. ТЗ.
 *
 * Бэкенд (Jackson) приводит OffsetDateTime к UTC, поэтому слот "09:00+05:00"
 * может прийти как "04:00:00Z". Нельзя резать ISO-строку по символам
 * (substring(11, 16)) — это даёт 04:00 вместо 09:00. Всегда конвертируем
 * момент времени в зону Asia/Yekaterinburg.
 */
export const APP_TIME_ZONE = 'Asia/Yekaterinburg'

const clockFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: APP_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function clockParts(iso: string): { h: string; m: string; s: string } | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const parts = clockFormatter.formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return { h: get('hour'), m: get('minute'), s: get('second') }
}

/** "2026-11-25T04:00:00Z" -> "09:00" (UTC+5). Пустое/битое значение -> fallback. */
export function formatClock(iso: string | null | undefined, fallback = '—'): string {
  const p = clockParts(iso ?? '')
  return p ? `${p.h}:${p.m}` : fallback
}

/** То же, но с секундами: "09:00:00". */
export function formatClockSeconds(iso: string | null | undefined, fallback = '—'): string {
  const p = clockParts(iso ?? '')
  return p ? `${p.h}:${p.m}:${p.s}` : fallback
}

/**
 * Минуты от полуночи по UTC+5. Принимает ISO-строку ("...T09:00:00+05:00" / "...Z")
 * или просто "HH:mm" (тогда считается, что это уже локальное время).
 */
export function toMinutesOfDay(value: string | null | undefined): number {
  if (!value) return 0
  if (!value.includes('T')) {
    const [h, m] = value.substring(0, 5).split(':').map(Number)
    return h * 60 + m
  }
  const p = clockParts(value)
  return p ? Number(p.h) * 60 + Number(p.m) : 0
}
