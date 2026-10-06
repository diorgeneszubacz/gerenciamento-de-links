import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MySQL connection (SQLAlchemy async)
from lib.db import engine, init_db  # noqa: E402
from lib.seed import seed_defaults  # noqa: E402
from routers import admin, auth, portal, system, users  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    try:
        await seed_defaults()
    except Exception as exc:
        logger.error("seed_defaults failed: %s", exc)
    yield
    await engine.dispose()


app = FastAPI(lifespan=lifespan)

api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"message": "Server Hub API"}


api_router.include_router(auth.router)
api_router.include_router(portal.router)
api_router.include_router(admin.router)
api_router.include_router(users.router)
api_router.include_router(system.router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the router in the main app
app.include_router(api_router)

# Production: serve the compiled frontend (frontend/dist) from this same process.
# No-op in the dev pod (Vite owns :3000 there and this dir never exists); only
# present after `yarn build` runs, e.g. inside the Docker image built for Coolify.
FRONTEND_DIST = ROOT_DIR.parent / "frontend" / "dist"
if FRONTEND_DIST.is_dir():
    assets_dir = FRONTEND_DIST / "portal-assets"
    if assets_dir.is_dir():
        app.mount("/portal-assets", StaticFiles(directory=assets_dir), name="portal-assets")

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        """SPA catch-all: registered after api_router. A *known* /api/... route already
        matched above and never reaches here; an *unknown* /api/... path must still 404
        instead of silently returning the frontend HTML. Everything else serves the
        matching static file (logo, favicon, ...) if it exists, otherwise index.html so
        react-router handles the client-side route."""
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        candidate = FRONTEND_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST / "index.html")
