"""Public endpoints: portal listing + live status."""

import asyncio
import os
from urllib.parse import urlparse

from fastapi import APIRouter

from lib.db import db
from models.schemas import Category, PortalData, Service, StatusMap
from models.schemas import _now

router = APIRouter(tags=["portal"])


@router.get("/portal", response_model=PortalData)
async def portal():
    cats = await db.categories.find({}, {"_id": 0}).sort("order", 1).to_list(500)
    svcs = await db.services.find({"visible": True}, {"_id": 0}).sort("order", 1).to_list(2000)
    return PortalData(categories=[Category(**c) for c in cats], services=[Service(**s) for s in svcs])


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
    svcs = await db.services.find({"visible": True}, {"_id": 0, "id": 1, "url_mode": 1, "url": 1, "port": 1}).to_list(2000)
    targets = {s["id"]: target_of(s) for s in svcs}
    unique = {t for t in targets.values() if t}
    results = dict(zip(unique, await asyncio.gather(*(tcp_check(h, p) for h, p in unique))))
    return StatusMap(
        statuses={sid: bool(t and results.get(t)) for sid, t in targets.items()},
        checked_at=_now(),
    )
