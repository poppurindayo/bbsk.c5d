import os
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Tuple
from schemas.request import SolverRequest, OrderInput, StaffInput
from schemas.response import SolverResponse, RouteOutput, UnassignedOrderOutput, StopOutput
from services.compatibility import filter_compatibility
from services.prioritizer import sort_orders_by_priority
from services.timeline_manager import insert_break_and_restock, combine_date_time, parse_time_str
from core.matrix_loader import matrix_loader
from core.config import settings


def _check_route_feasibility(
    staff: StaffInput,
    trial_stops: List[StopOutput],
    trial_visits: List[OrderInput],
    base_date: datetime
) -> Tuple[bool, str | None]:
    """Проверка жёстких ограничений H2/H3/H4 для ВСЕГО варианта маршрута.

    Проверяются все визиты (а не только новый), т.к. вставка сдвигает существующие.
    Возвращает (ok, reason). reason — код причины для unassigned, если не ok.
    """
    shift = staff.shift
    shift_end_dt = combine_date_time(base_date, parse_time_str(shift.end))
    break_from_dt = combine_date_time(base_date, parse_time_str(shift.break_window.from_time))
    break_to_dt = combine_date_time(base_date, parse_time_str(shift.break_window.to_time))

    # H2: возврат в СЦ не позже конца смены
    depot_end = next((s for s in trial_stops if s.type == "DEPOT_END"), None)
    if depot_end is not None and depot_end.arrival > shift_end_dt:
        return False, "NO_SHIFT_TIME"

    visit_stops = [s for s in trial_stops if s.type == "VISIT"]

    # H3: если есть визиты — ровно один BREAK нужной длительности в окне перерыва
    if visit_stops:
        breaks = [s for s in trial_stops if s.type == "BREAK"]
        if len(breaks) != 1:
            return False, "NO_SHIFT_TIME"
        b = breaks[0]
        if (b.end - b.start) < timedelta(minutes=shift.break_duration_min):
            return False, "NO_SHIFT_TIME"
        if b.start < break_from_dt or b.end > break_to_dt:
            return False, "NO_SHIFT_TIME"

    # H4: старт каждого визита строго внутри [slot.start, latest_start]
    visit_by_order = {v.order_id: v for v in trial_visits}
    for s in visit_stops:
        o = visit_by_order.get(s.order_id)
        if o is None:
            continue
        if s.start < o.slot.start or s.start > o.latest_start:
            return False, "SLOT_UNREACHABLE"

    return True, None


def _ensure_matrix_loaded() -> None:
    """Ленивая загрузка/перезагрузка матрицы.

    Солвер грузит матрицу при старте, но бэкенд пишет файл уже после старта
    (мастер тестовых данных). Сверяем mtime и перезагружаем, если файл новый —
    иначе оптимизация остаётся слепой к геометрии (плоские 900 сек на все пары).
    """
    path = os.environ.get("TRAVEL_MATRIX_FILE_PATH", settings.TRAVEL_MATRIX_FILE_PATH)
    try:
        mtime = os.path.getmtime(path)
    except OSError:
        return
    if (not matrix_loader.is_loaded) or (mtime != matrix_loader.last_mtime):
        matrix_loader.load_from_file(path)


# Наряд обслуживает только сотрудники СЦ своей зоны ответственности.
# Если в зоне наряд не вмещается в смену/слот, он остаётся нераспределённым (диспетчер решает
# сам), а не уезжает на другой конец города к сотруднику чужого района.
RESTRICT_TO_HOME_ZONE = True


def _home_service_center_id(building_id: str, service_centers: list) -> str | None:
    """Зона ответственности наряда = СЦ, ближайший к зданию по матрице времени в пути.

    Возвращает None, если зону достоверно определить нельзя (матрица не загружена или не
    содержит точку здания/СЦ — тогда все расстояния «плоские» и выбор был бы случайным).
    """
    if not matrix_loader.is_loaded or building_id not in matrix_loader.point_to_idx:
        return None
    best_id: str | None = None
    best_sec: int | None = None
    for sc in service_centers:
        if sc.building_id not in matrix_loader.point_to_idx:
            return None
        sec, _ = matrix_loader.get_travel(building_id, sc.building_id, None)
        if best_sec is None or sec < best_sec:
            best_id, best_sec = sc.id, sec
    return best_id


def solve_vrptw(request: SolverRequest) -> SolverResponse:
    start_cpu_time = time.perf_counter()

    # Убеждаемся, что актуальная матрица времени в пути загружена
    _ensure_matrix_loaded()

    # Все времена смены — местные (UTC+5, Екатеринбург) по ТЗ. Приводим base_date
    # к +05:00 явно, а не берём tzinfo из request.now (он может прийти в UTC из БД,
                    # из-за чего смены съезжали на +5ч, а слоты оказывались "до смены" → SLOT_UNREACHABLE).
    EKB_TZ = timezone(timedelta(hours=5))
    base_date = datetime.strptime(request.date, "%Y-%m-%d").replace(tzinfo=EKB_TZ)

    # 1. Этап 1: Фильтрация по жестким допускам (H1: профиль, технология, допуск на высоту)
    compatibility = filter_compatibility(request.staff, request.orders)

    # 2. Этап 2: Приоритизация пула нарядов (повторные вес x2, SLA, слоты)
    sorted_orders = sort_orders_by_priority(request.orders)

    # Карты для быстрого доступа
    staff_map = {s.staff_id: s for s in request.staff}
    home_zone_cache: Dict[str, str | None] = {}

    # Инициализация распределения: staff_id -> list[OrderInput]
    staff_assigned_visits: Dict[str, List[OrderInput]] = {
        s.staff_id: [] for s in request.staff
    }

    # Кэш суммарного времени в пути по каждому сотруднику. Нужен для расчёта МАРЖИНАЛЬНОЙ
    # (добавочной) стоимости вставки, а не абсолютной: так каждый наряд уходит географически
    # ближайшему квалифицированному сотруднику, а маршруты остаются компактными.
    staff_current_travel: Dict[str, int] = {s.staff_id: 0 for s in request.staff}

    # Учёт назначенной нагрузки (сумма минут работ) — для равномерного распределения между
    # сотрудниками (минимизация коэффициента вариации загрузки).
    staff_assigned_minutes: Dict[str, int] = {s.staff_id: 0 for s in request.staff}

    # Веса оптимизации (в секундах пути). По ТЗ балансировка (5%) слабее суммарного пробега (15%),
    # поэтому вес нагрузки намеренно умеренный.
    LOAD_WEIGHT_PER_MIN = 2.0

    unassigned: List[UnassignedOrderOutput] = []

    # 3. Этап 3 & 4: Оптимальная вставка по дорожной сети (маржинальная стоимость + балансировка)
    for order in sorted_orders:
        eligible_staff = compatibility.get(order.order_id, [])

        # Зона ответственности: берём только сотрудников СЦ зоны наряда. Если в зоне нет
        # подходящих по квалификации (H1) — не блокируем наряд, разрешаем остальных.
        if RESTRICT_TO_HOME_ZONE and eligible_staff:
            if order.building_id not in home_zone_cache:
                home_zone_cache[order.building_id] = _home_service_center_id(
                    order.building_id, request.service_centers
                )
            home_sc = home_zone_cache[order.building_id]
            if home_sc is not None:
                local_staff = [s for s in eligible_staff if s.service_center_id == home_sc]
                if local_staff:
                    eligible_staff = local_staff

        if not eligible_staff:
            unassigned.append(
                UnassignedOrderOutput(
                    order_id=order.order_id,
                    reason="NO_QUALIFIED_STAFF"
                )
            )
            continue

        best_staff_id: str | None = None
        best_insert_pos: int = -1
        best_cost: float = float("inf")
        best_new_travel: int = 0
        # Причина невключения, если ни одна вставка не прошла жёсткие ограничения
        best_failure_reason: str | None = None

        for staff in eligible_staff:
            sid = staff.staff_id
            current_visits = staff_assigned_visits[sid]
            current_travel = staff_current_travel[sid]
            # Штраф за уже накопленную нагрузку одинаков для всех позиций этого сотрудника,
            # поэтому влияет только на ВЫБОР сотрудника, а не позиции вставки.
            load_penalty = staff_assigned_minutes[sid] * LOAD_WEIGHT_PER_MIN

            # === УСКОРЕНИЕ: вместо перебора ВСЕХ позиций (O(n) полных пересчётов таймлайна)
            # пробуем лишь несколько перспективных: начало, конец и позицию рядом с
            # географически ближайшим визитом (по матрице). Это даёт кратное ускорение
            # на больших объёмах (сотни-тысячи нарядов) без заметной потери качества.
            n = len(current_visits)
            candidate_positions = {0, n}
            if n > 0:
                nearest_idx = 0
                nearest_sec = 10 ** 9
                for idx, v in enumerate(current_visits):
                    d_sec, _ = matrix_loader.get_travel(order.building_id, v.building_id, None)
                    if d_sec < nearest_sec:
                        nearest_sec = d_sec
                        nearest_idx = idx
                candidate_positions.add(nearest_idx)
                candidate_positions.add(min(n, nearest_idx + 1))

            # Для данного сотрудника ищем позицию с минимальным суммарным путём маршрута,
            # но ТОЛЬКО среди позиций, проходящих жёсткие ограничения H2/H3/H4.
            staff_best_pos = -1
            staff_best_new_travel = 10 ** 9
            for pos in candidate_positions:
                trial_visits = current_visits[:pos] + [order] + current_visits[pos:]
                trial_stops, _ = insert_break_and_restock(
                    staff, trial_visits, request.service_centers, base_date
                )
                ok, reason = _check_route_feasibility(staff, trial_stops, trial_visits, base_date)
                if not ok:
                    # Запоминаем причину (SLOT_UNREACHABLE приоритетнее — это ключевая метрика)
                    if reason == "SLOT_UNREACHABLE" or best_failure_reason is None:
                        best_failure_reason = reason
                    continue
                new_travel = sum(s.travel_sec for s in trial_stops)
                if new_travel < staff_best_new_travel:
                    staff_best_new_travel = new_travel
                    staff_best_pos = pos

            if staff_best_pos == -1:
                continue

            # Маржинальная (добавочная) стоимость: насколько вырастет путь сотрудника.
            added_travel = staff_best_new_travel - current_travel
            cost = added_travel + load_penalty

            if cost < best_cost:
                best_cost = cost
                best_staff_id = sid
                best_insert_pos = staff_best_pos
                best_new_travel = staff_best_new_travel

        if best_staff_id is not None and best_insert_pos != -1:
            staff_assigned_visits[best_staff_id].insert(best_insert_pos, order)
            staff_current_travel[best_staff_id] = best_new_travel
            staff_assigned_minutes[best_staff_id] += order.duration_min
        else:
            # Не удалось уложить наряд в слот/смену ни у одного сотрудника
            unassigned.append(
                UnassignedOrderOutput(
                    order_id=order.order_id,
                    reason=best_failure_reason or "NO_QUALIFIED_STAFF"
                )
            )

    # 4. Локальный поиск 2-Opt для оптимизации маршрутов
    for staff_id, visits in staff_assigned_visits.items():
        if len(visits) >= 3:
            staff = staff_map[staff_id]
            improved = True
            iterations = 0
            while improved and iterations < 10:
                improved = False
                iterations += 1
                # Текущий маршрут не меняется до первой удачной перестановки — считаем его
                # длину один раз на проход, а не на каждой паре (i, j).
                old_stops, _ = insert_break_and_restock(
                    staff, visits, request.service_centers, base_date
                )
                old_travel = sum(s.travel_sec for s in old_stops)
                for i in range(len(visits) - 1):
                    for j in range(i + 1, min(len(visits), i + 4)):
                        # Пробуем перевернуть отрезок между i и j
                        new_visits = visits[:i] + list(reversed(visits[i:j+1])) + visits[j+1:]
                        new_stops, _ = insert_break_and_restock(
                            staff, new_visits, request.service_centers, base_date
                        )
                        # Принимаем перестановку только если она не нарушает H2/H3/H4
                        ok, _ = _check_route_feasibility(staff, new_stops, new_visits, base_date)
                        if ok and sum(s.travel_sec for s in new_stops) < old_travel:
                            visits = new_visits
                            staff_assigned_visits[staff_id] = new_visits
                            improved = True
                            break
                    if improved:
                        break

    # 5. Формирование финальных маршрутов
    routes_output: List[RouteOutput] = []
    assigned_order_ids = set()

    for staff in request.staff:
        visits = staff_assigned_visits[staff.staff_id]
        stops, _ = insert_break_and_restock(
            staff, visits, request.service_centers, base_date
        )

        for s in stops:
            if s.type == "VISIT" and s.order_id:
                assigned_order_ids.add(s.order_id)

        tot_travel_sec = sum(s.travel_sec for s in stops)
        tot_work_min = sum(
            int((s.end - s.start).total_seconds() // 60)
            for s in stops if s.type == "VISIT"
        )

        route = RouteOutput(
            staff_id=staff.staff_id,
            stops=stops,
            total_travel_sec=tot_travel_sec,
            total_work_min=tot_work_min,
            total_orders=len(visits)
        )
        routes_output.append(route)

    # 6. Этап 6: Гарантия уникальности (H9)
    # Каждый наряд дня обязан присутствовать ровно в 1 месте (VISIT или unassigned)
    unassigned_ids = {u.order_id for u in unassigned}
    for order in request.orders:
        oid = order.order_id
        if oid not in assigned_order_ids and oid not in unassigned_ids:
            unassigned.append(
                UnassignedOrderOutput(
                    order_id=oid,
                    reason="NO_QUALIFIED_STAFF"
                )
            )

    execution_time_ms = int((time.perf_counter() - start_cpu_time) * 1000)

    return SolverResponse(
        status="SUCCESS",
        execution_time_ms=max(1, execution_time_ms),
        routes=routes_output,
        unassigned_orders=unassigned
    )
