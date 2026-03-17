"""
Admin router: school and user management for school_admin and super_admin roles.
"""
from typing import Annotated, Optional
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
import secrets

from core.database import get_db
from core.dependencies import get_current_school_admin, get_current_super_admin
from models.user import User
from models.school import School, Classroom

router = APIRouter()


class CreateSchoolRequest(BaseModel):
    name: str
    district: Optional[str] = None
    state: Optional[str] = None


class CreateClassroomRequest(BaseModel):
    name: str
    grade_level: Optional[str] = None
    teacher_id: Optional[str] = None


@router.post("/schools", status_code=status.HTTP_201_CREATED)
async def create_school(
    request: CreateSchoolRequest,
    current_user: User = Depends(get_current_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a new school (super_admin only)."""
    join_code = secrets.token_hex(4).upper()  # 8-char hex code

    school = School(
        name=request.name,
        join_code=join_code,
        district=request.district,
        state=request.state,
        pseudonymization_key=secrets.token_bytes(32),
    )
    db.add(school)
    await db.flush()

    return {
        "id": str(school.id),
        "name": school.name,
        "join_code": school.join_code,
    }


@router.get("/schools")
async def list_schools(
    current_user: User = Depends(get_current_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all schools (super_admin only)."""
    result = await db.execute(select(School).where(School.is_active == True))
    schools = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "name": s.name,
            "join_code": s.join_code,
            "district": s.district,
            "state": s.state,
        }
        for s in schools
    ]


@router.post("/classrooms", status_code=status.HTTP_201_CREATED)
async def create_classroom(
    request: CreateClassroomRequest,
    current_user: User = Depends(get_current_school_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a new classroom within the admin's school."""
    teacher_uuid = UUID(request.teacher_id) if request.teacher_id else None

    # If teacher is specified, verify they belong to the same school
    if teacher_uuid:
        teacher = await db.get(User, teacher_uuid)
        if not teacher or teacher.school_id != current_user.school_id:
            raise HTTPException(status_code=404, detail="Teacher not found in your school")

    classroom = Classroom(
        school_id=current_user.school_id,
        name=request.name,
        grade_level=request.grade_level,
        teacher_id=teacher_uuid,
    )
    db.add(classroom)
    await db.flush()

    return {
        "id": str(classroom.id),
        "name": classroom.name,
        "grade_level": classroom.grade_level,
    }


@router.get("/classrooms")
async def list_classrooms(
    current_user: User = Depends(get_current_school_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all classrooms for the admin's school."""
    result = await db.execute(
        select(Classroom).where(
            Classroom.school_id == current_user.school_id,
            Classroom.is_active == True,
        )
    )
    classrooms = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "name": c.name,
            "grade_level": c.grade_level,
            "teacher_id": str(c.teacher_id) if c.teacher_id else None,
        }
        for c in classrooms
    ]


@router.get("/users")
async def list_school_users(
    current_user: User = Depends(get_current_school_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all users for the admin's school (names are encrypted, return roles only)."""
    result = await db.execute(
        select(User).where(
            User.school_id == current_user.school_id,
            User.is_active == True,
        )
    )
    users = result.scalars().all()
    return [
        {
            "id": str(u.id),
            "role": u.role,
            "is_verified": u.is_verified,
            "created_at": u.created_at.isoformat(),
        }
        for u in users
    ]
