import os
import uuid
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Request
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from models import User, Lecture
from auth import get_current_user, decode_token

logger = logging.getLogger("lecture-api.audio")
router = APIRouter(prefix="/api/audio", tags=["audio"])

AUDIO_DIR = Path(os.getenv("AUDIO_DIR", "/data/audio"))
MAX_AUDIO_SIZE = 500 * 1024 * 1024  # 500 MB


@router.post("/{lecture_id}")
async def upload_audio(
    lecture_id: str,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Lecture).where(Lecture.id == uuid.UUID(lecture_id), Lecture.user_id == user.id)
    )
    lec = result.scalar_one_or_none()
    if not lec:
        raise HTTPException(404, "Lecture not found")

    user_dir = AUDIO_DIR / str(user.id)
    user_dir.mkdir(parents=True, exist_ok=True)

    audio_path = user_dir / f"{lecture_id}.webm"

    size = 0
    with open(audio_path, "wb") as f:
        while chunk := await file.read(1024 * 256):
            size += len(chunk)
            if size > MAX_AUDIO_SIZE:
                audio_path.unlink(missing_ok=True)
                raise HTTPException(413, "Audio file too large")
            f.write(chunk)

    lec.audio_path = str(audio_path)
    await db.commit()

    return {"ok": True, "audioPath": str(audio_path)}


async def _get_user_from_token_param(
    request: Request,
    token: str = Query(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Allow auth via query param for <audio>/<img> elements that can't send headers."""
    tok = token
    if not tok:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            tok = auth_header.split(" ", 1)[1]
    if not tok:
        raise HTTPException(401, "Not authenticated")

    payload = decode_token(tok)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(401, "Invalid token")
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(401, "User not found")
    return user


@router.get("/{lecture_id}")
async def get_audio(
    lecture_id: str,
    user: User = Depends(_get_user_from_token_param),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Lecture).where(Lecture.id == uuid.UUID(lecture_id), Lecture.user_id == user.id)
    )
    lec = result.scalar_one_or_none()
    if not lec or not lec.audio_path:
        raise HTTPException(404, "Audio not found")

    audio_file = Path(lec.audio_path)
    if not audio_file.is_file():
        raise HTTPException(404, "Audio file missing from disk")

    return FileResponse(audio_file, media_type="audio/webm", filename=f"{lec.title}.webm")
