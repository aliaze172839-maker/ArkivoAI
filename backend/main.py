"""
AI Document Management System — FastAPI Backend
================================================
Security-hardened version with:
- Environment-based configuration (no hardcoded secrets)
- Restricted CORS origins
- Security headers middleware
- Rate limiting on auth & AI endpoints
- Input validation & file content verification
- Full tenant isolation on all endpoints
"""

import os
import uuid
import json
import csv
import io
import logging
from pathlib import Path
from datetime import datetime

from typing import Dict, Any, List
from pydantic import BaseModel, EmailStr, Field, field_validator
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Query, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse, Response, StreamingResponse
from sqlalchemy.orm import Session
import string
import random

# ── Secure Configuration ─────────────────────────────────────────────────────
import config  # noqa: E402 — loads .env automatically
from database import engine, get_db, Base
from models import Document, User, Organization
from auth import get_current_user, create_access_token, verify_password, get_password_hash
from ocr_service import process_document, process_document_with_layout
from extraction_service import extract_document_data
from search_service import parse_search_query
from assistant_service import get_assistant_response
from security import (
    SecurityHeadersMiddleware,
    validate_file_magic,
    sanitize_filename,
    validate_password_strength,
    validate_name,
)

# ── Setup ────────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

UPLOAD_DIR = config.UPLOAD_DIR
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = config.ALLOWED_EXTENSIONS
MAX_FILE_SIZE = config.MAX_FILE_SIZE

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Arkivo — AI Document Management System",
    version="2.0.0",
    docs_url=None if os.environ.get("PRODUCTION") else "/docs",  # Hide docs in production
    redoc_url=None if os.environ.get("PRODUCTION") else "/redoc",
)

# ── Security Middleware ──────────────────────────────────────────────────────
app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# ── Rate Limiting ────────────────────────────────────────────────────────────
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded

    limiter = Limiter(key_func=get_remote_address)
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    RATE_LIMITING_ENABLED = True
    logger.info("Rate limiting enabled.")
except ImportError:
    # slowapi not installed — rate limiting disabled gracefully
    RATE_LIMITING_ENABLED = False
    logger.warning("slowapi not installed — rate limiting disabled. Install with: pip install slowapi")

    # Create a no-op decorator so @limiter.limit() doesn't crash
    class _NoOpLimiter:
        def limit(self, *args, **kwargs):
            def decorator(func):
                return func
            return decorator
    limiter = _NoOpLimiter()

# ── Static Files ─────────────────────────────────────────────────────────────
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend")
if os.path.isdir(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.get("/", include_in_schema=False)
async def root():
    return RedirectResponse(url="/static/index.html")



class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    action: str = Field(..., pattern="^(create|join)$")  # Strict validation
    org_name: str = Field(None, min_length=2, max_length=200)
    invite_code: str = Field(None, max_length=50)

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)

def generate_invite_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

@app.post("/api/auth/register")
@limiter.limit(config.RATE_LIMIT_AUTH)
def register(request: Request, payload: RegisterRequest, db: Session = Depends(get_db)):
    # Validate password strength
    pw_valid, pw_error = validate_password_strength(payload.password)
    if not pw_valid:
        raise HTTPException(status_code=400, detail=pw_error)

    # Validate name
    name_valid, name_error = validate_name(payload.name)
    if not name_valid:
        raise HTTPException(status_code=400, detail=name_error)

    user = db.query(User).filter(User.email == payload.email).first()
    if user:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    if payload.action == 'create':
        if not payload.org_name:
            raise HTTPException(status_code=400, detail="Organization name is required")
        org_valid, org_error = validate_name(payload.org_name)
        if not org_valid:
            raise HTTPException(status_code=400, detail=org_error)
        org = Organization(name=payload.org_name.strip(), invite_code=generate_invite_code())
        db.add(org)
        db.commit()
        db.refresh(org)
        role = "admin"
    elif payload.action == 'join':
        if not payload.invite_code:
            raise HTTPException(status_code=400, detail="Invite code is required")
        org = db.query(Organization).filter(Organization.invite_code == payload.invite_code).first()
        if not org:
            raise HTTPException(status_code=404, detail="Invalid invite code")
        role = "member"
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

    new_user = User(
        name=payload.name.strip(),
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        role=role,
        organization_id=org.id
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {"message": "User created successfully"}

@app.post("/api/auth/login")
@limiter.limit(config.RATE_LIMIT_AUTH)
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
    # Generic error message to prevent user enumeration
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
        
    access_token = create_access_token(
        data={"sub": str(user.id), "org_id": user.organization_id, "role": user.role}
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/me")
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == current_user.organization_id).first()
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
        "organization": {"id": org.id, "name": org.name, "invite_code": org.invite_code}
    }


# ── Settings API ─────────────────────────────────────────────────────────────

class SettingsUpdate(BaseModel):
    api_key: str = Field(None, max_length=200)
    model: str = Field(None, max_length=100)

@app.get("/api/settings")
def get_settings(current_user: User = Depends(get_current_user)):
    """Return current server settings with masked API key."""
    from config import mask_api_key, get_env_value
    current_key = get_env_value("OPENROUTER_API_KEY", "")
    current_model = get_env_value("OPENROUTER_MODEL", "openai/gpt-4o-mini")
    return {
        "api_key_masked": mask_api_key(current_key),
        "api_key_set": bool(current_key),
        "model": current_model,
    }

@app.put("/api/settings")
def update_settings(payload: SettingsUpdate, current_user: User = Depends(get_current_user)):
    """Update server settings — writes to .env and updates live config."""
    from config import update_env_value, mask_api_key
    import config as cfg

    # Only admins can change server settings
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can change settings")

    updated = []

    if payload.api_key is not None:
        new_key = payload.api_key.strip()
        if new_key:
            update_env_value("OPENROUTER_API_KEY", new_key)
            # Update the live module-level variable so all services use the new key immediately
            cfg.OPENROUTER_API_KEY = new_key
            updated.append("api_key")
            logger.info("OPENROUTER_API_KEY updated by admin user %s", current_user.id)

    if payload.model is not None:
        new_model = payload.model.strip()
        if new_model:
            update_env_value("OPENROUTER_MODEL", new_model)
            cfg.OPENROUTER_MODEL = new_model
            updated.append("model")

    if not updated:
        raise HTTPException(status_code=400, detail="No valid settings provided")

    return {
        "message": "Settings updated successfully",
        "updated": updated,
        "api_key_masked": mask_api_key(cfg.OPENROUTER_API_KEY),
        "model": cfg.OPENROUTER_MODEL,
    }


@app.post("/api/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    lang: str = Query(default="latin", pattern="^[a-z]{2,10}$"),
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    # ── Security: Validate extension ─────────────────────────────────────
    safe_filename = sanitize_filename(file.filename)
    ext = safe_filename.rsplit(".", 1)[-1].lower() if "." in safe_filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '.{ext}' not allowed. Supported: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"File size exceeds {config.MAX_FILE_SIZE_MB} MB limit.")

    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded.")

    # ── Security: Validate file magic bytes ──────────────────────────────
    if not validate_file_magic(content, ext):
        raise HTTPException(
            status_code=400,
            detail="File content does not match declared file type. Upload rejected.",
        )

    # ── Security: Use UUID filename to prevent path traversal ────────────
    stored_filename = f"{uuid.uuid4().hex}.{ext}"
    file_path = os.path.join(UPLOAD_DIR, stored_filename)

    # Double-check resolved path stays within UPLOAD_DIR (prevents traversal)
    resolved = os.path.realpath(file_path)
    if not resolved.startswith(os.path.realpath(UPLOAD_DIR)):
        raise HTTPException(status_code=400, detail="Invalid file path.")

    with open(file_path, "wb") as f:
        f.write(content)

    doc = Document(
        filename=stored_filename,
        original_filename=safe_filename,
        file_type=ext,
        file_size=len(content),
        status="processing",
        organization_id=current_user.organization_id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    try:
        from fastapi.concurrency import run_in_threadpool
        layout_result = await run_in_threadpool(process_document_with_layout, file_path, ext, lang)
        
        doc.extracted_text = layout_result["text"]
        doc.page_count = layout_result["page_count"]
        doc.status = "completed"
        
        if ext == "pdf" and layout_result["page_count"] > 1:
            doc.file_type = "folder"
            doc.ocr_layout_data = "[]" 
            
            for page_data in layout_result.get("pages", []):
                child_doc = Document(
                    parent_id=doc.id,
                    filename=stored_filename,
                    original_filename=f"{safe_filename} - Page {page_data['page']}",
                    file_type="pdf",
                    file_size=len(content),
                    status="completed",
                    extracted_text=page_data["text"],
                    page_count=1,
                    ocr_layout_data=json.dumps([page_data], ensure_ascii=False),
                    organization_id=current_user.organization_id
                )
                db.add(child_doc)
        else:
            doc.ocr_layout_data = json.dumps(layout_result.get("pages", []), ensure_ascii=False)

        logger.info(f"OCR completed for document {doc.id} — {len(layout_result['text'])} chars")
    except Exception as e:
        doc.status = "failed"
        doc.error_message = str(e)[:500]  # Limit error message length
        logger.error(f"OCR failed for document {doc.id}: {type(e).__name__}")

    db.commit()
    db.refresh(doc)
    return doc.to_dict()


@app.get("/api/documents")
def list_documents(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    docs = db.query(Document).filter(Document.parent_id == None, Document.organization_id == current_user.organization_id).order_by(Document.created_at.desc()).all()
    result = []
    for doc in docs:
        d = doc.to_dict()
        if d["extracted_text"] and len(d["extracted_text"]) > 200:
            d["extracted_text_preview"] = d["extracted_text"][:200] + "..."
        else:
            d["extracted_text_preview"] = d["extracted_text"]
        del d["extracted_text"]
        result.append(d)
    return result

class SearchQuery(BaseModel):
    query: str = None
    filters: dict = None

@app.post("/api/documents/search")
def search_documents(payload: SearchQuery, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if payload.query:
        filters = parse_search_query(payload.query)
    else:
        filters = payload.filters or {}
        
    docs = db.query(Document).filter(Document.file_type != "folder", Document.organization_id == current_user.organization_id).order_by(Document.created_at.desc()).all()
    
    result = []
    for doc in docs:
        try:
            meta = json.loads(doc.extracted_metadata or "{}")
        except (json.JSONDecodeError, TypeError):
            meta = {}
            
        match = True
        
        if filters.get("document_type"):
            dtype = filters["document_type"].lower()
            if (doc.doc_type or "").lower() != dtype:
                match = False
                
        if match and filters.get("company"):
            company_val = meta.get("company", {}).get("value", "") if isinstance(meta.get("company"), dict) else meta.get("company", "")
            if filters["company"].lower() not in (company_val or "").lower():
                match = False
                
        if match and filters.get("client_name"):
            client_val = meta.get("client_name", {}).get("value", "") if isinstance(meta.get("client_name"), dict) else meta.get("client_name", "")
            if filters["client_name"].lower() not in (client_val or "").lower():
                match = False

        if match and filters.get("invoice_number"):
            inv_val = meta.get("invoice_number", {}).get("value", "") if isinstance(meta.get("invoice_number"), dict) else meta.get("invoice_number", "")
            if filters["invoice_number"].lower() not in (inv_val or "").lower():
                match = False
                
        if match and filters.get("date_range"):
            dr = filters["date_range"]
            if dr:
                d_from = dr.get("from")
                d_to = dr.get("to")
                
                if d_from or d_to:
                    date_val = meta.get("date", {}).get("value", "") if isinstance(meta.get("date"), dict) else meta.get("date", "")
                    if not date_val:
                        match = False
                    else:
                        parsed_date = None
                        try:
                            # Handle DD/MM/YYYY or MM/DD/YYYY to YYYY-MM
                            parts = str(date_val).replace('-', '/').replace('.', '/').split('/')
                            if len(parts) >= 2:
                                if len(parts[-1]) == 4:
                                    dt = datetime(int(parts[-1]), int(parts[-2]), int(parts[0]) if len(parts)==3 else 1)
                                elif len(parts[0]) == 4:
                                    dt = datetime(int(parts[0]), int(parts[1]), int(parts[2]) if len(parts)==3 else 1)
                                else:
                                    dt = datetime.now()
                                parsed_date = dt.strftime("%Y-%m")
                        except Exception:
                            pass
                        
                        if parsed_date:
                            if d_from and parsed_date < d_from:
                                match = False
                            if d_to and parsed_date > d_to:
                                match = False
                        else:
                            match = False

        if match and filters.get("keyword"):
            kw = filters["keyword"].lower()
            if kw not in doc.original_filename.lower() and kw not in (doc.extracted_text or "").lower():
                match = False

        if match:
            d = doc.to_dict()
            if d.get("extracted_text") and len(d["extracted_text"]) > 200:
                d["extracted_text_preview"] = d["extracted_text"][:200] + "..."
            else:
                d["extracted_text_preview"] = d["extracted_text"] or ""
            if "extracted_text" in d:
                del d["extracted_text"]
            result.append(d)
            
    return {"filters": filters, "results": result}


class AssistantPayload(BaseModel):
    query: str
    language: str = "English"

@app.post("/api/ai/chat")
@limiter.limit(config.RATE_LIMIT_AI)
def assistant_chat(request: Request, payload: AssistantPayload, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Conversational AI Assistant endpoint.
    SECURITY: Passes organization_id to enforce tenant isolation.
    """
    try:
        response = get_assistant_response(
            payload.query, db, payload.language,
            organization_id=current_user.organization_id
        )
        return response
    except Exception as e:
        logger.error(f"Assistant Chat Error: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="An error occurred processing your AI request.")


@app.post("/api/ai/assistant")
def ai_assistant(payload: SearchQuery, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Agentic assistant endpoint that returns a conversational message + filtered results.
    """
    if not payload.query:
        raise HTTPException(status_code=400, detail="Query is required for assistant.")
        
    try:
        response = get_conversational_response(payload.query, db)
        return response
    except Exception as e:
        logger.error(f"AI Assistant failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/documents/{doc_id}/children")
def list_document_children(doc_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    docs = db.query(Document).filter(Document.parent_id == doc_id, Document.organization_id == current_user.organization_id).order_by(Document.id.asc()).all()
    result = []
    for doc in docs:
        d = doc.to_dict()
        if d["extracted_text"] and len(d["extracted_text"]) > 200:
            d["extracted_text_preview"] = d["extracted_text"][:200] + "..."
        else:
            d["extracted_text_preview"] = d["extracted_text"]
        del d["extracted_text"]
        result.append(d)
    return result


@app.get("/api/documents/{doc_id}")
def get_document(doc_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    doc = db.query(Document).filter(Document.id == doc_id, Document.organization_id == current_user.organization_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc.to_dict()


@app.get("/api/documents/{doc_id}/download")
def download_document(doc_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    doc = db.query(Document).filter(Document.id == doc_id, Document.organization_id == current_user.organization_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = os.path.join(UPLOAD_DIR, doc.filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    dl_filename = doc.original_filename
    if doc.file_type and not dl_filename.lower().endswith(f".{doc.file_type.lower()}"):
        dl_filename += f".{doc.file_type}"

    mime_types = {
        "pdf": "application/pdf",
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg"
    }
    media_type = mime_types.get(doc.file_type, "application/octet-stream")

    if doc.parent_id is not None and doc.file_type == "pdf":
        try:
            layout = json.loads(doc.ocr_layout_data or "[]")
            if layout and isinstance(layout, list) and "page" in layout[0]:
                page_num = int(layout[0]["page"])
                
                import io
                from pypdf import PdfReader, PdfWriter
                
                reader = PdfReader(file_path)
                writer = PdfWriter()
                
                if 0 <= page_num - 1 < len(reader.pages):
                    writer.add_page(reader.pages[page_num - 1])
                    
                    buf = io.BytesIO()
                    writer.write(buf)
                    buf.seek(0)
                    
                    return Response(
                        content=buf.read(),
                        media_type="application/pdf",
                        headers={
                            "Content-Disposition": f'attachment; filename="{dl_filename}"'
                        }
                    )
        except Exception as e:
            logger.error(f"Failed to extract single PDF page for download Doc ID {doc_id}: {e}")

    return FileResponse(
        path=file_path,
        filename=dl_filename,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{dl_filename}"'
        },
    )


@app.get("/api/documents/{doc_id}/preview")
def preview_document(doc_id: int, page: int = 1, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    doc = db.query(Document).filter(Document.id == doc_id, Document.organization_id == current_user.organization_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = os.path.join(UPLOAD_DIR, doc.filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    if doc.file_type in ("jpg", "jpeg", "png"):
        media_types = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png"}
        return FileResponse(path=file_path, media_type=media_types.get(doc.file_type, "application/octet-stream"))

    if doc.file_type in ("pdf", "folder"):
        import io
        from pdf2image import convert_from_path

        if doc.parent_id is not None:
            try:
                layout = json.loads(doc.ocr_layout_data or "[]")
                if layout:
                    page = layout[0].get("page", page)
            except (json.JSONDecodeError, TypeError):
                pass
                
        if doc.file_type == "folder":
            page = 1

        poppler_path = os.environ.get("POPPLER_PATH", None)
        kwargs = {}
        if poppler_path:
            kwargs["poppler_path"] = poppler_path
        else:
            local_poppler = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "poppler", "poppler-24.07.0", "Library", "bin")
            if os.path.isdir(local_poppler):
                kwargs["poppler_path"] = local_poppler

        try:
            images = convert_from_path(file_path, dpi=150, first_page=page, last_page=page, **kwargs)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to render PDF page: {e}")

        if not images:
            raise HTTPException(status_code=404, detail="Page not found")

        buf = io.BytesIO()
        images[0].save(buf, format="PNG")
        buf.seek(0)
        return Response(content=buf.read(), media_type="image/png")

    raise HTTPException(status_code=400, detail="Unsupported file type for preview")


@app.delete("/api/documents/all")
def delete_all_documents(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Delete ALL documents and their files from disk."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete documents")
    try:
        root_docs = db.query(Document).filter(Document.parent_id == None, Document.organization_id == current_user.organization_id).all()
        deleted_files = 0
        for doc in root_docs:
            # Delete child records
            db.query(Document).filter(Document.parent_id == doc.id).delete()
            # Delete file from disk
            file_path = os.path.join(UPLOAD_DIR, doc.filename)
            if os.path.exists(file_path):
                os.remove(file_path)
                deleted_files += 1
            db.delete(doc)
        db.commit()
        return {"message": f"Deleted {len(root_docs)} documents ({deleted_files} files removed)"}
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete all documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/documents/{doc_id}")
def delete_document(doc_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete documents")
    doc = db.query(Document).filter(Document.id == doc_id, Document.organization_id == current_user.organization_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc.file_type == "folder":
        db.query(Document).filter(Document.parent_id == doc_id, Document.organization_id == current_user.organization_id).delete()

    if doc.parent_id is None:
        file_path = os.path.join(UPLOAD_DIR, doc.filename)
        if os.path.exists(file_path):
            os.remove(file_path)

    db.delete(doc)
    db.commit()

    return {"message": "Document deleted successfully", "id": doc_id}


@app.get("/api/documents/{doc_id}/layout")
def get_document_layout(
    doc_id: int,
    page: int = Query(default=1, ge=1),
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == doc_id, Document.organization_id == current_user.organization_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        pages = json.loads(doc.ocr_layout_data or "[]")
    except (json.JSONDecodeError, TypeError):
        pages = []

    if not pages:
        raise HTTPException(status_code=404, detail="No layout data available. Re-upload to generate.")

    if page > len(pages):
        raise HTTPException(status_code=404, detail=f"Page {page} not found. Document has {len(pages)} pages.")

    page_data = pages[page - 1]
    return {
        "doc_id": doc_id,
        "page": page,
        "total_pages": len(pages),
        "image_width": page_data.get("image_width", 0),
        "image_height": page_data.get("image_height", 0),
        "blocks": page_data.get("blocks", []),
    }


class TextUpdate(BaseModel):
    extracted_text: str

@app.put("/api/documents/{doc_id}/text")
def update_document_text(doc_id: int, payload: TextUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    doc = db.query(Document).filter(Document.id == doc_id, Document.organization_id == current_user.organization_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    doc.extracted_text = payload.extracted_text
    db.commit()
    return {"message": "Text updated successfully"}

class LayoutBlockUpdate(BaseModel):
    text: str
    x: float
    y: float
    width: float
    height: float
    confidence: float = 1.0

class LayoutUpdate(BaseModel):
    page: int
    blocks: List[LayoutBlockUpdate]

@app.put("/api/documents/{doc_id}/layout")
def update_document_layout(doc_id: int, payload: LayoutUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    doc = db.query(Document).filter(Document.id == doc_id, Document.organization_id == current_user.organization_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    try:
        pages = json.loads(doc.ocr_layout_data or "[]")
    except Exception:
        pages = []
        
    while len(pages) < payload.page:
        pages.append({"page": len(pages) + 1, "blocks": []})
        
    pages[payload.page - 1]["blocks"] = [b.dict() for b in payload.blocks]
    
    doc.ocr_layout_data = json.dumps(pages, ensure_ascii=False)
    db.commit()
    return {"message": "Layout updated successfully"}


@app.post("/api/documents/{doc_id}/extract")
def extract_document(doc_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    doc = db.query(Document).filter(Document.id == doc_id, Document.organization_id == current_user.organization_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not doc.extracted_text or doc.status != "completed":
        raise HTTPException(
            status_code=400,
            detail="Document has no extracted text. Ensure OCR completed successfully.",
        )

    layout_blocks = None
    try:
        pages = json.loads(doc.ocr_layout_data or "[]")
        if pages:
            layout_blocks = []
            for page in pages:
                layout_blocks.extend(page.get("blocks", []))
    except (json.JSONDecodeError, TypeError):
        pass

    try:
        result = extract_document_data(doc.extracted_text, layout_blocks)
    except Exception as e:
        logger.error(f"Extraction failed for doc {doc_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Extraction failed: {e}")

    doc.doc_type = result.get("type", "other")
    doc.extracted_metadata = json.dumps(result, ensure_ascii=False)
    db.commit()
    db.refresh(doc)

    return {"doc_id": doc_id, **result}


@app.get("/api/documents/{doc_id}/extract")
def get_extraction(doc_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    doc = db.query(Document).filter(Document.id == doc_id, Document.organization_id == current_user.organization_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        meta = json.loads(doc.extracted_metadata or "{}")
    except (json.JSONDecodeError, TypeError):
        meta = {}

    return {"doc_id": doc_id, "doc_type": doc.doc_type or "unknown", **meta}


class ExtractUpdate(BaseModel):
    metadata: Dict[str, Any]

@app.put("/api/documents/{doc_id}/extract")
def update_extraction(doc_id: int, payload: ExtractUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    doc = db.query(Document).filter(Document.id == doc_id, Document.organization_id == current_user.organization_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    doc.extracted_metadata = json.dumps(payload.metadata, ensure_ascii=False)
    db.commit()
    return {"doc_id": doc_id, "doc_type": doc.doc_type or "unknown", **payload.metadata}


@app.get("/api/documents/{doc_id}/export")
def export_document(
    doc_id: int,
    format: str = Query(default="csv", regex="^(csv|excel|txt)$"),
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == doc_id, Document.organization_id == current_user.organization_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        meta = json.loads(doc.extracted_metadata or "{}")
    except (json.JSONDecodeError, TypeError):
        meta = {}

    def _extract_val(data, key):
        val = data.get(key)
        if isinstance(val, dict):
            return val.get("value") or ""
        return val or ""

    row = {
        "ID": doc.id,
        "Original Filename": doc.original_filename,
        "File Type": doc.file_type,
        "File Size (bytes)": doc.file_size,
        "Pages": doc.page_count,
        "Status": doc.status,
        "Created At": doc.created_at.isoformat() if doc.created_at else "",
        "Document Type": doc.doc_type or "unknown",
        "Invoice Number": _extract_val(meta, "invoice_number"),
        "Date": _extract_val(meta, "date"),
        "Due Date": _extract_val(meta, "due_date"),
        "Expiry Date": _extract_val(meta, "expiry_date"),
        "Total Amount": _extract_val(meta, "total_amount"),
        "Currency": _extract_val(meta, "currency"),
        "Company": _extract_val(meta, "company"),
        "Client Name": _extract_val(meta, "client_name"),
    }

    base_name = doc.original_filename.rsplit(".", 1)[0] if "." in doc.original_filename else doc.original_filename

    if format == "txt":
        output = io.StringIO()
        output.write("=== AI Extraction Metadata ===\n\n")
        for key, value in row.items():
            output.write(f"{key}: {value}\n")
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/plain",
            headers={"Content-Disposition": f'attachment; filename="{base_name}_metadata.txt"'},
        )

    if format == "csv":
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=list(row.keys()))
        writer.writeheader()
        writer.writerow(row)
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{base_name}_metadata.csv"'},
        )

    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Metadata"
    ws.append(list(row.keys()))
    ws.append(list(row.values()))

    for column in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in column)
        ws.column_dimensions[column[0].column_letter].width = min(max_len + 4, 50)

    excel_buf = io.BytesIO()
    wb.save(excel_buf)
    excel_buf.seek(0)
    return StreamingResponse(
        iter([excel_buf.read()]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{base_name}_metadata.xlsx"'},
    )


@app.get("/api/export/all")
def export_all_documents(
    format: str = Query(default="csv", regex="^(csv|excel|txt)$"),
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    docs = db.query(Document).filter(Document.file_type != "folder", Document.organization_id == current_user.organization_id).order_by(Document.created_at.desc()).all()

    headers = [
        "ID", "Original Filename", "File Type", "File Size (bytes)",
        "Pages", "Status", "Created At",
        "Document Type", "Invoice Number", "Date", "Due Date", "Expiry Date", 
        "Total Amount", "Currency", "Company", "Client Name",
    ]

    rows = []
    for doc in docs:
        try:
            meta = json.loads(doc.extracted_metadata or "{}")
        except (json.JSONDecodeError, TypeError):
            meta = {}
        rows.append({
            "ID": doc.id,
            "Original Filename": doc.original_filename,
            "File Type": doc.file_type,
            "File Size (bytes)": doc.file_size,
            "Pages": doc.page_count,
            "Status": doc.status,
            "Created At": doc.created_at.isoformat() if doc.created_at else "",
            "Document Type": doc.doc_type or "unknown",
            "Invoice Number": meta.get("invoice_number", {}).get("value") if isinstance(meta.get("invoice_number"), dict) else meta.get("invoice_number", ""),
            "Date": meta.get("date", {}).get("value") if isinstance(meta.get("date"), dict) else meta.get("date", ""),
            "Due Date": meta.get("due_date", {}).get("value") if isinstance(meta.get("due_date"), dict) else meta.get("due_date", ""),
            "Expiry Date": meta.get("expiry_date", {}).get("value") if isinstance(meta.get("expiry_date"), dict) else meta.get("expiry_date", ""),
            "Total Amount": meta.get("total_amount", {}).get("value") if isinstance(meta.get("total_amount"), dict) else meta.get("total_amount", ""),
            "Currency": meta.get("currency", {}).get("value") if isinstance(meta.get("currency"), dict) else meta.get("currency", ""),
            "Company": meta.get("company", {}).get("value") if isinstance(meta.get("company"), dict) else meta.get("company", ""),
            "Client Name": meta.get("client_name", {}).get("value") if isinstance(meta.get("client_name"), dict) else meta.get("client_name", ""),
        })

    if format == "txt":
        output = io.StringIO()
        output.write("=== All Documents Extraction Metadata ===\n\n")
        for i, row in enumerate(rows):
            output.write(f"--- Document {i+1} ---\n")
            for key, value in row.items():
                output.write(f"{key}: {value}\n")
            output.write("\n")
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/plain",
            headers={"Content-Disposition": 'attachment; filename="all_documents.txt"'},
        )

    if format == "csv":
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="all_documents.csv"'},
        )

    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment
    wb = Workbook()
    ws = wb.active
    ws.title = "Documents"

    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill(start_color="4F46E5", end_color="4F46E5", fill_type="solid")
        cell.alignment = Alignment(horizontal="center")

    for row in rows:
        ws.append([row[h] for h in headers])

    for column in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in column)
        ws.column_dimensions[column[0].column_letter].width = min(max_len + 4, 50)

    excel_buf = io.BytesIO()
    wb.save(excel_buf)
    excel_buf.seek(0)
    return StreamingResponse(
        iter([excel_buf.read()]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="all_documents.xlsx"'},
    )


@app.post("/api/export/custom")
async def export_custom_documents(
    payload: SearchQuery,
    format: str = Query(default="excel", regex="^(csv|excel|txt)$"),
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    filters = payload.filters or {}
    docs = db.query(Document).filter(Document.file_type != "folder", Document.organization_id == current_user.organization_id).order_by(Document.created_at.desc()).all()
    
    matched_docs = []
    for doc in docs:
        try:
            meta = json.loads(doc.extracted_metadata or "{}")
        except (json.JSONDecodeError, TypeError):
            meta = {}
            
        match = True
        
        if filters.get("document_type"):
            dtype = filters["document_type"].lower()
            if (doc.doc_type or "").lower() != dtype:
                match = False
                
        if match and filters.get("company"):
            company_val = meta.get("company", {}).get("value", "") if isinstance(meta.get("company"), dict) else meta.get("company", "")
            if filters["company"].lower() not in (company_val or "").lower():
                match = False
                
        if match and filters.get("client_name"):
            client_val = meta.get("client_name", {}).get("value", "") if isinstance(meta.get("client_name"), dict) else meta.get("client_name", "")
            if filters["client_name"].lower() not in (client_val or "").lower():
                match = False

        if match and filters.get("invoice_number"):
            inv_val = meta.get("invoice_number", {}).get("value", "") if isinstance(meta.get("invoice_number"), dict) else meta.get("invoice_number", "")
            if filters["invoice_number"].lower() not in (inv_val or "").lower():
                match = False
                
        if match and filters.get("date_range"):
            dr = filters["date_range"]
            if dr:
                d_from = dr.get("from")
                d_to = dr.get("to")
                
                if d_from or d_to:
                    date_val = meta.get("date", {}).get("value", "") if isinstance(meta.get("date"), dict) else meta.get("date", "")
                    if not date_val:
                        match = False
                    else:
                        parsed_date = None
                        try:
                            # Handle DD/MM/YYYY or MM/DD/YYYY to YYYY-MM
                            parts = str(date_val).replace('-', '/').replace('.', '/').split('/')
                            if len(parts) >= 2:
                                if len(parts[-1]) == 4:
                                    dt = datetime(int(parts[-1]), int(parts[-2]), int(parts[0]) if len(parts)==3 else 1)
                                elif len(parts[0]) == 4:
                                    dt = datetime(int(parts[0]), int(parts[1]), int(parts[2]) if len(parts)==3 else 1)
                                else:
                                    dt = datetime.now()
                                parsed_date = dt.strftime("%Y-%m")
                        except Exception:
                            pass
                        
                        if parsed_date:
                            if d_from and parsed_date < d_from:
                                match = False
                            if d_to and parsed_date > d_to:
                                match = False
                        else:
                            match = False

        if match and filters.get("keyword"):
            kw = filters["keyword"].lower()
            if kw not in doc.original_filename.lower() and kw not in (doc.extracted_text or "").lower():
                match = False

        if match:
            matched_docs.append(doc)

    # Export logic (reused from export_all)
    headers = [
        "ID", "Original Filename", "File Type", "File Size (bytes)",
        "Pages", "Status", "Created At",
        "Document Type", "Invoice Number", "Date", "Due Date",
        "Total Amount", "Currency", "Company", "Client Name",
    ]
    
    rows = []
    for doc in matched_docs:
        try:
            meta = json.loads(doc.extracted_metadata or "{}")
        except (json.JSONDecodeError, TypeError):
            meta = {}
            
        def _get(m, k):
            v = m.get(k)
            return v.get("value") if isinstance(v, dict) else v or ""

        rows.append({
            "ID": doc.id,
            "Original Filename": doc.original_filename,
            "File Type": doc.file_type,
            "File Size (bytes)": doc.file_size,
            "Pages": doc.page_count,
            "Status": doc.status,
            "Created At": doc.created_at.isoformat() if doc.created_at else "",
            "Document Type": doc.doc_type or "unknown",
            "Invoice Number": _get(meta, "invoice_number"),
            "Date": _get(meta, "date"),
            "Due Date": _get(meta, "due_date"),
            "Total Amount": _get(meta, "total_amount"),
            "Currency": _get(meta, "currency"),
            "Company": _get(meta, "company"),
            "Client Name": _get(meta, "client_name"),
        })

    if format == "csv":
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="filtered_export.csv"'}
        )
    
    if format == "txt":
        output = io.StringIO()
        for r in rows:
            output.write(f"ID: {r['ID']} | File: {r['Original Filename']} | Type: {r['Document Type']}\n")
            output.write("-" * 40 + "\n")
            for k, v in r.items():
                output.write(f"{k}: {v}\n")
            output.write("\n")
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/plain",
            headers={"Content-Disposition": 'attachment; filename="filtered_export.txt"'}
        )

    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.append(headers)
    for r in rows:
        ws.append([r[h] for h in headers])
    
    excel_buf = io.BytesIO()
    wb.save(excel_buf)
    excel_buf.seek(0)
    return StreamingResponse(
        iter([excel_buf.read()]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="filtered_export.xlsx"'}
    )

@app.get("/api/export/folder/{folder_id}")
def export_folder_documents(
    folder_id: int,
    format: str = Query(default="csv", regex="^(csv|excel|txt)$"),
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    # SECURITY FIX: Added tenant isolation filter
    docs = db.query(Document).filter(
        Document.parent_id == folder_id,
        Document.organization_id == current_user.organization_id
    ).order_by(Document.id.asc()).all()

    headers = [
        "ID", "Original Filename", "File Type", "File Size (bytes)",
        "Pages", "Status", "Created At",
        "Document Type", "Invoice Number", "Date", "Due Date", "Expiry Date", 
        "Total Amount", "Currency", "Company", "Client Name",
    ]

    rows = []
    for doc in docs:
        try:
            meta = json.loads(doc.extracted_metadata or "{}")
        except (json.JSONDecodeError, TypeError):
            meta = {}
        rows.append({
            "ID": doc.id,
            "Original Filename": doc.original_filename,
            "File Type": doc.file_type,
            "File Size (bytes)": doc.file_size,
            "Pages": doc.page_count,
            "Status": doc.status,
            "Created At": doc.created_at.isoformat() if doc.created_at else "",
            "Document Type": doc.doc_type or "unknown",
            "Invoice Number": meta.get("invoice_number", {}).get("value") if isinstance(meta.get("invoice_number"), dict) else meta.get("invoice_number", ""),
            "Date": meta.get("date", {}).get("value") if isinstance(meta.get("date"), dict) else meta.get("date", ""),
            "Due Date": meta.get("due_date", {}).get("value") if isinstance(meta.get("due_date"), dict) else meta.get("due_date", ""),
            "Expiry Date": meta.get("expiry_date", {}).get("value") if isinstance(meta.get("expiry_date"), dict) else meta.get("expiry_date", ""),
            "Total Amount": meta.get("total_amount", {}).get("value") if isinstance(meta.get("total_amount"), dict) else meta.get("total_amount", ""),
            "Currency": meta.get("currency", {}).get("value") if isinstance(meta.get("currency"), dict) else meta.get("currency", ""),
            "Company": meta.get("company", {}).get("value") if isinstance(meta.get("company"), dict) else meta.get("company", ""),
            "Client Name": meta.get("client_name", {}).get("value") if isinstance(meta.get("client_name"), dict) else meta.get("client_name", ""),
        })

    if format == "txt":
        output = io.StringIO()
        output.write(f"=== Folder {folder_id} Documents Extraction Metadata ===\n\n")
        for i, row in enumerate(rows):
            output.write(f"--- Document {i+1} ---\n")
            for key, value in row.items():
                output.write(f"{key}: {value}\n")
            output.write("\n")
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/plain",
            headers={"Content-Disposition": f'attachment; filename="folder_{folder_id}_documents.txt"'},
        )

    if format == "csv":
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="folder_{folder_id}_documents.csv"'},
        )

    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment
    wb = Workbook()
    ws = wb.active
    ws.title = "Documents"

    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill(start_color="4F46E5", end_color="4F46E5", fill_type="solid")
        cell.alignment = Alignment(horizontal="center")

    for row in rows:
        ws.append([row[h] for h in headers])

    for column in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in column)
        ws.column_dimensions[column[0].column_letter].width = min(max_len + 4, 50)

    excel_buf = io.BytesIO()
    wb.save(excel_buf)
    excel_buf.seek(0)
    return StreamingResponse(
        iter([excel_buf.read()]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="folder_{folder_id}_documents.xlsx"'},
    )

class ExportQuery(BaseModel):
    filters: dict = None
    document_ids: List[int] = None
    format: str = "csv"

@app.post("/api/export/ids")
def export_documents_by_ids(
    payload: ExportQuery,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    if not payload.document_ids:
        raise HTTPException(status_code=400, detail="document_ids list is required")
        
    # SECURITY FIX: Added tenant isolation filter
    docs = db.query(Document).filter(
        Document.id.in_(payload.document_ids),
        Document.organization_id == current_user.organization_id
    ).all()
    
    headers = [
        "ID", "Original Filename", "File Type", "File Size (bytes)",
        "Pages", "Status", "Created At",
        "Document Type", "Invoice Number", "Date", "Due Date", "Expiry Date", 
        "Total Amount", "Currency", "Company", "Client Name",
    ]

    rows = []
    for doc in docs:
        try:
            meta = json.loads(doc.extracted_metadata or "{}")
        except (json.JSONDecodeError, TypeError):
            meta = {}
            
        def _get_v(k):
            v = meta.get(k, "")
            return v.get("value") if isinstance(v, dict) else v

        rows.append({
            "ID": doc.id,
            "Original Filename": doc.original_filename,
            "File Type": doc.file_type,
            "File Size (bytes)": doc.file_size,
            "Pages": doc.page_count,
            "Status": doc.status,
            "Created At": doc.created_at.isoformat() if doc.created_at else "",
            "Document Type": doc.doc_type or "unknown",
            "Invoice Number": _get_v("invoice_number"),
            "Date": _get_v("date"),
            "Due Date": _get_v("due_date"),
            "Expiry Date": _get_v("expiry_date"),
            "Total Amount": _get_v("total_amount"),
            "Currency": _get_v("currency"),
            "Company": _get_v("company"),
            "Client Name": _get_v("client_name"),
        })

    filename_prefix = "ai_results"
    
    if payload.format == "txt":
        output = io.StringIO()
        output.write("=== AI Assistant Results Export ===\n\n")
        for i, row in enumerate(rows):
            output.write(f"--- Document {i+1} ---\n")
            for key, value in row.items():
                output.write(f"{key}: {value}\n")
            output.write("\n")
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/plain",
            headers={"Content-Disposition": f'attachment; filename="{filename_prefix}.txt"'},
        )

    if payload.format == "csv":
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename_prefix}.csv"'},
        )

    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment
    wb = Workbook()
    ws = wb.active
    ws.title = "Results"
    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill(start_color="4F46E5", end_color="4F46E5", fill_type="solid")
    
    for row in rows:
        ws.append([row[h] for h in headers])
        
    for column in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in column)
        ws.column_dimensions[column[0].column_letter].width = min(max_len + 5, 50)

    excel_buf = io.BytesIO()
    wb.save(excel_buf)
    excel_buf.seek(0)
    return StreamingResponse(
        iter([excel_buf.read()]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename_prefix}.xlsx"'},
    )

@app.post("/api/export/custom")
def export_custom_documents(
    payload: ExportQuery,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    # SECURITY FIX: Pass current_user for tenant isolation
    sq = SearchQuery(filters=payload.filters)
    search_res = search_documents(sq, db, current_user=current_user)
    matching_docs = search_res["results"]
    
    headers = [
        "ID", "Original Filename", "File Type", "File Size (bytes)",
        "Pages", "Status", "Created At",
        "Document Type", "Invoice Number", "Date", "Due Date", "Expiry Date", 
        "Total Amount", "Currency", "Company", "Client Name",
    ]

    rows = []
    for d in matching_docs:
        meta = d.get("extracted_metadata", {})
        rows.append({
            "ID": d["id"],
            "Original Filename": d["original_filename"],
            "File Type": d["file_type"],
            "File Size (bytes)": d["file_size"],
            "Pages": d["page_count"],
            "Status": d["status"],
            "Created At": d["created_at"],
            "Document Type": d["doc_type"],
            "Invoice Number": meta.get("invoice_number", {}).get("value") if isinstance(meta.get("invoice_number"), dict) else meta.get("invoice_number", ""),
            "Date": meta.get("date", {}).get("value") if isinstance(meta.get("date"), dict) else meta.get("date", ""),
            "Due Date": meta.get("due_date", {}).get("value") if isinstance(meta.get("due_date"), dict) else meta.get("due_date", ""),
            "Expiry Date": meta.get("expiry_date", {}).get("value") if isinstance(meta.get("expiry_date"), dict) else meta.get("expiry_date", ""),
            "Total Amount": meta.get("total_amount", {}).get("value") if isinstance(meta.get("total_amount"), dict) else meta.get("total_amount", ""),
            "Currency": meta.get("currency", {}).get("value") if isinstance(meta.get("currency"), dict) else meta.get("currency", ""),
            "Company": meta.get("company", {}).get("value") if isinstance(meta.get("company"), dict) else meta.get("company", ""),
            "Client Name": meta.get("client_name", {}).get("value") if isinstance(meta.get("client_name"), dict) else meta.get("client_name", ""),
        })

    if payload.format == "txt":
        output = io.StringIO()
        output.write("=== Custom Export Metadata ===\n\n")
        output.write(f"Filters Applied: {payload.filters}\n\n")
        for i, row in enumerate(rows):
            output.write(f"--- Document {i+1} ---\n")
            for key, value in row.items():
                output.write(f"{key}: {value}\n")
            output.write("\n")
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/plain",
            headers={"Content-Disposition": 'attachment; filename="custom_export.txt"'},
        )

    if payload.format == "csv":
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="custom_export.csv"'},
        )

    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment
    wb = Workbook()
    ws = wb.active
    ws.title = "Documents"

    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill(start_color="4F46E5", end_color="4F46E5", fill_type="solid")
        cell.alignment = Alignment(horizontal="center")

    for row in rows:
        ws.append([row[h] for h in headers])

    for column in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in column)
        ws.column_dimensions[column[0].column_letter].width = min(max_len + 4, 50)

    excel_buf = io.BytesIO()
    wb.save(excel_buf)
    excel_buf.seek(0)
    return StreamingResponse(
        iter([excel_buf.read()]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="custom_export.xlsx"'},
    )