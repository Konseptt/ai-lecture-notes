import os
import re
import time
import logging
from collections import defaultdict

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from models import User
from auth import hash_password, verify_password, create_token, get_current_user

logger = logging.getLogger("lecture-api.auth")
router = APIRouter(prefix="/api/auth", tags=["auth"])

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")

AUTH_RATE_WINDOW = 300  # 5 minutes
AUTH_RATE_MAX = 10
auth_attempts: dict[str, list[float]] = defaultdict(list)

EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")
PASSWORD_MIN = 8


def _auth_rate_limit(ip: str) -> None:
    now = time.time()
    attempts = auth_attempts[ip]
    auth_attempts[ip] = [t for t in attempts if now - t < AUTH_RATE_WINDOW]
    if len(auth_attempts[ip]) >= AUTH_RATE_MAX:
        raise HTTPException(429, "Too many attempts. Please wait a few minutes.")
    auth_attempts[ip].append(now)


def _validate_email(email: str) -> str:
    email = email.lower().strip()
    if not email or len(email) > 320 or not EMAIL_RE.match(email):
        raise HTTPException(400, "Invalid email address")
    return email


def _validate_password(password: str) -> None:
    if len(password) < PASSWORD_MIN:
        raise HTTPException(400, f"Password must be at least {PASSWORD_MIN} characters")
    if password.isdigit() or password.isalpha():
        raise HTTPException(400, "Password must contain both letters and numbers")


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
async def signup(req: SignupRequest, request: Request, db: AsyncSession = Depends(get_db)):
    _auth_rate_limit(request.client.host if request.client else "unknown")

    email = _validate_email(req.email)
    _validate_password(req.password)

    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Email already registered")

    name = req.name.strip()[:200] or email.split("@")[0]

    user = User(
        email=email,
        password_hash=hash_password(req.password),
        name=name,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return {"token": create_token(str(user.id)), "user": _user_dict(user)}


@router.post("/login")
async def login(req: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    _auth_rate_limit(request.client.host if request.client else "unknown")

    email = _validate_email(req.email)

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user or not user.password_hash or not verify_password(req.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")

    return {"token": create_token(str(user.id)), "user": _user_dict(user)}


@router.post("/google")
async def google_login(req: GoogleLoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    _auth_rate_limit(request.client.host if request.client else "unknown")

    if not req.credential or len(req.credential) > 4096:
        raise HTTPException(400, "Invalid credential")

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={req.credential}"
            )
            if resp.status_code != 200:
                raise HTTPException(401, "Invalid Google token")
            payload = resp.json()
    except httpx.HTTPError:
        raise HTTPException(502, "Failed to verify Google token")

    if not payload.get("email_verified", "false") == "true":
        raise HTTPException(401, "Google email not verified")

    if GOOGLE_CLIENT_ID and payload.get("aud") != GOOGLE_CLIENT_ID:
        raise HTTPException(401, "Token audience mismatch")

    google_id = payload.get("sub")
    email = payload.get("email", "").lower()
    name = payload.get("name", email.split("@")[0])

    if not google_id or not email:
        raise HTTPException(401, "Invalid Google token payload")

    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()

    if not user:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user:
            user.google_id = google_id
            if not user.name:
                user.name = name[:200]
        else:
            user = User(email=email, name=name[:200], google_id=google_id)
            db.add(user)
        await db.commit()
        await db.refresh(user)

    return {"token": create_token(str(user.id)), "user": _user_dict(user)}


@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    return _user_dict(user)
