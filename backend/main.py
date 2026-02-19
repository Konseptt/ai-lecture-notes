import os
import uuid
import time
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from collections import defaultdict

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from services.gemini_service import GeminiService
from db import create_tables, get_db
from models import User, Lecture
from auth import get_current_user
from routes.auth import router as auth_router
from routes.lectures import router as lectures_router

load_dotenv()
logger = logging.getLogger("lecture-api")

STATIC_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"
MAX_TRANSCRIPT_CHARS = 200_000
RATE_LIMIT_WINDOW = 60
RATE_LIMIT_MAX = 10

ai_service: GeminiService | None = None
request_log: dict[str, list[float]] = defaultdict(list)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global ai_service
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
    docs_url=None if os.getenv("ENV") == "production" else "/docs",
    redoc_url=None,
)

allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5174,http://localhost:8000").split(",")
is_production = os.getenv("RENDER") or os.getenv("ENV") == "production"
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if is_production else allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(auth_router)
app.include_router(lectures_router)


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


def _check_rate_limit(client_ip: str) -> None:
    now = time.time()
    timestamps = request_log[client_ip]
    request_log[client_ip] = [t for t in timestamps if now - t < RATE_LIMIT_WINDOW]
    if len(request_log[client_ip]) >= RATE_LIMIT_MAX:
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
    _check_rate_limit(request.client.host if request.client else "unknown")
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
    _check_rate_limit(request.client.host if request.client else "unknown")
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
        if file_path.is_file() and STATIC_DIR in file_path.resolve().parents:
            return FileResponse(file_path)
        return FileResponse(STATIC_DIR / "index.html")
