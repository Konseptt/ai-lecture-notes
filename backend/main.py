import os
import logging
from pathlib import Path
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from services.gemini_service import GeminiService

load_dotenv()
logger = logging.getLogger("lecture-api")

STATIC_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"

ai_service: GeminiService | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global ai_service
    token = os.getenv("GITHUB_TOKEN")
    if not token:
        raise RuntimeError("GITHUB_TOKEN not set in environment. Get one at github.com/settings/tokens")
    ai_service = GeminiService(token)
    yield


app = FastAPI(title="AI Audio Lecture Note Taker", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TranscriptRequest(BaseModel):
    transcript: str


def _extract_api_error(exc: Exception) -> str:
    msg = str(exc)
    if "429" in msg or "rate" in msg.lower():
        return "Rate limit reached. Please wait a moment and try again."
    if "401" in msg or "403" in msg or "unauthorized" in msg.lower():
        return "Invalid GitHub token. Check GITHUB_TOKEN in backend/.env"
    return f"AI API error: {msg[:300]}"


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.post("/api/summarize")
async def summarize(req: TranscriptRequest):
    if not req.transcript.strip():
        raise HTTPException(400, "Transcript is empty")
    try:
        return await ai_service.summarize(req.transcript)
    except Exception as exc:
        logger.exception("Summarization failed")
        raise HTTPException(502, _extract_api_error(exc))


@app.post("/api/notes")
async def generate_notes(req: TranscriptRequest):
    if not req.transcript.strip():
        raise HTTPException(400, "Transcript is empty")
    try:
        return await ai_service.generate_notes(req.transcript)
    except Exception as exc:
        logger.exception("Note generation failed")
        raise HTTPException(502, _extract_api_error(exc))


# Serve frontend static files in production
if STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        file_path = STATIC_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(STATIC_DIR / "index.html")
