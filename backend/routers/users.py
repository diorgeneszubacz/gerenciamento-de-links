"""User management — admin only. Operators can only change their own password (auth router)."""

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import hash_password, require_admin
from lib.db import db
from models.schemas import OkResponse, PasswordSet, User, UserCreate

router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(require_admin)])


@router.get("", response_model=list[User])
async def list_users():
    docs = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", 1).to_list(500)
    return [User(**d) for d in docs]


@router.post("", response_model=User)
async def create_user(body: UserCreate):
    if await db.users.find_one({"username": body.username}):
        raise HTTPException(status_code=400, detail="Nome de usuário já existe")
    user = User(username=body.username, role="operator")
    doc = user.model_dump()
    doc["password_hash"] = hash_password(body.password)
    await db.users.insert_one(doc)
    return user


@router.put("/{id}/password", response_model=OkResponse)
async def set_password(id: str, body: PasswordSet):
    res = await db.users.update_one({"id": id}, {"$set": {"password_hash": hash_password(body.password)}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return OkResponse()


@router.delete("/{id}", response_model=OkResponse)
async def delete_user(id: str):
    doc = await db.users.find_one({"id": id})
    if not doc:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if doc.get("role") == "admin":
        raise HTTPException(status_code=400, detail="O administrador principal não pode ser removido")
    await db.users.delete_one({"id": id})
    return OkResponse()
