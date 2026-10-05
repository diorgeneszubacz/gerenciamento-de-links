"""Authenticated management of categories, services and logos."""

import os
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import current_user
from lib.db import db
from lib.logos import ICON_CDNS, fetch_many, slug_variants
from models.schemas import (
    Category, CategoryIn, LogoSuggestIn, LogoSuggestion, OkResponse, ReorderIn, Service, ServiceIn,
)

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(current_user)])


async def _reorder(collection, ids: list[str]) -> None:
    for idx, _id in enumerate(ids):
        await collection.update_one({"id": _id}, {"$set": {"order": idx}})


async def _next_order(collection, query: dict | None = None) -> int:
    last = await collection.find(query or {}, {"_id": 0, "order": 1}).sort("order", -1).limit(1).to_list(1)
    return (last[0]["order"] + 1) if last else 0


# ---------- Categories ----------
@router.get("/categories", response_model=list[Category])
async def list_categories():
    docs = await db.categories.find({}, {"_id": 0}).sort("order", 1).to_list(500)
    return [Category(**d) for d in docs]


@router.post("/categories", response_model=Category)
async def create_category(body: CategoryIn):
    cat = Category(**body.model_dump(), order=await _next_order(db.categories))
    await db.categories.insert_one(cat.model_dump())
    return cat


@router.put("/categories/{id}", response_model=Category)
async def update_category(id: str, body: CategoryIn):
    doc = await db.categories.find_one_and_update(
        {"id": id}, {"$set": body.model_dump()}, projection={"_id": 0}, return_document=True
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    return Category(**doc)


@router.delete("/categories/{id}", response_model=OkResponse)
async def delete_category(id: str):
    if await db.services.count_documents({"category_id": id}) > 0:
        raise HTTPException(status_code=400, detail="Remova ou mova os serviços desta categoria antes de excluí-la")
    res = await db.categories.delete_one({"id": id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    return OkResponse()


@router.post("/categories/reorder", response_model=OkResponse)
async def reorder_categories(body: ReorderIn):
    await _reorder(db.categories, body.ids)
    return OkResponse()


# ---------- Services ----------
@router.get("/services", response_model=list[Service])
async def list_services():
    docs = await db.services.find({}, {"_id": 0}).sort("order", 1).to_list(2000)
    return [Service(**d) for d in docs]


async def _ensure_category(cid: str) -> None:
    if not await db.categories.find_one({"id": cid}):
        raise HTTPException(status_code=400, detail="Categoria inválida")


@router.post("/services", response_model=Service)
async def create_service(body: ServiceIn):
    await _ensure_category(body.category_id)
    svc = Service(**body.model_dump(), order=await _next_order(db.services))
    await db.services.insert_one(svc.model_dump())
    return svc


@router.put("/services/{id}", response_model=Service)
async def update_service(id: str, body: ServiceIn):
    await _ensure_category(body.category_id)
    doc = await db.services.find_one_and_update(
        {"id": id}, {"$set": body.model_dump()}, projection={"_id": 0}, return_document=True
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Serviço não encontrado")
    return Service(**doc)


@router.delete("/services/{id}", response_model=OkResponse)
async def delete_service(id: str):
    res = await db.services.delete_one({"id": id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Serviço não encontrado")
    return OkResponse()


@router.post("/services/reorder", response_model=OkResponse)
async def reorder_services(body: ReorderIn):
    await _reorder(db.services, body.ids)
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
