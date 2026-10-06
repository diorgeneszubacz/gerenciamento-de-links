import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter
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
