from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import update

from lib.auth import clear_session, current_user, find_user, hash_password, set_session, verify_password
from lib.db import engine, users
from models.schemas import LoginIn, OkResponse, PasswordChange, User

router = APIRouter(prefix="/auth", tags=["auth"])


def _public(doc: dict) -> User:
    return User(id=doc["id"], username=doc["username"], role=doc["role"], created_at=doc["created_at"])


@router.post("/login", response_model=User)
async def login(body: LoginIn, response: Response):
    doc = await find_user(username=body.username.strip())
    if not doc or not verify_password(body.password, doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Usuário ou senha inválidos")
    set_session(response, doc["id"])
    return _public(doc)


@router.post("/logout", response_model=OkResponse)
async def logout(response: Response):
    clear_session(response)
    return OkResponse()


@router.get("/me", response_model=User)
async def me(user: dict = Depends(current_user)):
    return _public(user)


@router.post("/change-password", response_model=OkResponse)
async def change_password(body: PasswordChange, user: dict = Depends(current_user)):
    if not verify_password(body.current_password, user.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Senha atual incorreta")
    async with engine.begin() as conn:
        await conn.execute(
            update(users).where(users.c.id == user["id"]).values(password_hash=hash_password(body.new_password))
        )
    return OkResponse()
