import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from models import User, Lecture
from auth import get_current_user

logger = logging.getLogger("lecture-api.lectures")
router = APIRouter(prefix="/api/lectures", tags=["lectures"])


class LectureCreate(BaseModel):
    title: str
    course: str = ""
    date: str
    duration: int = 0
    tags: list[str] = []
    transcript: dict | None = None
    status: str = "transcribed"


class LectureUpdate(BaseModel):
    title: str | None = None
    course: str | None = None
    tags: list[str] | None = None
    transcript: dict | None = None
    summary: dict | None = None
    notes: dict | None = None
    status: str | None = None
    error_message: str | None = None
    audio_path: str | None = None


def _lecture_dict(lec: Lecture) -> dict:
    return {
        "id": str(lec.id),
        "title": lec.title,
        "course": lec.course,
        "date": lec.date,
        "duration": lec.duration,
        "tags": lec.tags or [],
        "transcript": lec.transcript,
        "summary": lec.summary,
        "notes": lec.notes,
        "status": lec.status,
        "errorMessage": lec.error_message,
        "audioPath": lec.audio_path,
        "createdAt": lec.created_at.isoformat() if lec.created_at else None,
        "updatedAt": lec.updated_at.isoformat() if lec.updated_at else None,
    }


@router.get("")
async def list_lectures(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Lecture)
        .where(Lecture.user_id == user.id)
        .order_by(Lecture.created_at.desc())
    )
    return [_lecture_dict(l) for l in result.scalars().all()]


@router.get("/{lecture_id}")
async def get_lecture(
    lecture_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Lecture).where(Lecture.id == uuid.UUID(lecture_id), Lecture.user_id == user.id)
    )
    lec = result.scalar_one_or_none()
    if not lec:
        raise HTTPException(404, "Lecture not found")
    return _lecture_dict(lec)


@router.post("")
async def create_lecture(
    body: LectureCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    lec = Lecture(
        user_id=user.id,
        title=body.title,
        course=body.course,
        date=body.date,
        duration=body.duration,
        tags=body.tags,
        transcript=body.transcript,
        status=body.status,
    )
    db.add(lec)
    await db.commit()
    await db.refresh(lec)
    return _lecture_dict(lec)


@router.put("/{lecture_id}")
async def update_lecture(
    lecture_id: str,
    body: LectureUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Lecture).where(Lecture.id == uuid.UUID(lecture_id), Lecture.user_id == user.id)
    )
    lec = result.scalar_one_or_none()
    if not lec:
        raise HTTPException(404, "Lecture not found")

    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(lec, field, value)

    await db.commit()
    await db.refresh(lec)
    return _lecture_dict(lec)


@router.delete("/{lecture_id}")
async def delete_lecture(
    lecture_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Lecture).where(Lecture.id == uuid.UUID(lecture_id), Lecture.user_id == user.id)
    )
    lec = result.scalar_one_or_none()
    if not lec:
        raise HTTPException(404, "Lecture not found")

    await db.delete(lec)
    await db.commit()
    return {"ok": True}
