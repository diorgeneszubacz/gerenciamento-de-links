"""Fetch remote/local images and turn them into data URLs."""

import asyncio
import base64
import re
from typing import Optional

import httpx

ICON_CDNS = [
    ("Dashboard Icons", "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/{slug}.png"),
    ("selfh.st Icons", "https://cdn.jsdelivr.net/gh/selfhst/icons/png/{slug}.png"),
]
MAX_BYTES = 800_000


def slug_variants(name: str) -> list[str]:
    base = name.lower().strip()
    base = re.sub(r"\(.*?\)", "", base).strip()
    words = re.findall(r"[a-z0-9]+", base)
    if not words:
        return []
    out = ["-".join(words), "".join(words), words[0]]
    seen: list[str] = []
    for s in out:
        if s and s not in seen:
            seen.append(s)
    return seen


async def fetch_data_url(client: httpx.AsyncClient, url: str) -> Optional[str]:
    try:
        r = await client.get(url)
    except Exception:
        return None
    if r.status_code != 200 or not r.content or len(r.content) > MAX_BYTES:
        return None
    ctype = r.headers.get("content-type", "").split(";")[0].strip()
    if not ctype.startswith("image/"):
        if url.endswith(".ico"):
            ctype = "image/x-icon"
        elif url.endswith(".png"):
            ctype = "image/png"
        else:
            return None
    return f"data:{ctype};base64,{base64.b64encode(r.content).decode()}"


def new_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=4.0, follow_redirects=True, verify=False)


async def fetch_many(urls: list[tuple[str, str, str]]) -> list[tuple[str, str, str]]:
    """urls: (source, label, url) -> list of (source, label, data_url) that succeeded."""
    async with new_client() as client:
        results = await asyncio.gather(*(fetch_data_url(client, u) for _, _, u in urls))
    return [(s, l, d) for (s, l, _), d in zip(urls, results) if d]
