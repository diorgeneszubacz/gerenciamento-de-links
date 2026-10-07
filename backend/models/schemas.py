"""Pydantic models — mirrored by hand in frontend/src/lib/types.ts."""

import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

MAX_LOGO_CHARS = 500_000


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------- Categories ----------
class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    icon: str = "folder"


class Category(CategoryIn):
    id: str = Field(default_factory=_uuid)
    order: int = 0


# ---------- Services ----------
class ServiceIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=240)
    category_id: str
    url_mode: Literal["port", "url"] = "port"
    protocol: Literal["http", "https"] = "http"
    port: Optional[int] = Field(default=None, ge=1, le=65535)
    path: str = "/"
    url: Optional[str] = None
    logo: Optional[str] = None
    visible: bool = True

    @model_validator(mode="after")
    def _check(self):
        if self.url_mode == "port" and self.port is None:
            raise ValueError("Informe a porta do serviço")
        if self.url_mode == "url":
            if not self.url or not self.url.startswith(("http://", "https://")):
                raise ValueError("Informe uma URL completa iniciando com http:// ou https://")
        if not self.path.startswith("/"):
            self.path = "/" + self.path
        if self.logo:
            if not self.logo.startswith(("data:image/", "http://", "https://")):
                raise ValueError("Logo inválida")
            if len(self.logo) > MAX_LOGO_CHARS:
                raise ValueError("Imagem da logo muito grande")
        return self


class Service(ServiceIn):
    id: str = Field(default_factory=_uuid)
    order: int = 0


class ReorderIn(BaseModel):
    ids: list[str]


class PortalData(BaseModel):
    categories: list[Category]
    services: list[Service]


class StatusMap(BaseModel):
    statuses: dict[str, bool]
    checked_at: datetime


class DiskPartition(BaseModel):
    mount: str
    device: str
    total: int
    used: int
    percent: float


class SystemHealth(BaseModel):
    hostname: str
    os_name: str
    cpu_percent: float
    cpu_count: int
    load_avg: list[float]
    mem_total: int
    mem_used: int
    mem_percent: float
    disk_total: int
    disk_used: int
    disk_percent: float
    disk_partitions: list[DiskPartition]
    nvme_total: int
    nvme_used: int
    nvme_percent: float
    nvme_partitions: list[DiskPartition]
    uptime_seconds: int
    checked_at: datetime


# ---------- Logos ----------
class LogoSuggestIn(BaseModel):
    name: str = ""
    url_mode: Literal["port", "url"] = "port"
    protocol: Literal["http", "https"] = "http"
    port: Optional[int] = None
    url: Optional[str] = None


class LogoSuggestion(BaseModel):
    source: str
    label: str
    data_url: str


# ---------- Users / auth ----------
class LoginIn(BaseModel):
    username: str
    password: str


class User(BaseModel):
    id: str = Field(default_factory=_uuid)
    username: str
    role: Literal["admin", "operator"] = "operator"
    created_at: datetime = Field(default_factory=_now)

    @field_validator("created_at")
    @classmethod
    def _aware(cls, v: datetime) -> datetime:
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=40, pattern=r"^[a-zA-Z0-9_.-]+$")
    password: str = Field(min_length=6, max_length=128)


class PasswordSet(BaseModel):
    password: str = Field(min_length=6, max_length=128)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=128)


class OkResponse(BaseModel):
    ok: bool = True
