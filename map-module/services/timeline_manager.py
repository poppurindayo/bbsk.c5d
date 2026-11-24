from datetime import datetime, timedelta, time
from typing import Dict, List, Tuple
from schemas.request import OrderInput, StaffInput, ServiceCenterInput, FrozenStopInput
from schemas.response import StopOutput
from core.matrix_loader import matrix_loader


def parse_time_str(time_str: str) -> time:
    parts = time_str.split(":")
    return time(hour=int(parts[0]), minute=int(parts[1]))


def combine_date_time(base_dt: datetime, t: time) -> datetime:
    return base_dt.replace(
        hour=t.hour,
        minute=t.minute,
        second=t.second,
        microsecond=0
    )


def insert_break_and_restock(
    staff: StaffInput,
    visits: List[OrderInput],
    service_centers: List[ServiceCenterInput],
    base_date_dt: datetime
) -> Tuple[List[StopOutput], bool]:
    """
    Этап 5: Движок таймлайна
    - Начало в базовом СЦ (DEPOT_START)
    - Вставка frozen_stops (если перепланирование)
    - Вставка VISIT с контролем запасов АО и заездом на RESTOCK при дефиците
    - Вставка BREAK (60 мин) строго в окне смены [break_from, break_to]
    - Возврат в базовый СЦ (DEPOT_END) до конца смены
    Возвращает (список_остановок, успешно_ли_уложились_в_смену)
    """
    sc_map = {sc.id: sc for sc in service_centers}
    base_sc = sc_map.get(staff.service_center_id) or service_centers[0]
    depot_building = base_sc.building_id

    shift_start_t = parse_time_str(staff.shift.start)
    shift_end_t = parse_time_str(staff.shift.end)
    break_from_t = parse_time_str(staff.shift.break_window.from_time)
    break_to_t = parse_time_str(staff.shift.break_window.to_time)

    shift_start_dt = combine_date_time(base_date_dt, shift_start_t)
    shift_end_dt = combine_date_time(base_date_dt, shift_end_t)
    break_from_dt = combine_date_time(base_date_dt, break_from_t)
    break_to_dt = combine_date_time(base_date_dt, break_to_t)

    # Начальный баланс оборудования
    balance = {
        "ONT": staff.equipment_start.get("ONT", 0),
        "ROUTER": staff.equipment_start.get("ROUTER", 0),
        "STB": staff.equipment_start.get("STB", 0),
    }

    stops: List[StopOutput] = []
    seq = 1

    # 1. DEPOT_START
    depot_start = StopOutput(
        seq=seq,
        type="DEPOT_START",
        order_id=None,
        building_id=depot_building,
        arrival=shift_start_dt,
        start=shift_start_dt,
        end=shift_start_dt,
        travel_sec=0,
        equipment_after=dict(balance)
    )
    stops.append(depot_start)
    seq += 1

    current_time = shift_start_dt
    current_building = depot_building
    break_inserted = False

    # Если уже есть замороженные остановки (frozen_stops)
    if staff.frozen_stops:
        for fs in staff.frozen_stops:
            if fs.type == "DEPOT_START":
                continue
            stop = StopOutput(
                seq=seq,
                type=fs.type,
                order_id=fs.order_id,
                building_id=fs.building_id,
                arrival=fs.arrival,
                start=fs.start,
                end=fs.end,
                travel_sec=fs.travel_sec,
                equipment_after=dict(fs.equipment_after)
            )
            stops.append(stop)
            seq += 1
            current_time = fs.end
            current_building = fs.building_id
            balance = dict(fs.equipment_after)
            if fs.type == "BREAK":
                break_inserted = True

    # Функция проверки и вставки обеда, если пришло время
    def try_insert_break(prev_building: str, cur_dt: datetime) -> Tuple[datetime, bool]:
        nonlocal break_inserted, seq
        if break_inserted:
            return cur_dt, False

        # Обед должен начаться не ранее break_from_dt и закончиться не позднее break_to_dt
        # Длительность — не меньше break_duration_min из смены (H3)
        break_start = max(cur_dt, break_from_dt)
        break_end = break_start + timedelta(minutes=staff.shift.break_duration_min)

        if break_end <= break_to_dt:
            # Можно вставить обед прямо здесь!
            break_stop = StopOutput(
                seq=seq,
                type="BREAK",
                order_id=None,
                building_id=prev_building,
                arrival=break_start,
                start=break_start,
                end=break_end,
                travel_sec=0,
                equipment_after=dict(balance)
            )
            stops.append(break_stop)
            seq += 1
            break_inserted = True
            return break_end, True

        return cur_dt, False

    # Обработка визитов
    for visit in visits:
        # Проверяем, нужно ли вставить обед до этого визита (если мы в окне обеда)
        if not break_inserted and current_time >= break_from_dt:
            current_time, inserted = try_insert_break(current_building, current_time)

        # Проверка баланса оборудования для визита
        req = visit.required_equipment
        need_restock = any(balance.get(k, 0) < req.get(k, 0) for k in ["ONT", "ROUTER", "STB"])

        if need_restock:
            # Ищем ближайший СЦ для пополнения
            best_sc = base_sc
            best_travel_sec = 999999
            for sc in service_centers:
                t_sec, _ = matrix_loader.get_travel(current_building, sc.building_id, current_time.hour)
                if t_sec < best_travel_sec:
                    best_travel_sec = t_sec
                    best_sc = sc

            # Переезд в СЦ
            sc_arrival = current_time + timedelta(seconds=best_travel_sec)
            restock_start = sc_arrival
            restock_end = restock_start + timedelta(minutes=best_sc.restock_duration_min)

            # Восстановление запаса до емкости
            balance = {
                "ONT": staff.equipment_capacity.get("ONT", 6),
                "ROUTER": staff.equipment_capacity.get("ROUTER", 6),
                "STB": staff.equipment_capacity.get("STB", 4),
            }

            restock_stop = StopOutput(
                seq=seq,
                type="RESTOCK",
                order_id=None,
                building_id=best_sc.building_id,
                arrival=sc_arrival,
                start=restock_start,
                end=restock_end,
                travel_sec=best_travel_sec,
                equipment_after=dict(balance)
            )
            stops.append(restock_stop)
            seq += 1

            current_time = restock_end
            current_building = best_sc.building_id

            # Проверяем обед после пополнения
            if not break_inserted and current_time >= break_from_dt:
                current_time, inserted = try_insert_break(current_building, current_time)

        # Переезд к объекту визита
        travel_sec, _ = matrix_loader.get_travel(current_building, visit.building_id, current_time.hour)
        arrival_dt = current_time + timedelta(seconds=travel_sec)

        # Начало визита: не раньше приезда и не раньше начала слота
        visit_start = max(arrival_dt, visit.slot.start)

        # Проверяем, не наступило ли окно обеда ДО визита во время технологического ожидания
        if not break_inserted and arrival_dt < break_from_dt and visit.slot.start >= break_from_dt + timedelta(minutes=60):
            # Вставляем обед во время ожидания!
            current_time, inserted = try_insert_break(visit.building_id, break_from_dt)
            visit_start = max(current_time, visit.slot.start)

        visit_end = visit_start + timedelta(minutes=visit.duration_min)

        # Списание оборудования
        for k in ["ONT", "ROUTER", "STB"]:
            balance[k] = max(0, balance.get(k, 0) - req.get(k, 0))

        visit_stop = StopOutput(
            seq=seq,
            type="VISIT",
            order_id=visit.order_id,
            building_id=visit.building_id,
            arrival=arrival_dt,
            start=visit_start,
            end=visit_end,
            travel_sec=travel_sec,
            equipment_after=dict(balance)
        )
        stops.append(visit_stop)
        seq += 1

        current_time = visit_end
        current_building = visit.building_id

    # Если обед все еще не вставлен, а визиты были, пытаемся вставить его сейчас
    if visits and not break_inserted:
        current_time, _ = try_insert_break(current_building, current_time)

    # 4. DEPOT_END: возвращение в базовый СЦ
    ret_travel_sec, _ = matrix_loader.get_travel(current_building, depot_building, current_time.hour)
    depot_arrival = current_time + timedelta(seconds=ret_travel_sec)

    depot_end = StopOutput(
        seq=seq,
        type="DEPOT_END",
        order_id=None,
        building_id=depot_building,
        arrival=depot_arrival,
        start=depot_arrival,
        end=depot_arrival,
        travel_sec=ret_travel_sec,
        equipment_after=dict(balance)
    )
    stops.append(depot_end)

    feasible = depot_arrival <= (shift_end_dt + timedelta(minutes=15))
    return stops, feasible
