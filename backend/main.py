import os
import uuid
import time
import logging
import secrets
from pathlib import Path
from contextlib import asynccontextmanager
from collections import defaultdict

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Depends, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.base import BaseHTTPMiddleware

from services.gemini_service import GeminiService
from db import create_tables, get_db
from models import User, Lecture
from auth import get_current_user
from routes.auth import router as auth_router
from routes.lectures import router as lectures_router
from routes.transcribe import router as transcribe_router

load_dotenv()
logger = logging.getLogger("lecture-api")

STATIC_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"
MAX_TRANSCRIPT_CHARS = 200_000
RATE_LIMIT_WINDOW = 60
RATE_LIMIT_MAX = 10
IS_PRODUCTION = bool(os.getenv("RENDER") or os.getenv("ENV") == "production")

ai_service: GeminiService | None = None
request_log: dict[str, list[float]] = defaultdict(list)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), geolocation=(), payment=()"
        if IS_PRODUCTION:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    global ai_service

    jwt_secret = os.getenv("JWT_SECRET", "")
    if IS_PRODUCTION and (not jwt_secret or jwt_secret == "dev-secret-change-me"):
        raise RuntimeError("JWT_SECRET must be set to a strong random value in production")

    token = os.getenv("GITHUB_TOKEN")
    if not token:
        raise RuntimeError("GITHUB_TOKEN not set. Get one at github.com/settings/tokens")
    ai_service = GeminiService(token)

    await create_tables()
    logger.info("Database tables created / verified")

    yield


app = FastAPI(
    title="AI Audio Lecture Note Taker",
    lifespan=lifespan,
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None,
)

app.add_middleware(SecurityHeadersMiddleware)

allowed_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:5174,http://localhost:8000"
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if not IS_PRODUCTION else allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(auth_router)
app.include_router(lectures_router)
app.include_router(transcribe_router)


class TranscriptRequest(BaseModel):
    transcript: str
    lecture_id: str | None = None

    @field_validator("transcript")
    @classmethod
    def validate_transcript(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Transcript cannot be empty")
        if len(v) > MAX_TRANSCRIPT_CHARS:
            raise ValueError(f"Transcript too long ({len(v)} chars, max {MAX_TRANSCRIPT_CHARS})")
        return v


def _check_rate_limit(client_ip: str, window: int = RATE_LIMIT_WINDOW, max_req: int = RATE_LIMIT_MAX) -> None:
    now = time.time()
    timestamps = request_log[client_ip]
    request_log[client_ip] = [t for t in timestamps if now - t < window]
    if len(request_log[client_ip]) >= max_req:
        raise HTTPException(429, "Too many requests. Please wait a minute before trying again.")
    request_log[client_ip].append(now)


def _extract_api_error(exc: Exception) -> str:
    msg = str(exc)
    if "429" in msg or "rate" in msg.lower():
        return "The AI service is busy. Please wait a moment and try again."
    if "401" in msg or "403" in msg or "unauthorized" in msg.lower():
        return "Authentication error with AI service. Please contact support."
    return "Something went wrong while processing your request. Please try again."


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.post("/api/summarize")
async def summarize(
    req: TranscriptRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _check_rate_limit(f"ai:{user.id}", window=60, max_req=5)
    try:
        result = await ai_service.summarize(req.transcript)

        if req.lecture_id:
            stmt = select(Lecture).where(
                Lecture.id == uuid.UUID(req.lecture_id),
                Lecture.user_id == user.id,
            )
            lec = (await db.execute(stmt)).scalar_one_or_none()
            if lec:
                lec.summary = result
                lec.status = "summarizing"
                await db.commit()

        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Summarization failed")
        raise HTTPException(502, _extract_api_error(exc))


@app.post("/api/notes")
async def generate_notes(
    req: TranscriptRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _check_rate_limit(f"ai:{user.id}", window=60, max_req=5)
    try:
        result = await ai_service.generate_notes(req.transcript)

        if req.lecture_id:
            stmt = select(Lecture).where(
                Lecture.id == uuid.UUID(req.lecture_id),
                Lecture.user_id == user.id,
            )
            lec = (await db.execute(stmt)).scalar_one_or_none()
            if lec:
                lec.notes = result
                lec.status = "complete"
                await db.commit()

        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Note generation failed")
        raise HTTPException(502, _extract_api_error(exc))


if STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        file_path = STATIC_DIR / full_path
        resolved = file_path.resolve()
        if resolved.is_file() and str(resolved).startswith(str(STATIC_DIR.resolve())):
            return FileResponse(resolved)
        return FileResponse(STATIC_DIR / "index.html")
