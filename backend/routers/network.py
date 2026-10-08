"""Authenticated network inventory, topology and live NOC checks."""

import asyncio
import re
import sys
import time
from datetime import datetime
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import Table, delete, func, insert, select, update

from lib.auth import current_user
from lib.db import engine, network_links, network_nodes, network_ports, network_zones
from models.schemas import (
    NetworkLink,
    NetworkLinkIn,
    NetworkNode,
    NetworkNodeIn,
    NetworkNodeStatus,
    NetworkZone,
    NetworkZoneIn,
    NetworkPositionIn,
    NetworkPort,
    NetworkPortIn,
    NetworkStatus,
    NetworkTopology,
    OkResponse,
    _now,
)

router = APIRouter(
    prefix="/admin/network",
    tags=["network"],
    dependencies=[Depends(current_user)],
)


def _row(row) -> dict:
    return dict(row._mapping)


def _to_node(row) -> NetworkNode:
    return NetworkNode(**_row(row))


def _to_port(row) -> NetworkPort:
    data = _row(row)
    data["order"] = data.pop("position")
    return NetworkPort(**data)


def _to_link(row) -> NetworkLink:
    return NetworkLink(**_row(row))


def _db_now() -> datetime:
    return _now().replace(tzinfo=None)


async def _get(table: Table, item_id: str):
    async with engine.connect() as conn:
        return (await conn.execute(select(table).where(table.c.id == item_id))).first()


async def _ensure_node(node_id: str) -> None:
    if not await _get(network_nodes, node_id):
        raise HTTPException(status_code=400, detail="Equipamento não encontrado")


async def _ensure_port(port_id: str | None, node_id: str, label: str) -> None:
    if not port_id:
        return
    port = await _get(network_ports, port_id)
    if not port:
        raise HTTPException(status_code=400, detail=f"Porta de {label} não encontrada")
    if port.node_id != node_id:
        raise HTTPException(status_code=400, detail=f"A porta de {label} não pertence ao equipamento selecionado")


# ---------- Topology ----------
@router.get("/topology", response_model=NetworkTopology)
async def topology():
    async with engine.connect() as conn:
        zones = (await conn.execute(select(network_zones).order_by(network_zones.c.position, network_zones.c.name))).all()
        nodes = (await conn.execute(select(network_nodes).order_by(network_nodes.c.name))).all()
        ports = (await conn.execute(
            select(network_ports).order_by(network_ports.c.node_id, network_ports.c.position, network_ports.c.name)
        )).all()
        links = (await conn.execute(select(network_links).order_by(network_links.c.created_at))).all()
    return NetworkTopology(
        zones=[NetworkZone(**{**_row(row), "order": _row(row).pop("position")}) for row in zones],
        nodes=[_to_node(row) for row in nodes],
        ports=[_to_port(row) for row in ports],
        links=[_to_link(row) for row in links],
    )


# ---------- Zones ----------
@router.get("/zones", response_model=list[NetworkZone])
async def list_zones():
    async with engine.connect() as conn:
        rows = (await conn.execute(select(network_zones).order_by(network_zones.c.position, network_zones.c.name))).all()
    return [NetworkZone(**{**_row(row), "order": _row(row).pop("position")}) for row in rows]


async def _ensure_zone(zone_id: str | None) -> None:
    if zone_id and not await _get(network_zones, zone_id):
        raise HTTPException(status_code=400, detail="Rede lógica não encontrada")


@router.post("/zones", response_model=NetworkZone)
async def create_zone(body: NetworkZoneIn):
    zone = NetworkZone(**body.model_dump())
    async with engine.begin() as conn:
        position = (await conn.execute(select(func.max(network_zones.c.position)))).scalar()
        values = zone.model_dump()
        values["position"] = (position + 1) if position is not None else 0
        values["created_at"] = values["created_at"].replace(tzinfo=None)
        await conn.execute(insert(network_zones).values(**values))
    return NetworkZone(**{**values, "order": values["position"]})


@router.put("/zones/{zone_id}", response_model=NetworkZone)
async def update_zone(zone_id: str, body: NetworkZoneIn):
    if not await _get(network_zones, zone_id):
        raise HTTPException(status_code=404, detail="Rede lógica não encontrada")
    async with engine.begin() as conn:
        await conn.execute(update(network_zones).where(network_zones.c.id == zone_id).values(**body.model_dump()))
    row = await _get(network_zones, zone_id)
    data = _row(row)
    data["order"] = data.pop("position")
    return NetworkZone(**data)


@router.delete("/zones/{zone_id}", response_model=OkResponse)
async def delete_zone(zone_id: str):
    if not await _get(network_zones, zone_id):
        raise HTTPException(status_code=404, detail="Rede lógica não encontrada")
    async with engine.begin() as conn:
        await conn.execute(update(network_nodes).where(network_nodes.c.zone_id == zone_id).values(zone_id=None))
        await conn.execute(delete(network_zones).where(network_zones.c.id == zone_id))
    return OkResponse()


# ---------- Nodes ----------
@router.post("/nodes", response_model=NetworkNode)
async def create_node(body: NetworkNodeIn):
    await _ensure_zone(body.zone_id)
    node = NetworkNode(**body.model_dump())
    values = node.model_dump()
    values["created_at"] = values["created_at"].replace(tzinfo=None)
    values["updated_at"] = values["updated_at"].replace(tzinfo=None)
    async with engine.begin() as conn:
        await conn.execute(insert(network_nodes).values(**values))
    return node


@router.put("/nodes/{node_id}", response_model=NetworkNode)
async def update_node(node_id: str, body: NetworkNodeIn):
    if not await _get(network_nodes, node_id):
        raise HTTPException(status_code=404, detail="Equipamento não encontrado")
    await _ensure_zone(body.zone_id)
    values = body.model_dump()
    values["updated_at"] = _db_now()
    async with engine.begin() as conn:
        await conn.execute(update(network_nodes).where(network_nodes.c.id == node_id).values(**values))
    return _to_node(await _get(network_nodes, node_id))


@router.patch("/nodes/{node_id}/position", response_model=NetworkNode)
async def move_node(node_id: str, body: NetworkPositionIn):
    if not await _get(network_nodes, node_id):
        raise HTTPException(status_code=404, detail="Equipamento não encontrado")
    async with engine.begin() as conn:
        await conn.execute(
            update(network_nodes).where(network_nodes.c.id == node_id).values(
                position_x=body.position_x, position_y=body.position_y, updated_at=_db_now()
            )
        )
    return _to_node(await _get(network_nodes, node_id))


@router.delete("/nodes/{node_id}", response_model=OkResponse)
async def delete_node(node_id: str):
    if not await _get(network_nodes, node_id):
        raise HTTPException(status_code=404, detail="Equipamento não encontrado")
    async with engine.begin() as conn:
        await conn.execute(delete(network_links).where(
            (network_links.c.source_node_id == node_id) | (network_links.c.target_node_id == node_id)
        ))
        await conn.execute(delete(network_ports).where(network_ports.c.node_id == node_id))
        await conn.execute(delete(network_nodes).where(network_nodes.c.id == node_id))
    return OkResponse()


# ---------- Ports ----------
@router.get("/nodes/{node_id}/ports", response_model=list[NetworkPort])
async def list_ports(node_id: str):
    await _ensure_node(node_id)
    async with engine.connect() as conn:
        rows = (await conn.execute(
            select(network_ports).where(network_ports.c.node_id == node_id).order_by(
                network_ports.c.position, network_ports.c.name
            )
        )).all()
    return [_to_port(row) for row in rows]


async def _next_port_position(node_id: str) -> int:
    async with engine.connect() as conn:
        last = (await conn.execute(
            select(func.max(network_ports.c.position)).where(network_ports.c.node_id == node_id)
        )).scalar()
    return (last + 1) if last is not None else 0


@router.post("/nodes/{node_id}/ports", response_model=NetworkPort)
async def create_port(node_id: str, body: NetworkPortIn):
    await _ensure_node(node_id)
    port = NetworkPort(node_id=node_id, order=await _next_port_position(node_id), **body.model_dump())
    values = port.model_dump()
    values["position"] = values.pop("order")
    values["created_at"] = values["created_at"].replace(tzinfo=None)
    async with engine.begin() as conn:
        await conn.execute(insert(network_ports).values(**values))
    return port


@router.put("/ports/{port_id}", response_model=NetworkPort)
async def update_port(port_id: str, body: NetworkPortIn):
    if not await _get(network_ports, port_id):
        raise HTTPException(status_code=404, detail="Porta não encontrada")
    async with engine.begin() as conn:
        await conn.execute(update(network_ports).where(network_ports.c.id == port_id).values(**body.model_dump()))
    return _to_port(await _get(network_ports, port_id))


@router.delete("/ports/{port_id}", response_model=OkResponse)
async def delete_port(port_id: str):
    if not await _get(network_ports, port_id):
        raise HTTPException(status_code=404, detail="Porta não encontrada")
    async with engine.begin() as conn:
        await conn.execute(update(network_links).where(network_links.c.source_port_id == port_id).values(source_port_id=None))
        await conn.execute(update(network_links).where(network_links.c.target_port_id == port_id).values(target_port_id=None))
        await conn.execute(delete(network_ports).where(network_ports.c.id == port_id))
    return OkResponse()


# ---------- Links ----------
@router.get("/links", response_model=list[NetworkLink])
async def list_links():
    async with engine.connect() as conn:
        rows = (await conn.execute(select(network_links).order_by(network_links.c.created_at))).all()
    return [_to_link(row) for row in rows]


async def _validate_link(body: NetworkLinkIn) -> None:
    await _ensure_node(body.source_node_id)
    await _ensure_node(body.target_node_id)
    await _ensure_port(body.source_port_id, body.source_node_id, "origem")
    await _ensure_port(body.target_port_id, body.target_node_id, "destino")


@router.post("/links", response_model=NetworkLink)
async def create_link(body: NetworkLinkIn):
    await _validate_link(body)
    link = NetworkLink(**body.model_dump())
    values = link.model_dump()
    values["created_at"] = values["created_at"].replace(tzinfo=None)
    async with engine.begin() as conn:
        await conn.execute(insert(network_links).values(**values))
    return link


@router.put("/links/{link_id}", response_model=NetworkLink)
async def update_link(link_id: str, body: NetworkLinkIn):
    if not await _get(network_links, link_id):
        raise HTTPException(status_code=404, detail="Enlace não encontrado")
    await _validate_link(body)
    async with engine.begin() as conn:
        await conn.execute(update(network_links).where(network_links.c.id == link_id).values(**body.model_dump()))
    return _to_link(await _get(network_links, link_id))


@router.delete("/links/{link_id}", response_model=OkResponse)
async def delete_link(link_id: str):
    async with engine.begin() as conn:
        res = await conn.execute(delete(network_links).where(network_links.c.id == link_id))
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Enlace não encontrado")
    return OkResponse()


# ---------- Live monitoring ----------
def _parse_latency(output: str) -> float | None:
    match = re.search(r"(?:time|tempo)[=<]\s*([0-9]+(?:[.,][0-9]+)?)\s*ms", output, re.IGNORECASE)
    if not match:
        return None
    try:
        return round(float(match.group(1).replace(",", ".")), 2)
    except ValueError:
        return None


async def _icmp_check(host: str) -> tuple[bool, float | None, str | None]:
    if sys.platform.startswith("win"):
        args = ["ping", "-n", "1", "-w", "2000", host]
    else:
        args = ["ping", "-c", "1", "-W", "2", host]
    started = time.perf_counter()
    try:
        proc = await asyncio.create_subprocess_exec(
            *args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=3.0)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.communicate()
            return False, None, "Tempo limite excedido"
    except FileNotFoundError:
        return False, None, "Comando ping não está instalado no servidor"
    except Exception as exc:
        return False, None, str(exc)[:180]
    output = (stdout + stderr).decode(errors="replace")
    latency = _parse_latency(output) or round((time.perf_counter() - started) * 1000, 2)
    return proc.returncode == 0, latency if proc.returncode == 0 else None, None if proc.returncode == 0 else "Host não respondeu ao ICMP"


async def _tcp_check(host: str, port: int) -> tuple[bool, float | None, str | None]:
    started = time.perf_counter()
    try:
        _, writer = await asyncio.wait_for(asyncio.open_connection(host, port), timeout=2.5)
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass
        return True, round((time.perf_counter() - started) * 1000, 2), None
    except Exception as exc:
        return False, None, str(exc)[:180]


def _http_request(url: str) -> tuple[bool, float | None, str | None]:
    started = time.perf_counter()
    request = Request(url, headers={"User-Agent": "Portal27-NOC/1.0"}, method="GET")
    try:
        with urlopen(request, timeout=2.5) as response:
            response.read(64)
        return True, round((time.perf_counter() - started) * 1000, 2), None
    except HTTPError as exc:
        # A HTTP response (including 401/404/500) proves the service is reachable.
        return True, round((time.perf_counter() - started) * 1000, 2), f"HTTP {exc.code}"
    except (URLError, TimeoutError, OSError) as exc:
        return False, None, str(exc.reason if isinstance(exc, URLError) else exc)[:180]


async def _probe(node: dict) -> NetworkNodeStatus:
    protocol = node["monitor_protocol"]
    checked_at = _now()
    if not node["enabled"] or protocol == "none":
        return NetworkNodeStatus(node_id=node["id"], status="disabled", protocol=protocol, checked_at=checked_at)
    host = node.get("host")
    if not host:
        return NetworkNodeStatus(node_id=node["id"], status="unknown", protocol=protocol, error="Host não configurado", checked_at=checked_at)
    if protocol == "icmp":
        ok, latency, error = await _icmp_check(host)
    elif protocol == "tcp":
        ok, latency, error = await _tcp_check(host, int(node["monitor_port"]))
    else:
        port = int(node["monitor_port"])
        scheme = "https" if port == 443 else "http"
        url = f"{scheme}://{host}:{port}{node.get('monitor_path') or '/'}"
        ok, latency, error = await asyncio.to_thread(_http_request, url)
    return NetworkNodeStatus(
        node_id=node["id"],
        status="online" if ok else "offline",
        latency_ms=latency,
        error=error,
        protocol=protocol,
        checked_at=checked_at,
    )


@router.get("/status", response_model=NetworkStatus)
async def status():
    async with engine.connect() as conn:
        rows = (await conn.execute(select(network_nodes).order_by(network_nodes.c.name))).all()
    results = await asyncio.gather(*(_probe(_row(row)) for row in rows))
    return NetworkStatus(nodes=results, checked_at=_now())
