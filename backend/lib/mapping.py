"""Row <-> Pydantic model mapping (DB column `position` is exposed as `order`)."""

from typing import Any

from models.schemas import Category, Service


def row_dict(row: Any) -> dict:
    return dict(row._mapping)


def to_category(row: Any) -> Category:
    d = row_dict(row)
    d["order"] = d.pop("position")
    return Category(**d)


def to_service(row: Any) -> Service:
    d = row_dict(row)
    d["order"] = d.pop("position")
    return Service(**d)


def service_values(svc: Service) -> dict:
    d = svc.model_dump()
    d["position"] = d.pop("order")
    return d
