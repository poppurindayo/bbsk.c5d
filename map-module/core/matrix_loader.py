import json
import logging
import os
from pathlib import Path
from typing import Dict, Tuple

logger = logging.getLogger(__name__)


class TravelMatrix:
    def __init__(self):
        self.point_to_idx: Dict[str, int] = {}
        self.durations_sec: list[list[int]] = []
        self.distances_m: list[list[int]] = []
        self.hourly_factors: Dict[int, float] = {}
        self.is_loaded: bool = False
        self.last_mtime: float = 0.0

    def load_from_file(self, explicit_path: str | None = None) -> bool:
        candidates = []
        if explicit_path:
            candidates.append(Path(explicit_path))
        env_path = os.environ.get("TRAVEL_MATRIX_FILE_PATH")
        if env_path:
            candidates.append(Path(env_path))

        candidates.extend([
            Path("travel_matrix.json"),
            Path("../travel_matrix.json"),
            Path("../../travel_matrix.json"),
            Path("/app/data/travel_matrix.json"),
            Path("data/travel_matrix.json"),
        ])

        found_path: Path | None = None
        for path in candidates:
            if path and path.exists() and path.is_file():
                found_path = path
                break

        if not found_path:
            logger.warning(
                "Travel matrix file not found in any standard location. Using default estimates (900 sec, 3000 m)."
            )
            self.is_loaded = False
            return False

        try:
            with open(found_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            points = data.get("points", [])
            self.point_to_idx = {p: i for i, p in enumerate(points)}
            self.durations_sec = data.get("durations_sec", [])
            self.distances_m = data.get("distances_m", [])

            factors = data.get("hourly_factors", [])
            if factors:
                for hf in factors:
                    self.hourly_factors[hf["hour"]] = float(hf["factor"])

            self.is_loaded = True
            try:
                self.last_mtime = os.path.getmtime(found_path)
            except OSError:
                self.last_mtime = 0.0
            logger.info("Loaded travel matrix from %s with %d points", found_path, len(points))
            return True
        except Exception as e:
            logger.error("Failed to load travel matrix from %s: %s", found_path, e)
            self.is_loaded = False
            return False

    def get_travel(
        self, from_id: str, to_id: str, hour: int | None = None
    ) -> Tuple[int, int]:
        """
        Returns (travel_time_sec, distance_m)
        """
        if from_id == to_id:
            return 0, 0

        if (
            self.is_loaded
            and from_id in self.point_to_idx
            and to_id in self.point_to_idx
        ):
            from_idx = self.point_to_idx[from_id]
            to_idx = self.point_to_idx[to_id]
            sec = self.durations_sec[from_idx][to_idx]
            dist = (
                self.distances_m[from_idx][to_idx]
                if self.distances_m
                else sec * 8
            )

            if hour is not None and hour in self.hourly_factors:
                sec = int(round(sec * self.hourly_factors[hour]))

            return max(60, sec), max(100, dist)

        # Default fallback if matrix doesn't contain this pair
        return 900, 3000


matrix_loader = TravelMatrix()
