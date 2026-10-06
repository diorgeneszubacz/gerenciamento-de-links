"""Server health from /proc (Linux/Debian) — no extra dependencies."""

import asyncio
import os
import shutil
import socket

from fastapi import APIRouter

from models.schemas import SystemHealth, _now

router = APIRouter(tags=["system"])


def _cpu_times() -> tuple[int, int]:
    with open("/proc/stat") as f:
        parts = [int(x) for x in f.readline().split()[1:]]
    idle = parts[3] + (parts[4] if len(parts) > 4 else 0)  # idle + iowait
    return sum(parts), idle


def _meminfo() -> tuple[int, int]:
    info: dict[str, int] = {}
    with open("/proc/meminfo") as f:
        for line in f:
            key, val = line.split(":", 1)
            info[key] = int(val.split()[0]) * 1024
    total = info.get("MemTotal", 0)
    available = info.get("MemAvailable", info.get("MemFree", 0))
    return total, total - available


def _os_name() -> str:
    try:
        with open("/etc/os-release") as f:
            for line in f:
                if line.startswith("PRETTY_NAME="):
                    return line.split("=", 1)[1].strip().strip('"')
    except OSError:
        pass
    return "Linux"


@router.get("/system", response_model=SystemHealth)
async def system_health():
    t1, i1 = _cpu_times()
    await asyncio.sleep(0.3)
    t2, i2 = _cpu_times()
    dt = t2 - t1
    cpu = round(100.0 * (1 - (i2 - i1) / dt), 1) if dt > 0 else 0.0

    mem_total, mem_used = _meminfo()
    disk = shutil.disk_usage(os.environ.get("DISK_PATH", "/"))
    with open("/proc/uptime") as f:
        uptime = float(f.read().split()[0])
    load = list(os.getloadavg())

    return SystemHealth(
        hostname=socket.gethostname(),
        os_name=_os_name(),
        cpu_percent=max(0.0, min(cpu, 100.0)),
        cpu_count=os.cpu_count() or 1,
        load_avg=[round(x, 2) for x in load],
        mem_total=mem_total,
        mem_used=mem_used,
        mem_percent=round(100.0 * mem_used / mem_total, 1) if mem_total else 0.0,
        disk_total=disk.total,
        disk_used=disk.used,
        disk_percent=round(100.0 * disk.used / disk.total, 1) if disk.total else 0.0,
        uptime_seconds=int(uptime),
        checked_at=_now(),
    )
