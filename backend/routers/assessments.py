"""
Assessment upload and management router.
Handles CSV ingestion for math and literacy assessments.
"""
import io
from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.dependencies import get_current_active_teacher, log_audit_event
from models.user import User
from models.assessment import Assessment, Question, StudentScore
from models.school import Classroom
from services.csv_ingestion import parse_reveal_assessment_csv, parse_metadata_csv, parse_literacy_csv

router = APIRouter()


@router.get("/")
async def list_assessments(
    current_user: User = Depends(get_current_active_teacher),
    db: AsyncSession = Depends(get_db),
):
    """List all assessments for the current user's school."""
    result = await db.execute(
        select(Assessment)
        .where(Assessment.school_id == current_user.school_id)
        .order_by(Assessment.created_at.desc())
    )
    assessments = result.scalars().all()
    return [
        {
            "id": str(a.id),
            "name": a.name,
            "assessment_type": a.assessment_type,
            "unit": a.unit,
            "week_of": a.week_of.isoformat() if a.week_of else None,
            "classroom_id": str(a.classroom_id),
            "student_count": a.student_count,
            "question_count": a.question_count,
            "created_at": a.created_at.isoformat(),
        }
        for a in assessments
    ]


async def _get_or_create_default_classroom(
    db: AsyncSession, school_id, user_id
) -> Classroom:
    """Get or create a default classroom for the school."""
    result = await db.execute(
        select(Classroom).where(
            Classroom.school_id == school_id,
            Classroom.name == "Default",
            Classroom.is_active == True,
        )
    )
    classroom = result.scalar_one_or_none()
    if not classroom:
        import uuid as _uuid
        classroom = Classroom(
            id=_uuid.uuid4(),
            school_id=school_id,
            name="Default",
            grade_level="",
            teacher_id=user_id,
        )
        db.add(classroom)
        await db.flush()
    return classroom


@router.post("/upload/quick", status_code=status.HTTP_201_CREATED)
async def upload_quick_assessment(
    file: UploadFile = File(..., description="Reveal Math student scores CSV"),
    metadata_file: UploadFile = File(None, description="Optional: Reveal Math metadata CSV with standards, DOK, question types"),
    assessment_name: str = Form(None),
    unit: str = Form(None),
    current_user: User = Depends(get_current_active_teacher),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a Reveal Math assessment CSV with an optional metadata CSV.

    - **file**: Required student scores CSV (columns like Q1 (1 point), Q2 (1 point), etc.)
    - **metadata_file**: Optional metadata CSV with Question, Type, Points, Standard(s), DOK columns.
      When provided, questions are enriched with standards alignment and DOK levels.
    """
    import re
    import pandas as pd_lib

    content = await file.read()
    scores_df, warnings = parse_reveal_assessment_csv(content)

    # Parse optional metadata CSV
    metadata_map: dict = {}  # question_number -> {type, points, standards, dok}
    if metadata_file is not None:
        meta_content = await metadata_file.read()
        if meta_content:
            try:
                meta_df = pd_lib.read_csv(io.BytesIO(meta_content))
                # Normalize column names
                meta_df.columns = [c.strip() for c in meta_df.columns]
                # Find the question number column (could be "Question" or "question")
                q_col = None
                for c in meta_df.columns:
                    if c.lower() == "question":
                        q_col = c
                        break
                if q_col:
                    for _, row in meta_df.iterrows():
                        try:
                            q_num = int(row[q_col])
                        except (ValueError, TypeError):
                            continue
                        # Find standard(s) column
                        std_val = ""
                        for c in meta_df.columns:
                            if "standard" in c.lower():
                                std_val = str(row.get(c, "")).strip()
                                break
                        # Find DOK column
                        dok_val = ""
                        for c in meta_df.columns:
                            if "dok" in c.lower():
                                dok_val = str(row.get(c, "")).strip()
                                break
                        # Find Type column
                        type_val = ""
                        for c in meta_df.columns:
                            if c.lower() == "type":
                                type_val = str(row.get(c, "")).strip()
                                break
                        # Find Points column
                        pts_val = None
                        for c in meta_df.columns:
                            if c.lower() == "points":
                                try:
                                    pts_val = float(row.get(c, 1.0))
                                except (ValueError, TypeError):
                                    pass
                                break

                        standards_list = [s.strip() for s in std_val.split(",") if s.strip()] if std_val else []

                        metadata_map[q_num] = {
                            "question_type": type_val,
                            "max_points": pts_val,
                            "standards": standards_list,
                            "dok_level": dok_val,
                        }
                else:
                    warnings.append("Metadata CSV: could not find 'Question' column — metadata ignored.")
            except Exception as e:
                warnings.append(f"Metadata CSV parse warning: {str(e)} — metadata ignored.")

    # Get or create default classroom
    classroom = await _get_or_create_default_classroom(
        db, current_user.school_id, current_user.id
    )

    # Extract question metadata from score column headers (e.g., "Q1 (1 point)")
    question_meta = []
    for col in scores_df.columns:
        match = re.match(r"Q(\d+)\s*\((\d+\.?\d*)\s*point", col)
        if match:
            q_num = int(match.group(1))
            header_pts = float(match.group(2))
            meta = metadata_map.get(q_num, {})
            question_meta.append({
                "question_number": q_num,
                "max_points": meta.get("max_points") or header_pts,
                "question_type": meta.get("question_type", "auto"),
                "standards": meta.get("standards", []),
                "dok_level": meta.get("dok_level", ""),
                "col_name": col,
            })

    if not question_meta:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No question columns found. Expected format: 'Q1 (1 point)', 'Q2 (2 points)', etc."
        )

    # Create assessment record
    assessment = Assessment(
        school_id=current_user.school_id,
        classroom_id=classroom.id,
        uploaded_by=current_user.id,
        name=assessment_name or file.filename or "Untitled Assessment",
        assessment_type="math",
        unit=unit,
        student_count=len(scores_df),
        question_count=len(question_meta),
    )
    db.add(assessment)
    await db.flush()

    # Create question records (enriched with metadata when available)
    question_map = {}
    for qm in question_meta:
        question = Question(
            assessment_id=assessment.id,
            question_number=qm["question_number"],
            question_type=qm["question_type"],
            max_points=qm["max_points"],
            standards=qm["standards"],
            dok_level=qm["dok_level"],
        )
        db.add(question)
        await db.flush()
        question_map[qm["question_number"]] = (question, qm["col_name"])

    # Create student score records
    score_count = 0
    for _, row in scores_df.iterrows():
        xid = str(row.get("student_xid", "")).strip()
        if not xid:
            continue

        for q_num, (question, col_name) in question_map.items():
            val = row.get(col_name)
            if pd_lib.isna(val) or str(val).strip() == "":
                continue
            try:
                points = float(val)
            except (ValueError, TypeError):
                continue

            score = StudentScore(
                assessment_id=assessment.id,
                question_id=question.id,
                student_xid=xid,
                points_earned=points,
            )
            db.add(score)
            score_count += 1

    await log_audit_event(
        db, current_user, "UPLOAD_ASSESSMENT",
        resource="assessment", resource_id=str(assessment.id),
    )

    return {
        "assessment_id": str(assessment.id),
        "name": assessment.name,
        "students_processed": len(scores_df),
        "questions_processed": len(question_meta),
        "scores_stored": score_count,
        "warnings": warnings,
    }


@router.post("/upload/math", status_code=status.HTTP_201_CREATED)
async def upload_math_assessment(
    math_csv: UploadFile = File(...),
    metadata_csv: UploadFile = File(...),
    classroom_id: str = Form(...),
    assessment_name: str = Form(None),
    unit: str = Form(None),
    week_of: str = Form(None),
    current_user: User = Depends(get_current_active_teacher),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a Reveal Math assessment with metadata CSV.
    Parses, validates, and stores scores in the database.
    """
    # Verify classroom belongs to the user's school
    classroom = await db.get(Classroom, UUID(classroom_id))
    if not classroom or classroom.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Classroom not found")

    # Parse CSVs
    math_content = await math_csv.read()
    metadata_content = await metadata_csv.read()

    scores_df, score_warnings = parse_reveal_assessment_csv(math_content)
    metadata_df, meta_warnings = parse_metadata_csv(metadata_content)

    # Create assessment record
    from datetime import date as date_type
    parsed_week = None
    if week_of:
        try:
            parsed_week = date_type.fromisoformat(week_of)
        except ValueError:
            pass

    assessment = Assessment(
        school_id=current_user.school_id,
        classroom_id=UUID(classroom_id),
        uploaded_by=current_user.id,
        name=assessment_name or math_csv.filename or "Untitled Assessment",
        assessment_type="math",
        unit=unit,
        week_of=parsed_week,
        student_count=len(scores_df),
        question_count=len(metadata_df),
    )
    db.add(assessment)
    await db.flush()

    # Create question records from metadata
    question_map = {}  # question_number -> Question object
    for _, row in metadata_df.iterrows():
        q_num = int(row["question_number"])
        standards_raw = str(row.get("standards", "")).strip()
        standards_list = [s.strip() for s in standards_raw.split(",") if s.strip()] if standards_raw else []

        question = Question(
            assessment_id=assessment.id,
            question_number=q_num,
            question_type=str(row.get("question_type", "")),
            max_points=float(row.get("max_points", 1.0)),
            standards=standards_list,
            dok_level=str(row.get("dok_level", "")),
        )
        db.add(question)
        await db.flush()
        question_map[q_num] = question

    # Create student score records
    import re
    score_count = 0
    for _, row in scores_df.iterrows():
        xid = str(row.get("student_xid", "")).strip()
        if not xid:
            continue

        for col in scores_df.columns:
            if not (col.startswith("Q") and "(" in col):
                continue
            match = re.match(r"Q(\d+)", col)
            if not match:
                continue
            q_num = int(match.group(1))
            if q_num not in question_map:
                continue

            import pandas as pd
            val = row.get(col)
            if pd.isna(val) or str(val).strip() == "":
                continue

            try:
                points = float(val)
            except (ValueError, TypeError):
                continue

            score = StudentScore(
                assessment_id=assessment.id,
                question_id=question_map[q_num].id,
                student_xid=xid,
                points_earned=points,
            )
            db.add(score)
            score_count += 1

    await log_audit_event(
        db, current_user, "UPLOAD_ASSESSMENT",
        resource="assessment", resource_id=str(assessment.id),
    )

    return {
        "assessment_id": str(assessment.id),
        "students_processed": len(scores_df),
        "questions_processed": len(metadata_df),
        "scores_stored": score_count,
        "warnings": score_warnings + meta_warnings,
    }


@router.get("/{assessment_id}")
async def get_assessment(
    assessment_id: UUID,
    current_user: User = Depends(get_current_active_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Get assessment details by ID."""
    assessment = await db.get(Assessment, assessment_id)
    if not assessment or assessment.school_id != current_user.school_id:
        raise HTTPException(status_code=404, detail="Assessment not found")

    return {
        "id": str(assessment.id),
        "name": assessment.name,
        "assessment_type": assessment.assessment_type,
        "unit": assessment.unit,
        "week_of": assessment.week_of.isoformat() if assessment.week_of else None,
        "classroom_id": str(assessment.classroom_id),
        "student_count": assessment.student_count,
        "question_count": assessment.question_count,
        "created_at": assessment.created_at.isoformat(),
    }
