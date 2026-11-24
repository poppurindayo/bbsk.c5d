import json

import pytest

from core.matrix_loader import matrix_loader
from schemas.request import SolverRequest
from services import vrp_solver
from services.vrp_solver import solve_vrptw

# Две зоны: СЦ-A и СЦ-B далеко друг от друга; B-A рядом с A, B-B рядом с B
POINTS = ["SC-A", "SC-B", "B-A", "B-B"]
DURATIONS = [
    [0, 2400, 300, 2300],
    [2400, 0, 2500, 300],
    [300, 2500, 0, 2600],
    [2300, 300, 2600, 0],
]


@pytest.fixture(autouse=True)
def matrix(tmp_path, monkeypatch):
    path = tmp_path / "travel_matrix.json"
    path.write_text(json.dumps({
        "points": POINTS,
        "durations_sec": DURATIONS,
        "distances_m": [[d * 8 for d in row] for row in DURATIONS],
    }))
    monkeypatch.setenv("TRAVEL_MATRIX_FILE_PATH", str(path))
    matrix_loader.load_from_file(str(path))
    yield
    matrix_loader.is_loaded = False
    matrix_loader.point_to_idx = {}
    matrix_loader.durations_sec = []
    matrix_loader.distances_m = []
    matrix_loader.last_mtime = 0.0


def _staff(staff_id, sc, shift_end="18:00", profiles=("INSTALL",)):
    return {
        "staff_id": staff_id, "service_center_id": sc, "profiles": list(profiles),
        "technologies": ["PON"], "height_permit": True,
        "shift": {"start": "09:00", "end": shift_end, "break_duration_min": 60,
                  "break_window": {"from": "12:00", "to": "15:00"}},
        "equipment_start": {"ONT": 3, "ROUTER": 3, "STB": 3},
        "equipment_capacity": {"ONT": 6, "ROUTER": 6, "STB": 6},
    }


def _request(staff, building="B-A"):
    return SolverRequest.model_validate({
        "date": "2026-11-25",
        "now": "2026-11-25T08:00:00+05:00",
        "service_centers": [
            {"id": "SC-A", "building_id": "SC-A"},
            {"id": "SC-B", "building_id": "SC-B"},
        ],
        "staff": staff,
        "orders": [{
            "order_id": "ORD-1", "building_id": building, "work_type": "INST_PON_MKD",
            "profiles": ["INSTALL"], "technology": "PON", "requires_height": False,
            "duration_min": 60,
            "slot": {"start": "2026-11-25T11:00:00+05:00", "end": "2026-11-25T13:00:00+05:00"},
            "latest_start": "2026-11-25T11:10:00+05:00",
            "deadline": "2026-11-25T13:00:00+05:00",
            "required_equipment": {"ONT": 1, "ROUTER": 1, "STB": 0},
        }],
    })


def _assigned_to(res):
    return [r.staff_id for r in res.routes if r.total_orders > 0]


def test_order_goes_to_home_zone_staff():
    res = solve_vrptw(_request([_staff("A1", "SC-A"), _staff("B1", "SC-B")]))
    assert _assigned_to(res) == ["A1"]


def test_order_not_sent_to_foreign_zone_when_home_cannot_fit():
    # Сотрудник зоны A уходит со смены в 10:00 и не успевает на слот 11:00,
    # сотрудник зоны B свободен — но это чужой район, наряд остаётся нераспределённым.
    res = solve_vrptw(_request([_staff("A1", "SC-A", shift_end="10:00"), _staff("B1", "SC-B")]))
    assert _assigned_to(res) == []
    assert [u.order_id for u in res.unassigned_orders] == ["ORD-1"]


def test_foreign_zone_allowed_when_home_zone_has_no_qualified_staff():
    # В зоне A нет сотрудника нужного профиля (H1) — наряд не блокируем, берём из другой зоны
    res = solve_vrptw(_request([_staff("A1", "SC-A", profiles=("LTP3",)), _staff("B1", "SC-B")]))
    assert _assigned_to(res) == ["B1"]


def test_restriction_can_be_disabled(monkeypatch):
    monkeypatch.setattr(vrp_solver, "RESTRICT_TO_HOME_ZONE", False)
    res = solve_vrptw(_request([_staff("A1", "SC-A", shift_end="10:00"), _staff("B1", "SC-B")]))
    assert _assigned_to(res) == ["B1"]


def test_zone_unknown_when_matrix_lacks_points():
    # Здание не в матрице — зону определить нельзя, ограничение не применяется
    assert vrp_solver._home_service_center_id("B-UNKNOWN", _request([_staff("A1", "SC-A")]).service_centers) is None
