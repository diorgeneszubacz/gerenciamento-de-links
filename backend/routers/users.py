"""User management — admin only. Operators can only change their own password (auth router)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, insert, select, update

from lib.auth import find_user, hash_password, require_admin
from lib.db import engine, users
from models.schemas import OkResponse, PasswordSet, User, UserCreate

router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(require_admin)])


@router.get("", response_model=list[User])
async def list_users():
    async with engine.connect() as conn:
        rows = (await conn.execute(
            select(users.c.id, users.c.username, users.c.role, users.c.created_at).order_by(users.c.created_at)
        )).all()
    return [User(**dict(r._mapping)) for r in rows]


@router.post("", response_model=User)
async def create_user(body: UserCreate):
    if await find_user(username=body.username):
        raise HTTPException(status_code=400, detail="Nome de usuário já existe")
    user = User(username=body.username, role="operator")
    async with engine.begin() as conn:
        await conn.execute(insert(users).values(
            id=user.id, username=user.username, role=user.role,
            password_hash=hash_password(body.password), created_at=user.created_at.replace(tzinfo=None),
        ))
    return user


@router.put("/{id}/password", response_model=OkResponse)
async def set_password(id: str, body: PasswordSet):
    if not await find_user(id=id):
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    async with engine.begin() as conn:
        await conn.execute(update(users).where(users.c.id == id).values(password_hash=hash_password(body.password)))
    return OkResponse()


@router.delete("/{id}", response_model=OkResponse)
async def delete_user(id: str):
    doc = await find_user(id=id)
    if not doc:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if doc.get("role") == "admin":
        raise HTTPException(status_code=400, detail="O administrador principal não pode ser removido")
    async with engine.begin() as conn:
        await conn.execute(delete(users).where(users.c.id == id))
    return OkResponse()
