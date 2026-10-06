"""Public endpoints: portal listing + live status."""

import asyncio
import os
from urllib.parse import urlparse

from fastapi import APIRouter
from sqlalchemy import select

from lib.db import categories, engine, services
from lib.mapping import to_category, to_service
from models.schemas import PortalData, StatusMap
from models.schemas import _now

router = APIRouter(tags=["portal"])


@router.get("/portal", response_model=PortalData)
async def portal():
    async with engine.connect() as conn:
        cats = (await conn.execute(select(categories).order_by(categories.c.position))).all()
        svcs = (await conn.execute(
            select(services).where(services.c.visible.is_(True)).order_by(services.c.position)
        )).all()
    return PortalData(categories=[to_category(c) for c in cats], services=[to_service(s) for s in svcs])


def target_of(svc: dict) -> tuple[str, int] | None:
    """Host/port to probe. Port-mode services live on this machine (STATUS_HOST)."""
    if svc.get("url_mode") == "url":
        p = urlparse(svc.get("url") or "")
        if not p.hostname:
            return None
        return p.hostname, p.port or (443 if p.scheme == "https" else 80)
    if not svc.get("port"):
        return None
    return os.environ.get("STATUS_HOST", "127.0.0.1"), int(svc["port"])


async def tcp_check(host: str, port: int, timeout: float = 2.0) -> bool:
    try:
        _, writer = await asyncio.wait_for(asyncio.open_connection(host, port), timeout=timeout)
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass
        return True
    except Exception:
        return False


@router.get("/status", response_model=StatusMap)
async def status():
    async with engine.connect() as conn:
        rows = (await conn.execute(
            select(services.c.id, services.c.url_mode, services.c.url, services.c.port)
            .where(services.c.visible.is_(True))
        )).all()
    svcs = [dict(r._mapping) for r in rows]
    targets = {s["id"]: target_of(s) for s in svcs}
    unique = {t for t in targets.values() if t}
    results = dict(zip(unique, await asyncio.gather(*(tcp_check(h, p) for h, p in unique))))
    return StatusMap(
        statuses={sid: bool(t and results.get(t)) for sid, t in targets.items()},
        checked_at=_now(),
    )
