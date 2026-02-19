import os
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from models import User
from auth import hash_password, verify_password, create_token, get_current_user

logger = logging.getLogger("lecture-api.auth")
router = APIRouter(prefix="/api/auth", tags=["auth"])

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")


class SignupRequest(BaseModel):
    email: str
    password: str
    name: str = ""


class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleLoginRequest(BaseModel):
    credential: str


def _user_dict(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
    }


@router.post("/signup")
async def signup(req: SignupRequest, db: AsyncSession = Depends(get_db)):
    if len(req.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    existing = await db.execute(select(User).where(User.email == req.email.lower().strip()))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Email already registered")

    user = User(
        email=req.email.lower().strip(),
        password_hash=hash_password(req.password),
        name=req.name.strip() or req.email.split("@")[0],
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return {"token": create_token(str(user.id)), "user": _user_dict(user)}


@router.post("/login")
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email.lower().strip()))
    user = result.scalar_one_or_none()

    if not user or not user.password_hash or not verify_password(req.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")

    return {"token": create_token(str(user.id)), "user": _user_dict(user)}


@router.post("/google")
async def google_login(req: GoogleLoginRequest, db: AsyncSession = Depends(get_db)):
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={req.credential}"
            )
            if resp.status_code != 200:
                raise HTTPException(401, "Invalid Google token")
            payload = resp.json()
    except httpx.HTTPError:
        raise HTTPException(502, "Failed to verify Google token")

    if GOOGLE_CLIENT_ID and payload.get("aud") != GOOGLE_CLIENT_ID:
        raise HTTPException(401, "Token audience mismatch")

    google_id = payload["sub"]
    email = payload["email"].lower()
    name = payload.get("name", email.split("@")[0])

    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()

    if not user:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user:
            user.google_id = google_id
            if not user.name:
                user.name = name
        else:
            user = User(email=email, name=name, google_id=google_id)
            db.add(user)
        await db.commit()
        await db.refresh(user)

    return {"token": create_token(str(user.id)), "user": _user_dict(user)}


@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    return _user_dict(user)
