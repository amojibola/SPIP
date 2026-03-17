"""Knowledge chunk model for RAG (pgvector embeddings)."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from core.database import Base

# NOTE: pgvector column type will be added when pgvector integration is complete.
# For now, the embedding column is omitted to avoid import errors without pgvector installed.


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id = Column(UUID(as_uuid=True), ForeignKey("schools.id"), nullable=True, index=True)

    document_name = Column(String(255), nullable=False)
    document_type = Column(String(50), nullable=True)  # standard, manual, intervention_guide
    standard_code = Column(String(20), nullable=True, index=True)
    content = Column(Text, nullable=False)

    # embedding = Column(Vector(1536))  # TODO: enable when pgvector extension is active

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
