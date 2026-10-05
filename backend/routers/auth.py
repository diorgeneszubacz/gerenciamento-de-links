from fastapi import APIRouter, Depends, HTTPException, Response

from lib.auth import clear_session, current_user, hash_password, set_session, verify_password
from lib.db import db
from models.schemas import LoginIn, OkResponse, PasswordChange, User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=User)
async def login(body: LoginIn, response: Response):
    doc = await db.users.find_one({"username": body.username.strip()}, {"_id": 0})
    if not doc or not verify_password(body.password, doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Usuário ou senha inválidos")
    set_session(response, doc["id"])
    return User(**doc)


@router.post("/logout", response_model=OkResponse)
async def logout(response: Response):
    clear_session(response)
    return OkResponse()


@router.get("/me", response_model=User)
async def me(user: dict = Depends(current_user)):
    return User(**user)


@router.post("/change-password", response_model=OkResponse)
async def change_password(body: PasswordChange, user: dict = Depends(current_user)):
    if not verify_password(body.current_password, user.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Senha atual incorreta")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(body.new_password)}})
    return OkResponse()
