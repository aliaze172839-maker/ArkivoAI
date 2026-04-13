"""Document model — single table for all document metadata + extracted text."""

import json
from sqlalchemy import Column, Integer, String, Text, DateTime, BigInteger, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    invite_code = Column(String(50), nullable=True, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    users = relationship("User", back_populates="organization")
    documents = relationship("Document", back_populates="organization")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    email = Column(String(200), nullable=False, unique=True, index=True)
    hashed_password = Column(String(500), nullable=False)
    role = Column(String(50), default="member")  # 'admin' or 'member'
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    organization = relationship("Organization", back_populates="users")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    parent_id = Column(Integer, index=True, nullable=True)  # Nullable. If set, this is a distinct page belonging to a parent document.
    filename = Column(String(500), nullable=False)          # stored filename (UUID-based)
    original_filename = Column(String(500), nullable=False) # original upload name
    file_type = Column(String(20), nullable=False)          # pdf, jpg, png
    file_size = Column(BigInteger, nullable=False)           # bytes
    extracted_text = Column(Text, default="")                # OCR result
    page_count = Column(Integer, default=1)                  # number of pages (PDF)
    status = Column(String(20), default="pending")           # pending | processing | completed | failed
    error_message = Column(Text, default="")                 # error details if failed
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    # Milestone 2 — AI Classification & Extraction
    doc_type = Column(String(30), default="unknown")         # invoice | contract | report | other | unknown
    extracted_metadata = Column(Text, default="{}")          # JSON string of structured fields
    ocr_layout_data = Column(Text, default="[]")             # JSON: bounding box layout per page
    
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    organization = relationship("Organization", back_populates="documents")

    def to_dict(self):
        # Parse stored JSON metadata safely
        try:
            meta = json.loads(self.extracted_metadata or "{}")
        except (json.JSONDecodeError, TypeError):
            meta = {}
        return {
            "id": self.id,
            "filename": self.filename,
            "original_filename": self.original_filename,
            "file_type": self.file_type,
            "file_size": self.file_size,
            "extracted_text": self.extracted_text,
            "page_count": self.page_count,
            "status": self.status,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "type": self.doc_type or "unknown",
            "extracted_metadata": meta,
            "organization_id": self.organization_id,
        }
