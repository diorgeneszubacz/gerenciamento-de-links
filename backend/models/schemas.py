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


# ---------- Network map / NOC ----------
NetworkNodeType = Literal["cloud", "router", "switch", "firewall", "server", "computer", "access_point", "patch_panel", "printer", "camera", "phone", "database", "nas", "ups", "other"]
MonitorProtocol = Literal["icmp", "tcp", "http", "none"]
NetworkLinkType = Literal["ethernet", "fiber", "wireless", "logical", "other"]


class NetworkZoneIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    cidr: str = Field(default="", max_length=64)
    description: str = Field(default="", max_length=240)
    color: str = Field(default="#38bdf8", max_length=20)

    @field_validator("name", "cidr", "description")
    @classmethod
    def _clean_text(cls, value: str) -> str:
        return value.strip()


class NetworkZone(NetworkZoneIn):
    id: str = Field(default_factory=_uuid)
    order: int = 0
    created_at: datetime = Field(default_factory=_now)


class NetworkNodeIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    zone_id: Optional[str] = None
    node_type: NetworkNodeType = "other"
    description: str = Field(default="", max_length=240)
    host: Optional[str] = Field(default=None, max_length=255)
    monitor_protocol: MonitorProtocol = "icmp"
    monitor_port: Optional[int] = Field(default=None, ge=1, le=65535)
    monitor_path: str = Field(default="/", max_length=255)
    position_x: float = Field(default=50, ge=0, le=100)
    position_y: float = Field(default=50, ge=0, le=100)
    enabled: bool = True
    notes: str = Field(default="", max_length=4000)

    @model_validator(mode="after")
    def _check_monitor(self):
        self.name = self.name.strip()
        self.description = self.description.strip()
        self.host = self.host.strip() if self.host else None
        self.monitor_path = self.monitor_path.strip() or "/"
        if not self.monitor_path.startswith("/"):
            self.monitor_path = "/" + self.monitor_path
        if self.monitor_protocol in ("icmp", "tcp", "http") and not self.host:
            raise ValueError("Informe o host ou IP do equipamento para monitoramento")
        if self.monitor_protocol in ("tcp", "http") and self.monitor_port is None:
            raise ValueError("Informe a porta para monitoramento TCP/HTTP")
        return self


class NetworkNode(NetworkNodeIn):
    id: str = Field(default_factory=_uuid)
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


class NetworkPortIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    comment: str = Field(default="", max_length=240)
    vlan: str = Field(default="", max_length=40)

    @field_validator("name")
    @classmethod
    def _port_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Informe a identificação da porta")
        return value


class NetworkPort(NetworkPortIn):
    id: str = Field(default_factory=_uuid)
    node_id: str
    order: int = 0
    created_at: datetime = Field(default_factory=_now)


class NetworkLinkIn(BaseModel):
    source_node_id: str
    target_node_id: str
    source_port_id: Optional[str] = None
    target_port_id: Optional[str] = None
    label: str = Field(default="", max_length=120)
    link_type: NetworkLinkType = "ethernet"
    comment: str = Field(default="", max_length=500)
    enabled: bool = True

    @model_validator(mode="after")
    def _check_link(self):
        if self.source_node_id == self.target_node_id:
            raise ValueError("A origem e o destino do enlace devem ser equipamentos diferentes")
        self.label = self.label.strip()
        return self


class NetworkLink(NetworkLinkIn):
    id: str = Field(default_factory=_uuid)
    created_at: datetime = Field(default_factory=_now)


class NetworkPositionIn(BaseModel):
    position_x: float = Field(ge=0, le=100)
    position_y: float = Field(ge=0, le=100)


class NetworkNodeStatus(BaseModel):
    node_id: str
    status: Literal["online", "offline", "unknown", "disabled"]
    latency_ms: Optional[float] = None
    error: Optional[str] = None
    checked_at: Optional[datetime] = None
    protocol: MonitorProtocol


class NetworkStatus(BaseModel):
    nodes: list[NetworkNodeStatus]
    checked_at: datetime


class NetworkTopology(BaseModel):
    zones: list[NetworkZone] = []
    nodes: list[NetworkNode]
    ports: list[NetworkPort]
    links: list[NetworkLink]


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
