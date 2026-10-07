"""Shared SQL database (MySQL/MariaDB in production, SQLite for local dev) via SQLAlchemy async.

DATABASE_URL examples:
  mysql+aiomysql://portal:senha@127.0.0.1:3306/portal27bpmm?charset=utf8mb4
  sqlite+aiosqlite:////app/backend/data/portal.db
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, MetaData, String, Table, Text
from sqlalchemy.dialects.mysql import MEDIUMTEXT
from sqlalchemy.ext.asyncio import create_async_engine

load_dotenv(Path(__file__).parent.parent / ".env")

DATABASE_URL = os.environ["DATABASE_URL"]
# pool_recycle < MySQL wait_timeout; pre_ping is skipped (aiomysql adapter ping() signature mismatch)
engine = create_async_engine(DATABASE_URL, pool_recycle=1800)

metadata = MetaData()

users = Table(
    "users", metadata,
    Column("id", String(36), primary_key=True),
    Column("username", String(40), nullable=False, unique=True),
    Column("role", String(16), nullable=False, default="operator"),
    Column("password_hash", String(255), nullable=False),
    Column("created_at", DateTime, nullable=False),
    mysql_charset="utf8mb4",
)

categories = Table(
    "categories", metadata,
    Column("id", String(36), primary_key=True),
    Column("name", String(60), nullable=False),
    Column("icon", String(30), nullable=False, default="folder"),
    Column("position", Integer, nullable=False, default=0, index=True),
    mysql_charset="utf8mb4",
)

services = Table(
    "services", metadata,
    Column("id", String(36), primary_key=True),
    Column("name", String(80), nullable=False),
    Column("description", String(240), nullable=False, default=""),
    Column("category_id", String(36), nullable=False, index=True),
    Column("url_mode", String(8), nullable=False, default="port"),
    Column("protocol", String(8), nullable=False, default="http"),
    Column("port", Integer, nullable=True),
    Column("path", String(255), nullable=False, default="/"),
    Column("url", String(500), nullable=True),
    Column("logo", Text().with_variant(MEDIUMTEXT(), "mysql"), nullable=True),
    Column("visible", Boolean, nullable=False, default=True),
    Column("position", Integer, nullable=False, default=0, index=True),
    mysql_charset="utf8mb4",
)

network_nodes = Table(
    "network_nodes", metadata,
    Column("id", String(36), primary_key=True),
    Column("name", String(100), nullable=False),
    Column("node_type", String(24), nullable=False, default="other"),
    Column("description", String(240), nullable=False, default=""),
    Column("host", String(255), nullable=True),
    Column("monitor_protocol", String(12), nullable=False, default="icmp"),
    Column("monitor_port", Integer, nullable=True),
    Column("monitor_path", String(255), nullable=False, default="/"),
    Column("position_x", Float, nullable=False, default=50),
    Column("position_y", Float, nullable=False, default=50),
    Column("enabled", Boolean, nullable=False, default=True),
    Column("notes", Text, nullable=False, default=""),
    Column("created_at", DateTime, nullable=False),
    Column("updated_at", DateTime, nullable=False),
    mysql_charset="utf8mb4",
)

network_ports = Table(
    "network_ports", metadata,
    Column("id", String(36), primary_key=True),
    Column("node_id", String(36), nullable=False, index=True),
    Column("name", String(40), nullable=False),
    Column("comment", String(240), nullable=False, default=""),
    Column("vlan", String(40), nullable=False, default=""),
    Column("position", Integer, nullable=False, default=0, index=True),
    Column("created_at", DateTime, nullable=False),
    mysql_charset="utf8mb4",
)

network_links = Table(
    "network_links", metadata,
    Column("id", String(36), primary_key=True),
    Column("source_node_id", String(36), nullable=False, index=True),
    Column("target_node_id", String(36), nullable=False, index=True),
    Column("source_port_id", String(36), nullable=True, index=True),
    Column("target_port_id", String(36), nullable=True, index=True),
    Column("label", String(120), nullable=False, default=""),
    Column("link_type", String(20), nullable=False, default="ethernet"),
    Column("comment", String(500), nullable=False, default=""),
    Column("enabled", Boolean, nullable=False, default=True),
    Column("created_at", DateTime, nullable=False),
    mysql_charset="utf8mb4",
)


async def init_db() -> None:
    if DATABASE_URL.startswith("sqlite"):
        db_file = DATABASE_URL.split(":///", 1)[-1]
        Path(db_file).parent.mkdir(parents=True, exist_ok=True)
    async with engine.begin() as conn:
        await conn.run_sync(metadata.create_all)
