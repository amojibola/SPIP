"""
Analytics router: all proficiency and visualization endpoints.
All data is tenant-scoped to the authenticated user's school.
"""
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.dependencies import get_current_active_teacher
from models.user import User
from models.assessment import Assessment, StudentScore, Question
from models.school import Classroom
from services.proficiency import calculate_proficiency
from services.root_cause import (
    analyze_story_vs_computation,
    calculate_literacy_correlation,
    build_intervention_groups,
)
import pandas as pd

router = APIRouter()


async def _resolve_assessment_id(
    assessment_id: UUID | None,
    school_id: UUID,
    db: AsyncSession,
) -> UUID | None:
    """If no assessment_id provided, return the most recent assessment for the school."""
    if assessment_id:
        return assessment_id
    result = await db.execute(
        select(Assessment.id)
        .where(Assessment.school_id == school_id)
        .order_by(Assessment.created_at.desc())
        .limit(1)
    )
    row = result.scalar_one_or_none()
    return row if row else None


async def get_assessment_dataframes(
    assessment_id: UUID,
    school_id: UUID,
    db: AsyncSession,
):
    """Fetch assessment data and return as DataFrames. Enforces tenant scoping."""
    # Verify assessment belongs to this school
    assessment = await db.get(Assessment, assessment_id)
    if not assessment or assessment.school_id != school_id:
        return None, None

    # Fetch scores and questions, ordered by CSV row index (preserves CSV row order)
    scores_result = await db.execute(
        select(StudentScore, Question)
        .join(Question, StudentScore.question_id == Question.id)
        .where(StudentScore.assessment_id == assessment_id)
        .order_by(StudentScore.csv_row_index, Question.question_number)
    )
    rows = scores_result.fetchall()

    if not rows:
        return None, None

    # Build scores DataFrame
    scores_data = {}
    questions_meta = {}

    for score, question in rows:
        xid = score.student_xid
        q_col = f"Q{question.question_number} ({question.max_points} point)"

        if xid not in scores_data:
            scores_data[xid] = {"student_xid": xid}
        scores_data[xid][q_col] = score.points_earned

        if question.question_number not in questions_meta:
            questions_meta[question.question_number] = {
                "question_number": question.question_number,
                "question_type": question.question_type,
                "max_points": float(question.max_points),
                "standards": ",".join(question.standards or []),
                "dok_level": question.dok_level,
            }

    scores_df = pd.DataFrame(list(scores_data.values()))
    metadata_df = pd.DataFrame(list(questions_meta.values()))

    return scores_df, metadata_df


@router.get("/proficiency_by_standard")
async def proficiency_by_standard(
    assessment_id: UUID = None,
    current_user: User = Depends(get_current_active_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Bar chart data: proficiency rate per CCSS standard, sorted ascending."""
    resolved_id = await _resolve_assessment_id(assessment_id, current_user.school_id, db)
    if not resolved_id:
        return {"data": [], "suppressed": False}

    scores_df, metadata_df = await get_assessment_dataframes(
        resolved_id, current_user.school_id, db
    )
    if scores_df is None:
        return {"data": [], "suppressed": False}

    _, standard_results, _ = calculate_proficiency(scores_df, metadata_df)

    # Build standard -> question types mapping from metadata
    std_question_types: dict[str, set[str]] = {}
    for _, row in metadata_df.iterrows():
        standards_raw = str(row.get("standards", "")).strip()
        q_type = str(row.get("question_type", "")).strip()
        if not q_type:
            continue
        for std in [s.strip() for s in standards_raw.split(",") if s.strip()]:
            if std not in std_question_types:
                std_question_types[std] = set()
            std_question_types[std].add(q_type)

    data = [
        {
            "standard": r.standard_code,
            "proficiency": round(r.avg_proficiency * 100, 1),
            "student_count": r.student_count,
            "suppressed": r.suppressed,
            "question_types": sorted(std_question_types.get(r.standard_code, [])),
        }
        for r in standard_results
    ]
    return {"data": data, "chart_type": "bar"}


@router.get("/student_heatmap")
async def student_heatmap(
    assessment_id: UUID = None,
    current_user: User = Depends(get_current_active_teacher),
    db: AsyncSession = Depends(get_db),
):
    """
    Heatmap data: anonymized student vs standard proficiency matrix.
    Note: student XIDs returned here are already pseudonyms from the DB.
    """
    resolved_id = await _resolve_assessment_id(assessment_id, current_user.school_id, db)
    if not resolved_id:
        return {"data": [], "chart_type": "heatmap"}

    scores_df, metadata_df = await get_assessment_dataframes(
        resolved_id, current_user.school_id, db
    )
    if scores_df is None:
        return {"data": [], "chart_type": "heatmap"}

    student_results, _, _ = calculate_proficiency(scores_df, metadata_df)

    # Build heatmap matrix (preserve CSV row order)
    xid_order = {xid: idx for idx, xid in enumerate(scores_df["student_xid"].values)}
    ordered_results = sorted(student_results, key=lambda s: xid_order.get(s.student_xid, 999999))

    matrix = []
    for i, student in enumerate(ordered_results):
        row_label = f"S{i+1:02d}"  # Further anonymize: S01, S02, etc.
        for std, score in student.scores_by_standard.items():
            matrix.append({
                "student": row_label,
                "standard": std,
                "score": round(score * 100, 1),
            })

    return {"data": matrix, "chart_type": "heatmap"}


@router.get("/story_problem_analysis")
async def story_problem_analysis(
    assessment_id: UUID = None,
    current_user: User = Depends(get_current_active_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Stacked bar: story problems vs computation performance by DOK level."""
    resolved_id = await _resolve_assessment_id(assessment_id, current_user.school_id, db)
    if not resolved_id:
        return {"data": {}, "chart_type": "stacked_bar"}

    scores_df, metadata_df = await get_assessment_dataframes(
        resolved_id, current_user.school_id, db
    )
    if scores_df is None:
        return {"data": {}, "chart_type": "stacked_bar"}

    result = analyze_story_vs_computation(scores_df, metadata_df)
    return {"data": result, "chart_type": "stacked_bar"}


@router.get("/progress_over_time")
async def progress_over_time(
    classroom_id: UUID,
    current_user: User = Depends(get_current_active_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Line chart: class proficiency rate over sequential assessments."""
    # Verify classroom belongs to this teacher/school
    classroom = await db.get(Classroom, classroom_id)
    if not classroom or classroom.school_id != current_user.school_id:
        return {"data": [], "chart_type": "line"}

    assessments_result = await db.execute(
        select(Assessment)
        .where(
            Assessment.classroom_id == classroom_id,
            Assessment.school_id == current_user.school_id,
        )
        .order_by(Assessment.week_of.asc())
    )
    assessments = assessments_result.scalars().all()

    time_series = []
    for assessment in assessments:
        scores_df, metadata_df = await get_assessment_dataframes(
            assessment.id, current_user.school_id, db
        )
        if scores_df is None:
            continue
        _, _, summary = calculate_proficiency(scores_df, metadata_df)
        time_series.append({
            "date": assessment.week_of.isoformat() if assessment.week_of else None,
            "assessment_name": assessment.name,
            "proficiency_rate": round(summary.proficiency_rate * 100, 1),
            "assessed_students": summary.assessed_students,
        })

    return {"data": time_series, "chart_type": "line"}


@router.get("/intervention_groups")
async def intervention_groups(
    assessment_id: UUID = None,
    current_user: User = Depends(get_current_active_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Grouped bar: students by intervention tier."""
    resolved_id = await _resolve_assessment_id(assessment_id, current_user.school_id, db)
    if not resolved_id:
        return {"data": {}, "chart_type": "grouped_bar"}

    scores_df, metadata_df = await get_assessment_dataframes(
        resolved_id, current_user.school_id, db
    )
    if scores_df is None:
        return {"data": {}, "chart_type": "grouped_bar"}

    student_results, _, _ = calculate_proficiency(scores_df, metadata_df)
    students_list = [{"student_xid": s.student_xid, "pct_score": s.pct_score} for s in student_results]
    groups = build_intervention_groups(students_list)

    return {"data": groups, "chart_type": "grouped_bar"}


@router.get("/proficiency_by_question_type")
async def proficiency_by_question_type(
    assessment_id: UUID = None,
    current_user: User = Depends(get_current_active_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Bar chart data: proficiency rate per question type (e.g., Multiple Choice, Fill In The Blank)."""
    resolved_id = await _resolve_assessment_id(assessment_id, current_user.school_id, db)
    if not resolved_id:
        return {"data": [], "chart_type": "bar"}

    scores_df, metadata_df = await get_assessment_dataframes(
        resolved_id, current_user.school_id, db
    )
    if scores_df is None:
        return {"data": [], "chart_type": "bar"}

    # Build question_number -> question_type mapping
    q_type_map = {}
    q_max_pts = {}
    for _, row in metadata_df.iterrows():
        q_num = int(row["question_number"])
        q_type = str(row.get("question_type", "")).strip()
        if not q_type:
            q_type = "Unknown"
        q_type_map[q_num] = q_type
        q_max_pts[q_num] = float(row.get("max_points", 1.0))

    # Identify score columns
    score_cols = {}
    for col in scores_df.columns:
        if col.startswith("Q") and "(" in col:
            try:
                q_num = int(col.split("Q")[1].split(" ")[0])
                score_cols[q_num] = col
            except (ValueError, IndexError):
                continue

    # Aggregate scores by question type
    type_scores: dict[str, list[float]] = {}
    type_questions: dict[str, int] = {}  # count of questions per type

    for q_num, col in score_cols.items():
        q_type = q_type_map.get(q_num, "Unknown")
        max_pts = q_max_pts.get(q_num, 1.0)

        if q_type not in type_questions:
            type_questions[q_type] = 0
        type_questions[q_type] += 1

        vals = pd.to_numeric(scores_df[col], errors="coerce").dropna()
        for val in vals:
            pct = min(float(val), max_pts) / max_pts if max_pts > 0 else 0.0
            if q_type not in type_scores:
                type_scores[q_type] = []
            type_scores[q_type].append(pct)

    from services.proficiency import SUPPRESSION_THRESHOLD

    data = []
    for q_type, scores in type_scores.items():
        student_count = len(scores)
        suppressed = student_count < SUPPRESSION_THRESHOLD
        data.append({
            "question_type": q_type,
            "proficiency": round(float(pd.Series(scores).mean()) * 100, 1) if not suppressed else 0.0,
            "student_count": student_count,
            "question_count": type_questions.get(q_type, 0),
            "suppressed": suppressed,
        })

    data.sort(key=lambda x: (x["suppressed"], x["proficiency"]))
    return {"data": data, "chart_type": "bar"}


@router.get("/standard_breakdown")
async def standard_breakdown(
    standard: str,
    assessment_id: UUID = None,
    current_user: User = Depends(get_current_active_teacher),
    db: AsyncSession = Depends(get_db),
):
    """
    Detailed breakdown for a single CCSS standard.
    Returns: questions aligned to this standard, per-question stats,
    DOK levels, student score distribution, and intervention tiers.
    """
    resolved_id = await _resolve_assessment_id(assessment_id, current_user.school_id, db)
    if not resolved_id:
        return {"data": None}

    scores_df, metadata_df = await get_assessment_dataframes(
        resolved_id, current_user.school_id, db
    )
    if scores_df is None:
        return {"data": None}

    student_results, standard_results, _ = calculate_proficiency(scores_df, metadata_df)

    # Find this standard in results
    std_info = None
    for sr in standard_results:
        if sr.standard_code == standard:
            std_info = sr
            break

    if not std_info:
        return {"data": None}

    # Find questions aligned to this standard
    questions = []
    for _, row in metadata_df.iterrows():
        standards_raw = str(row.get("standards", "")).strip()
        standards_list = [s.strip() for s in standards_raw.split(",") if s.strip()]
        if standard in standards_list:
            q_num = int(row["question_number"])
            max_pts = float(row.get("max_points", 1.0))
            q_type = str(row.get("question_type", ""))
            dok = str(row.get("dok_level", ""))

            # Calculate per-question stats from scores_df
            col_match = None
            for col in scores_df.columns:
                if col.startswith(f"Q{q_num} ") or col.startswith(f"Q{q_num}("):
                    col_match = col
                    break

            avg_score = 0.0
            pct_correct = 0.0
            answered = 0
            if col_match:
                vals = pd.to_numeric(scores_df[col_match], errors="coerce").dropna()
                answered = len(vals)
                if answered > 0:
                    avg_score = round(float(vals.mean()), 2)
                    pct_correct = round(float((vals >= max_pts).sum() / answered * 100), 1)

            questions.append({
                "question_number": q_num,
                "question_type": q_type,
                "dok_level": dok,
                "max_points": max_pts,
                "avg_score": avg_score,
                "pct_full_credit": pct_correct,
                "students_answered": answered,
            })

    # Student score distribution for this standard
    score_buckets = {"0-39": 0, "40-59": 0, "60-79": 0, "80-89": 0, "90-100": 0}
    student_scores_for_std = []
    for sr in student_results:
        std_score = sr.scores_by_standard.get(standard)
        if std_score is not None:
            pct = round(std_score * 100, 1)
            student_scores_for_std.append(pct)
            if pct < 40:
                score_buckets["0-39"] += 1
            elif pct < 60:
                score_buckets["40-59"] += 1
            elif pct < 80:
                score_buckets["60-79"] += 1
            elif pct < 90:
                score_buckets["80-89"] += 1
            else:
                score_buckets["90-100"] += 1

    distribution = [{"range": k, "count": v} for k, v in score_buckets.items()]

    return {
        "data": {
            "standard": standard,
            "proficiency": round(std_info.avg_proficiency * 100, 1),
            "student_count": std_info.student_count,
            "suppressed": std_info.suppressed,
            "questions": sorted(questions, key=lambda q: q["question_number"]),
            "distribution": distribution,
            "median_score": round(float(pd.Series(student_scores_for_std).median()), 1) if student_scores_for_std else 0,
        }
    }


@router.get("/student_performance")
async def student_performance(
    assessment_id: UUID = None,
    standard: Optional[str] = None,
    question_type: Optional[str] = None,
    current_user: User = Depends(get_current_active_teacher),
    db: AsyncSession = Depends(get_db),
):
    """
    Per-student performance data with breakdowns by standard and question type.
    Students are anonymized as Student01, Student02, etc.
    Optional filters: standard and/or question_type.
    """
    from services.proficiency import SUPPRESSION_THRESHOLD
    import numpy as np

    resolved_id = await _resolve_assessment_id(assessment_id, current_user.school_id, db)
    if not resolved_id:
        return {"students": [], "filters": {"available_standards": [], "available_question_types": []}, "student_count": 0, "suppressed": False}

    scores_df, metadata_df = await get_assessment_dataframes(
        resolved_id, current_user.school_id, db
    )
    if scores_df is None:
        return {"students": [], "filters": {"available_standards": [], "available_question_types": []}, "student_count": 0, "suppressed": False}

    student_results, standard_results, _ = calculate_proficiency(scores_df, metadata_df)

    # Check suppression
    if len(student_results) < SUPPRESSION_THRESHOLD:
        return {"students": [], "filters": {"available_standards": [], "available_question_types": []}, "student_count": len(student_results), "suppressed": True}

    # Build question metadata maps
    q_type_map: dict[int, str] = {}
    q_max_pts: dict[int, float] = {}
    q_standards: dict[int, list[str]] = {}
    for _, row in metadata_df.iterrows():
        q_num = int(row["question_number"])
        q_type = str(row.get("question_type", "")).strip() or "Unknown"
        q_type_map[q_num] = q_type
        q_max_pts[q_num] = float(row.get("max_points", 1.0))
        standards_raw = str(row.get("standards", "")).strip()
        q_standards[q_num] = [s.strip() for s in standards_raw.split(",") if s.strip()]

    # Identify score columns
    score_cols: dict[int, str] = {}
    for col in scores_df.columns:
        if col.startswith("Q") and "(" in col:
            try:
                q_num = int(col.split("Q")[1].split(" ")[0])
                score_cols[q_num] = col
            except (ValueError, IndexError):
                continue

    # Compute per-student scores by question type
    # Use CSV row order (preserved by DataFrame row order) for consistent numbering
    # Build xid -> row_order mapping from scores_df (which preserves CSV insertion order)
    xid_order = {xid: idx for idx, xid in enumerate(scores_df["student_xid"].values)}
    ordered_students = sorted(student_results, key=lambda s: xid_order.get(s.student_xid, 999999))

    students_out = []
    for i, student in enumerate(ordered_students):
        # Find this student's row in scores_df
        student_row = scores_df[scores_df["student_xid"] == student.student_xid]
        if student_row.empty:
            continue

        # Calculate scores by question type for this student
        type_scores: dict[str, list[float]] = {}
        for q_num, col in score_cols.items():
            q_type = q_type_map.get(q_num, "Unknown")
            max_pts = q_max_pts.get(q_num, 1.0)
            val = pd.to_numeric(student_row[col], errors="coerce").values
            if len(val) == 0 or pd.isna(val[0]):
                continue
            pct = min(float(val[0]), max_pts) / max_pts if max_pts > 0 else 0.0
            if q_type not in type_scores:
                type_scores[q_type] = []
            type_scores[q_type].append(pct)

        scores_by_question_type = {
            qt: round(float(np.mean(scores)) * 100, 1)
            for qt, scores in type_scores.items()
        }

        scores_by_standard = {
            std: round(score * 100, 1)
            for std, score in student.scores_by_standard.items()
        }

        # Determine filtered score
        filtered_score = None
        if standard:
            filtered_score = scores_by_standard.get(standard)
        elif question_type:
            filtered_score = scores_by_question_type.get(question_type)

        students_out.append({
            "label": f"Student{i + 1:02d}",
            "overall_score": round(student.pct_score * 100, 1),
            "is_proficient": student.pct_score >= 0.8,
            "filtered_score": filtered_score,
            "scores_by_standard": scores_by_standard,
            "scores_by_question_type": scores_by_question_type,
        })

    # Build available filters
    available_standards = sorted([sr.standard_code for sr in standard_results if not sr.suppressed])
    available_question_types = sorted(set(q_type_map.values()))

    return {
        "students": students_out,
        "filters": {
            "available_standards": available_standards,
            "available_question_types": available_question_types,
        },
        "student_count": len(students_out),
        "suppressed": False,
    }


@router.get("/student_question_detail")
async def student_question_detail(
    student_index: int = Query(..., ge=0, description="0-based student index (CSV row order)"),
    assessment_id: UUID = None,
    standard: Optional[str] = None,
    question_type: Optional[str] = None,
    current_user: User = Depends(get_current_active_teacher),
    db: AsyncSession = Depends(get_db),
):
    """
    Per-question detail for a single student, optionally filtered by standard or question type.
    Used for heatmap cell drill-down.
    """
    resolved_id = await _resolve_assessment_id(assessment_id, current_user.school_id, db)
    if not resolved_id:
        return {"student_label": "", "questions": [], "summary": None}

    scores_df, metadata_df = await get_assessment_dataframes(
        resolved_id, current_user.school_id, db
    )
    if scores_df is None or student_index >= len(scores_df):
        return {"student_label": "", "questions": [], "summary": None}

    # Get the student row (CSV order preserved by DataFrame)
    student_row = scores_df.iloc[student_index]
    student_label = f"Student{student_index + 1:02d}"

    # Build question metadata
    q_meta: dict[int, dict] = {}
    for _, row in metadata_df.iterrows():
        q_num = int(row["question_number"])
        q_meta[q_num] = {
            "question_type": str(row.get("question_type", "")).strip() or "Unknown",
            "max_points": float(row.get("max_points", 1.0)),
            "standards": str(row.get("standards", "")).strip(),
            "dok_level": str(row.get("dok_level", "")),
        }

    # Identify score columns and build question detail
    questions = []
    total_earned = 0.0
    total_possible = 0.0

    for col in scores_df.columns:
        if not (col.startswith("Q") and "(" in col):
            continue
        try:
            q_num = int(col.split("Q")[1].split(" ")[0])
        except (ValueError, IndexError):
            continue

        meta = q_meta.get(q_num, {})
        q_type = meta.get("question_type", "Unknown")
        q_standards = meta.get("standards", "")
        standards_list = [s.strip() for s in q_standards.split(",") if s.strip()]
        max_pts = meta.get("max_points", 1.0)
        dok = meta.get("dok_level", "")

        # Apply filters
        if standard and standard not in standards_list:
            continue
        if question_type and q_type != question_type:
            continue

        val = pd.to_numeric(pd.Series([student_row[col]]), errors="coerce").values[0]
        earned = 0.0
        if not pd.isna(val):
            earned = min(float(val), max_pts)

        pct = round(earned / max_pts * 100, 1) if max_pts > 0 else 0.0
        total_earned += earned
        total_possible += max_pts

        questions.append({
            "question_number": q_num,
            "question_type": q_type,
            "standard": q_standards,
            "dok_level": dok,
            "max_points": max_pts,
            "points_earned": round(earned, 2),
            "pct_score": pct,
        })

    questions.sort(key=lambda q: q["question_number"])

    summary = {
        "total_earned": round(total_earned, 2),
        "total_possible": round(total_possible, 2),
        "pct_score": round(total_earned / total_possible * 100, 1) if total_possible > 0 else 0.0,
    }

    return {
        "student_label": student_label,
        "questions": questions,
        "summary": summary,
    }
