"""Assessment, Question, and StudentScore models."""
import uuid
from datetime import datetime, timezone, date
from sqlalchemy import Column, String, Boolean, DateTime, Integer, Float, Date, ForeignKey, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from core.database import Base


class Assessment(Base):
    __tablename__ = "assessments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id = Column(UUID(as_uuid=True), ForeignKey("schools.id"), nullable=False, index=True)
    classroom_id = Column(UUID(as_uuid=True), ForeignKey("classrooms.id"), nullable=False, index=True)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    name = Column(String(255), nullable=False)
    assessment_type = Column(String(20), nullable=False, default="math")  # math, literacy
    unit = Column(String(100), nullable=True)
    week_of = Column(Date, nullable=True)

    student_count = Column(Integer, nullable=True)
    question_count = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    school = relationship("School", back_populates="assessments")
    classroom = relationship("Classroom", back_populates="assessments")
    uploader = relationship("User", foreign_keys=[uploaded_by])
    questions = relationship("Question", back_populates="assessment", cascade="all, delete-orphan")
    scores = relationship("StudentScore", back_populates="assessment", cascade="all, delete-orphan")


class Question(Base):
    __tablename__ = "questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assessment_id = Column(UUID(as_uuid=True), ForeignKey("assessments.id"), nullable=False, index=True)

    question_number = Column(Integer, nullable=False)
    question_type = Column(String(100), nullable=True)  # Multiple Choice, Fill In The Blank, etc.
    max_points = Column(Float, nullable=False, default=1.0)
    standards = Column(ARRAY(String), nullable=True)  # e.g. ["3.OA.C.7", "3.OA.B.6"]
    dok_level = Column(String(255), nullable=True)  # Webb's DOK Level 1: Recall and Reproduction, etc.

    # Relationships
    assessment = relationship("Assessment", back_populates="questions")
    scores = relationship("StudentScore", back_populates="question", cascade="all, delete-orphan")


class StudentScore(Base):
    __tablename__ = "student_scores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assessment_id = Column(UUID(as_uuid=True), ForeignKey("assessments.id"), nullable=False, index=True)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id"), nullable=False, index=True)

    student_xid = Column(String(255), nullable=False, index=True)  # Pseudonymized student ID
    points_earned = Column(Float, nullable=False)
    csv_row_index = Column(Integer, nullable=True)  # Original CSV row number (0-based)

    # Relationships
    assessment = relationship("Assessment", back_populates="scores")
    question = relationship("Question", back_populates="scores")
