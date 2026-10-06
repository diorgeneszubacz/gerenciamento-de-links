"""Authenticated management of categories, services and logos."""

import os
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import Table, delete, func, insert, select, update

from lib.auth import current_user
from lib.db import categories, engine, services
from lib.logos import ICON_CDNS, fetch_many, slug_variants
from lib.mapping import service_values, to_category, to_service
from models.schemas import (
    Category, CategoryIn, LogoSuggestIn, LogoSuggestion, OkResponse, ReorderIn, Service, ServiceIn,
)

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(current_user)])


async def _reorder(table: Table, ids: list[str]) -> None:
    async with engine.begin() as conn:
        for idx, _id in enumerate(ids):
            await conn.execute(update(table).where(table.c.id == _id).values(position=idx))


async def _next_position(table: Table) -> int:
    async with engine.connect() as conn:
        last = (await conn.execute(select(func.max(table.c.position)))).scalar()
    return (last + 1) if last is not None else 0


async def _get(table: Table, id: str):
    async with engine.connect() as conn:
        return (await conn.execute(select(table).where(table.c.id == id))).first()


# ---------- Categories ----------
@router.get("/categories", response_model=list[Category])
async def list_categories():
    async with engine.connect() as conn:
        rows = (await conn.execute(select(categories).order_by(categories.c.position))).all()
    return [to_category(r) for r in rows]


@router.post("/categories", response_model=Category)
async def create_category(body: CategoryIn):
    cat = Category(**body.model_dump(), order=await _next_position(categories))
    async with engine.begin() as conn:
        await conn.execute(insert(categories).values(id=cat.id, name=cat.name, icon=cat.icon, position=cat.order))
    return cat


@router.put("/categories/{id}", response_model=Category)
async def update_category(id: str, body: CategoryIn):
    async with engine.begin() as conn:
        res = await conn.execute(update(categories).where(categories.c.id == id).values(**body.model_dump()))
    if res.rowcount == 0 and not await _get(categories, id):
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    return to_category(await _get(categories, id))


@router.delete("/categories/{id}", response_model=OkResponse)
async def delete_category(id: str):
    async with engine.begin() as conn:
        used = (await conn.execute(
            select(func.count()).select_from(services).where(services.c.category_id == id)
        )).scalar_one()
        if used > 0:
            raise HTTPException(status_code=400, detail="Remova ou mova os serviços desta categoria antes de excluí-la")
        res = await conn.execute(delete(categories).where(categories.c.id == id))
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    return OkResponse()


@router.post("/categories/reorder", response_model=OkResponse)
async def reorder_categories(body: ReorderIn):
    await _reorder(categories, body.ids)
    return OkResponse()


# ---------- Services ----------
@router.get("/services", response_model=list[Service])
async def list_services():
    async with engine.connect() as conn:
        rows = (await conn.execute(select(services).order_by(services.c.position))).all()
    return [to_service(r) for r in rows]


async def _ensure_category(cid: str) -> None:
    if not await _get(categories, cid):
        raise HTTPException(status_code=400, detail="Categoria inválida")


@router.post("/services", response_model=Service)
async def create_service(body: ServiceIn):
    await _ensure_category(body.category_id)
    svc = Service(**body.model_dump(), order=await _next_position(services))
    async with engine.begin() as conn:
        await conn.execute(insert(services).values(**service_values(svc)))
    return svc


@router.put("/services/{id}", response_model=Service)
async def update_service(id: str, body: ServiceIn):
    await _ensure_category(body.category_id)
    if not await _get(services, id):
        raise HTTPException(status_code=404, detail="Serviço não encontrado")
    async with engine.begin() as conn:
        await conn.execute(update(services).where(services.c.id == id).values(**body.model_dump()))
    return to_service(await _get(services, id))


@router.delete("/services/{id}", response_model=OkResponse)
async def delete_service(id: str):
    async with engine.begin() as conn:
        res = await conn.execute(delete(services).where(services.c.id == id))
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Serviço não encontrado")
    return OkResponse()


@router.post("/services/reorder", response_model=OkResponse)
async def reorder_services(body: ReorderIn):
    await _reorder(services, body.ids)
    return OkResponse()


# ---------- Logos ----------
@router.post("/logos/suggest", response_model=list[LogoSuggestion])
async def suggest_logos(body: LogoSuggestIn):
    candidates: list[tuple[str, str, str]] = []
    # 1) favicon served by the service itself
    base = None
    if body.url_mode == "url" and body.url:
        p = urlparse(body.url)
        if p.scheme and p.netloc:
            base = f"{p.scheme}://{p.netloc}"
    elif body.port:
        base = f"{body.protocol}://{os.environ.get('STATUS_HOST', '127.0.0.1')}:{body.port}"
    if base:
        candidates.append(("favicon", "Favicon do serviço", f"{base}/favicon.ico"))
        candidates.append(("favicon", "Ícone Apple do serviço", f"{base}/apple-touch-icon.png"))
    # 2) public icon libraries, by name
    for slug in slug_variants(body.name):
        for label, tpl in ICON_CDNS:
            candidates.append(("library", f"{label} · {slug}", tpl.format(slug=slug)))
    found = await fetch_many(candidates)
    seen: set[str] = set()
    out: list[LogoSuggestion] = []
    for source, label, data in found:
        if data in seen:
            continue
        seen.add(data)
        out.append(LogoSuggestion(source=source, label=label, data_url=data))
    return out
