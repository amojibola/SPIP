"""
AI instructional assistant router.
Handles chat requests with anonymized data context.
"""
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_active_teacher
from models.user import User
from models.assessment import Assessment
from services.ai_service import chat_with_ai
from services.proficiency import calculate_proficiency
from routers.analytics import get_assessment_dataframes

router = APIRouter()


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    question: str
    assessment_id: Optional[str] = None
    conversation_history: List[ChatMessage] = []


@router.post("/chat")
async def ai_chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_active_teacher),
    db: AsyncSession = Depends(get_db),
):
    """
    Chat with the AI instructional assistant.
    Automatically injects anonymized class data context if an assessment is selected.
    """
    anonymized_stats = {}

    if request.assessment_id:
        try:
            assessment_uuid = UUID(request.assessment_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid assessment ID")

        scores_df, metadata_df = await get_assessment_dataframes(
            assessment_uuid, current_user.school_id, db
        )

        if scores_df is not None and metadata_df is not None:
            _, standard_results, summary = calculate_proficiency(scores_df, metadata_df)
            anonymized_stats = {
                "class_proficiency_rate": summary.proficiency_rate,
                "assessed_students": summary.assessed_students,
                "proficient_students": summary.proficient_students,
                "avg_raw_score": summary.avg_raw_score,
                "weakest_standards": [
                    {
                        "standard_code": s.standard_code,
                        "avg_proficiency": s.avg_proficiency,
                        "student_count": s.student_count,
                    }
                    for s in standard_results if not s.suppressed
                ],
            }

    # Build conversation history for AI
    history = [
        {"role": m.role, "content": m.content}
        for m in request.conversation_history
    ]

    result = await chat_with_ai(
        question=request.question,
        anonymized_stats=anonymized_stats,
        db=db,
        school_id=current_user.school_id,
        conversation_history=history,
    )

    return result
