"""Idempotent first-run seed: admin user + 27º BPM/M categories/services."""

import base64
import logging
import os
from pathlib import Path

from sqlalchemy import func, insert, select

from lib.auth import find_user, hash_password
from lib.db import categories, engine, services, users
from lib.logos import fetch_many
from lib.mapping import service_values
from models.schemas import Category, Service, User

logger = logging.getLogger(__name__)

CREST = Path(__file__).resolve().parents[2] / "frontend" / "public" / "logo-27bpmm.png"

CATEGORIES = [
    ("Sistemas Internos", "briefcase"),
    ("Downloads & Arquivos", "download"),
    ("Gerenciamento do Servidor", "server"),
    ("Impressão", "printer"),
    ("Mapa de rede", "network"),
]

NETWORK_CATEGORY_ID = "00000000-0000-4000-8000-000000000027"

# (name, description, category index, protocol, port, path, logo: "crest" | dashboard-icons slug | None)
SERVICES = [
    ("Dashboard Lilás", "Painel Lilás do batalhão", 0, "http", 80, "/NOVO/", "crest"),
    ("Central de Downloads", "Arquivos e downloads internos", 1, "http", 80, "/Downloads/", None),
    ("27º BPM/M", "Página do 27º Batalhão", 0, "http", 80, "/27bpmm/", "crest"),
    ("SCE", "Sistema de Controle de Efetivo", 0, "http", 8080, "/auth/login", "crest"),
    ("SGL", "Sistema de Gestão Logística", 0, "http", 8082, "/", "crest"),
    ("Servidor de Impressão CUPS", "Impressoras e filas de impressão", 3, "http", 631, "/", "cups"),
    ("Webmin", "Administração web do servidor Debian", 2, "https", 10000, "/", "webmin"),
    ("phpMyAdmin", "Administração dos bancos MySQL / MariaDB", 2, "http", 80, "/phpmyadmin/", "phpmyadmin"),
    ("Painel Admin", "Painel administrativo (admin.php)", 2, "http", 80, "/admin.php", None),
]

CDN = "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/{}.png"


def _crest() -> str | None:
    try:
        return "data:image/png;base64," + base64.b64encode(CREST.read_bytes()).decode()
    except OSError:
        return None


async def seed_defaults() -> None:
    if not await find_user(role="admin"):
        admin = User(username=os.environ["ADMIN_USERNAME"], role="admin")
        async with engine.begin() as conn:
            await conn.execute(insert(users).values(
                id=admin.id, username=admin.username, role="admin",
                password_hash=hash_password(os.environ["ADMIN_PASSWORD"]),
                created_at=admin.created_at.replace(tzinfo=None),
            ))
        logger.info("Seeded admin user")

    async with engine.connect() as conn:
        count = (await conn.execute(select(func.count()).select_from(categories))).scalar_one()
    if count > 0:
        async with engine.begin() as conn:
            existing = (await conn.execute(
                select(categories.c.id).where(categories.c.name == "Mapa de rede")
            )).first()
            if not existing:
                position = (await conn.execute(select(func.max(categories.c.position)))).scalar()
                await conn.execute(insert(categories).values(
                    id=NETWORK_CATEGORY_ID,
                    name="Mapa de rede",
                    icon="network",
                    position=(position + 1) if position is not None else 0,
                ))
                logger.info("Seeded the Mapa de rede category")
        return

    cats: list[Category] = []
    for idx, (name, icon) in enumerate(CATEGORIES):
        values = {"name": name, "icon": icon, "order": idx}
        if name == "Mapa de rede":
            values["id"] = NETWORK_CATEGORY_ID
        cats.append(Category(**values))
    slugs = [s[6] for s in SERVICES if s[6] and s[6] != "crest"]
    fetched = await fetch_many([(slug, slug, CDN.format(slug)) for slug in slugs])
    logos: dict[str, str | None] = {slug: data for slug, _, data in fetched}
    logos["crest"] = _crest()
    category_ids = [category.id for category in cats]

    svcs = [
        Service(
            name=name, description=desc, category_id=category_ids[ci], url_mode="port",
            protocol=proto, port=port, path=path, logo=logos.get(logo) if logo else None, order=idx,
        )
        for idx, (name, desc, ci, proto, port, path, logo) in enumerate(SERVICES)
    ]
    async with engine.begin() as conn:
        await conn.execute(insert(categories), [
            {"id": c.id, "name": c.name, "icon": c.icon, "position": c.order} for c in cats
        ])
        await conn.execute(insert(services), [service_values(s) for s in svcs])
    logger.info("Seeded default categories/services")
