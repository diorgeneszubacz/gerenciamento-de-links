"""Idempotent first-run seed: admin user + example categories/services."""

import logging
import os

from lib.auth import hash_password
from lib.db import db
from lib.logos import fetch_many
from models.schemas import Category, Service, User

logger = logging.getLogger(__name__)

CATEGORIES = [
    ("Gerenciamento do Servidor", "server"),
    ("Banco de Dados & Web", "database"),
    ("Impressão", "printer"),
    ("Downloads & Arquivos", "download"),
]

# (name, description, category index, protocol, port, path, icon slug)
SERVICES = [
    ("Webmin", "Painel de administração web do servidor Debian", 0, "https", 10000, "/", "webmin"),
    ("phpMyAdmin", "Administração dos bancos de dados MySQL / MariaDB", 1, "http", 80, "/phpmyadmin", "phpmyadmin"),
    ("CUPS", "Servidor de impressão — impressoras e filas", 2, "http", 631, "/", "cups"),
    ("Downloads", "Central de arquivos e downloads internos", 3, "http", 80, "/downloads", "nextcloud"),
]


async def seed_defaults() -> None:
    if not await db.users.find_one({"role": "admin"}):
        admin = User(username=os.environ["ADMIN_USERNAME"], role="admin")
        doc = admin.model_dump()
        doc["password_hash"] = hash_password(os.environ["ADMIN_PASSWORD"])
        await db.users.insert_one(doc)
        logger.info("Seeded admin user")

    if await db.categories.count_documents({}) > 0:
        return
    cats = [Category(name=n, icon=i, order=idx) for idx, (n, i) in enumerate(CATEGORIES)]
    await db.categories.insert_many([c.model_dump() for c in cats])

    cdn = "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/{}.png"
    fetched = await fetch_many([(s[0], s[0], cdn.format(s[6])) for s in SERVICES])
    logos = {name: data for name, _, data in fetched}
    services = [
        Service(
            name=name, description=desc, category_id=cats[ci].id, url_mode="port",
            protocol=proto, port=port, path=path, logo=logos.get(name), order=idx,
        )
        for idx, (name, desc, ci, proto, port, path, _) in enumerate(SERVICES)
    ]
    await db.services.insert_many([s.model_dump() for s in services])
    logger.info("Seeded default categories/services")
