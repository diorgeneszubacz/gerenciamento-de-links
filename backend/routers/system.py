"""Server health from /proc + /sys (Linux/Debian) — no extra dependencies.

Disk reporting is grouped by *physical device*, not by a single path, so a
system disk split into several partitions (/, /home, /var, ...) is reported
as one "NVME"/system card with its real total capacity (from
/sys/block/<dev>/size), and a separate big storage volume (RAID array, extra
drive, ...) is reported as its own card — each with a drill-down list of the
individual partitions/mounts that make up that device.
"""

import asyncio
import os
import re
import shutil
import socket
from pathlib import Path

from fastapi import APIRouter

from models.schemas import DiskPartition, SystemHealth, _now

router = APIRouter(tags=["system"])

# Filesystem types that are not real storage (virtual/kernel-exposed) — never
# shown as a "partition" of a physical disk.
_PSEUDO_FS = {
    "proc", "sysfs", "tmpfs", "devtmpfs", "devpts", "cgroup", "cgroup2",
    "overlay", "squashfs", "efivarfs", "debugfs", "tracefs", "pstore", "bpf",
    "mqueue", "hugetlbfs", "autofs", "binfmt_misc", "securityfs", "configfs",
    "fusectl", "nsfs", "rpc_pipefs", "sunrpc", "selinuxfs", "ramfs",
}


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


def _real_mounts(prefix: str) -> list[tuple[str, str, str]]:
    """(device, mountpoint, fstype) for real block-device mounts, de-duplicated
    by mountpoint (last mount of a path wins, matching how `df` resolves it).
    When `prefix` is set (containerised deploys bind-mounting the host root at
    e.g. /host), only mounts under that prefix are considered — everything
    else is this container's own filesystem, not the host's."""
    seen: dict[str, tuple[str, str, str]] = {}
    with open("/proc/mounts") as f:
        for line in f:
            parts = line.split()
            if len(parts) < 3:
                continue
            device, mountpoint, fstype = parts[0], parts[1], parts[2]
            if not device.startswith("/dev/") or fstype in _PSEUDO_FS:
                continue
            mountpoint = mountpoint.encode().decode("unicode_escape")  # \040 -> space
            if prefix and not (mountpoint == prefix or mountpoint.startswith(prefix.rstrip("/") + "/")):
                continue
            seen[mountpoint] = (device, mountpoint, fstype)
    return list(seen.values())


def _base_device(dev_path: str) -> str:
    """/dev/nvme0n1p2 -> nvme0n1, /dev/md0 -> md0, /dev/sda1 -> sda."""
    name = dev_path.removeprefix("/dev/")
    m = re.match(r"^(nvme\d+n\d+)(p\d+)?$", name)
    if m:
        return m.group(1)
    m = re.match(r"^(mmcblk\d+)(p\d+)?$", name)
    if m:
        return m.group(1)
    if re.match(r"^md\d+$", name):
        return name
    m = re.match(r"^([a-z]+)\d+$", name)
    if m:
        return m.group(1)
    return name


def _owning_mount(path: str, mounts: list[tuple[str, str, str]]) -> tuple[str, str, str] | None:
    """Mount entry that owns `path` — the longest mountpoint prefix match, like `df`."""
    real = os.path.realpath(path)
    best: tuple[str, str, str] | None = None
    for entry in mounts:
        mp = entry[1]
        if real == mp or real.startswith(mp.rstrip("/") + "/"):
            if best is None or len(mp) > len(best[1]):
                best = entry
    return best


def _device_raw_bytes(base_device: str) -> int | None:
    try:
        sectors = int(Path(f"/sys/block/{base_device}/size").read_text().strip())
        return sectors * 512
    except (OSError, ValueError):
        return None


def _disk_group(path: str, mounts: list[tuple[str, str, str]], prefix: str) -> tuple[int, int, list[DiskPartition]]:
    """Total/used/partitions for the physical device backing `path`. Total prefers
    the device's real raw capacity (/sys/block) over the sum of partitions, since a
    disk is often only partially partitioned. `prefix` (e.g. "/host") is stripped
    from the displayed mount labels so they read like the host's real paths."""
    def _label(mp: str) -> str:
        if not prefix:
            return mp
        stripped = mp[len(prefix):] if mp.startswith(prefix) else mp
        return stripped or "/"

    owner = _owning_mount(path, mounts)
    if owner is None:
        usage = shutil.disk_usage(path)
        return usage.total, usage.used, [DiskPartition(mount=_label(path), device="?", total=usage.total, used=usage.used, percent=round(100.0 * usage.used / usage.total, 1) if usage.total else 0.0)]

    base = _base_device(owner[0])
    siblings = [m for m in mounts if _base_device(m[0]) == base]

    partitions: list[DiskPartition] = []
    used_sum = 0
    total_sum = 0
    for device, mountpoint, _fstype in sorted(siblings, key=lambda m: m[1]):
        try:
            usage = shutil.disk_usage(mountpoint)
        except OSError:
            continue
        used_sum += usage.used
        total_sum += usage.total
        partitions.append(DiskPartition(
            mount=_label(mountpoint), device=device, total=usage.total, used=usage.used,
            percent=round(100.0 * usage.used / usage.total, 1) if usage.total else 0.0,
        ))

    raw_total = _device_raw_bytes(base)
    total = raw_total if raw_total and raw_total >= total_sum else total_sum
    return total, used_sum, partitions


@router.get("/system", response_model=SystemHealth)
async def system_health():
    t1, i1 = _cpu_times()
    await asyncio.sleep(0.3)
    t2, i2 = _cpu_times()
    dt = t2 - t1
    cpu = round(100.0 * (1 - (i2 - i1) / dt), 1) if dt > 0 else 0.0

    mem_total, mem_used = _meminfo()
    prefix = os.environ.get("HOST_FS_PREFIX", "").rstrip("/")
    mounts = _real_mounts(prefix)

    # NVME_PATH: the system disk (default "/"). DISK_PATH: the big storage
    # volume shown as "Disco" (default "/" too if nothing else is mounted —
    # override per-deployment, e.g. DISK_PATH=/srv/samba for a RAID array).
    # HOST_FS_PREFIX (containerised deploys) is prepended before probing.
    nvme_total, nvme_used, nvme_partitions = _disk_group(prefix + os.environ.get("NVME_PATH", "/"), mounts, prefix)
    disk_total, disk_used, disk_partitions = _disk_group(prefix + os.environ.get("DISK_PATH", "/"), mounts, prefix)

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
        disk_total=disk_total,
        disk_used=disk_used,
        disk_percent=round(100.0 * disk_used / disk_total, 1) if disk_total else 0.0,
        disk_partitions=disk_partitions,
        nvme_total=nvme_total,
        nvme_used=nvme_used,
        nvme_percent=round(100.0 * nvme_used / nvme_total, 1) if nvme_total else 0.0,
        nvme_partitions=nvme_partitions,
        uptime_seconds=int(uptime),
        checked_at=_now(),
    )
