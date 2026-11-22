"""Main FastAPI application module for map-module & VRPTW Solver."""

import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import FileResponse
from core.matrix_loader import matrix_loader
from api.routers.optimize import router as optimize_router
from routers import router as legacy_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("map-module")


class EndpointFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        if "health" in msg:
            return False
        if record.args and any("health" in str(a) for a in record.args):
            return False
        return True


def mute_health_logs():
    endpoint_filter = EndpointFilter()
    access_logger = logging.getLogger("uvicorn.access")
    access_logger.addFilter(endpoint_filter)
    for handler in access_logger.handlers:
        handler.addFilter(endpoint_filter)


mute_health_logs()


@asynccontextmanager
async def lifespan(app: FastAPI):
    mute_health_logs()
    logger.info("Initializing map-module and loading travel matrix...")
    matrix_loader.load_from_file()
    yield
    logger.info("Shutting down map-module...")


app = FastAPI(
    title="Rostelecom Field Force Map Module & Solver",
    description="Routing, map visualization and VRPTW solver engine",
    version="1.0.0",
    lifespan=lifespan
)

# Include legacy map/routing routes
app.include_router(legacy_router)

# Include solver routes (/api/v1/solver/optimize)
app.include_router(optimize_router)


@app.get("/")
async def root():
    return {"status": "ok", "service": "map-module", "docs": "/health"}


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "map-module"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
