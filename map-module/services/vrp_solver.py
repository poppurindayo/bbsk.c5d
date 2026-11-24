import os
import time
from datetime import datetime
from typing import Dict, List
from schemas.request import SolverRequest, OrderInput
from schemas.response import SolverResponse, RouteOutput, UnassignedOrderOutput
from services.compatibility import filter_compatibility
from services.prioritizer import sort_orders_by_priority
from services.timeline_manager import insert_break_and_restock
from core.matrix_loader import matrix_loader
from core.config import settings


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


def solve_vrptw(request: SolverRequest) -> SolverResponse:
    start_cpu_time = time.perf_counter()

    # Убеждаемся, что актуальная матрица времени в пути загружена
    _ensure_matrix_loaded()

    base_date = datetime.strptime(request.date, "%Y-%m-%d").replace(
        tzinfo=request.now.tzinfo
    )

    # 1. Этап 1: Фильтрация по жестким допускам (H1: профиль, технология, допуск на высоту)
    compatibility = filter_compatibility(request.staff, request.orders)

    # 2. Этап 2: Приоритизация пула нарядов (повторные вес x2, SLA, слоты)
    sorted_orders = sort_orders_by_priority(request.orders)

    # Карты для быстрого доступа
    staff_map = {s.staff_id: s for s in request.staff}

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

        for staff in eligible_staff:
            sid = staff.staff_id
            current_visits = staff_assigned_visits[sid]
            current_travel = staff_current_travel[sid]
            # Штраф за уже накопленную нагрузку одинаков для всех позиций этого сотрудника,
            # поэтому влияет только на ВЫБОР сотрудника, а не позиции вставки.
            load_penalty = staff_assigned_minutes[sid] * LOAD_WEIGHT_PER_MIN

            # Для данного сотрудника ищем позицию с минимальным суммарным путём маршрута.
            staff_best_pos = -1
            staff_best_new_travel = 10 ** 9
            for pos in range(len(current_visits) + 1):
                trial_visits = current_visits[:pos] + [order] + current_visits[pos:]
                trial_stops, _ = insert_break_and_restock(
                    staff, trial_visits, request.service_centers, base_date
                )
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
            # Fallback (в случае отсутствия свободных мест)
            unassigned.append(
                UnassignedOrderOutput(
                    order_id=order.order_id,
                    reason="NO_QUALIFIED_STAFF"
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
                for i in range(len(visits) - 1):
                    for j in range(i + 1, min(len(visits), i + 4)):
                        # Пробуем перевернуть отрезок между i и j
                        new_visits = visits[:i] + list(reversed(visits[i:j+1])) + visits[j+1:]
                        old_stops, _ = insert_break_and_restock(
                            staff, visits, request.service_centers, base_date
                        )
                        new_stops, _ = insert_break_and_restock(
                            staff, new_visits, request.service_centers, base_date
                        )
                        if sum(s.travel_sec for s in new_stops) < sum(s.travel_sec for s in old_stops):
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
