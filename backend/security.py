"""
security.py — Security middleware and utilities for the Arkivo platform.
════════════════════════════════════════════════════════════════════════
Adds security headers, file validation, and input sanitization.
"""

import os
import re
import unicodedata
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware


# ── Security Headers Middleware ──────────────────────────────────────────────

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds security headers to every response."""

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        # Content-Security-Policy would go here for production:
        # response.headers["Content-Security-Policy"] = "default-src 'self'; ..."
        return response


# ── File Validation ──────────────────────────────────────────────────────────

# Magic byte signatures for allowed file types
FILE_SIGNATURES = {
    "pdf":  [b"%PDF"],
    "jpg":  [b"\xff\xd8\xff"],
    "jpeg": [b"\xff\xd8\xff"],
    "png":  [b"\x89PNG\r\n\x1a\n"],
}


def validate_file_magic(content: bytes, claimed_extension: str) -> bool:
    """
    Validate that the file content matches expected magic bytes for the claimed extension.
    This prevents attackers from uploading malicious files with renamed extensions.
    """
    signatures = FILE_SIGNATURES.get(claimed_extension.lower(), [])
    if not signatures:
        return False
    return any(content[:len(sig)] == sig for sig in signatures)


def sanitize_filename(filename: str) -> str:
    """
    Sanitize an uploaded filename to prevent path traversal and encoding attacks.
    Returns only the base filename with safe characters.
    """
    # Normalize unicode to prevent homoglyph attacks
    filename = unicodedata.normalize("NFKD", filename)
    # Strip any directory components (prevents path traversal)
    filename = os.path.basename(filename)
    # Remove null bytes
    filename = filename.replace("\x00", "")
    # Remove any non-printable characters
    filename = "".join(c for c in filename if c.isprintable())
    # Replace dangerous characters
    filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
    # Limit length
    if len(filename) > 200:
        name, ext = os.path.splitext(filename)
        filename = name[:200 - len(ext)] + ext
    # Ensure filename is not empty
    if not filename or filename.startswith('.'):
        filename = "unnamed_document" + (os.path.splitext(filename)[1] if '.' in filename else '')
    return filename


# ── Input Validation ─────────────────────────────────────────────────────────

def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    Validate password meets minimum security requirements.
    Returns (is_valid, error_message).
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not re.search(r'[A-Za-z]', password):
        return False, "Password must contain at least one letter."
    if not re.search(r'[0-9]', password):
        return False, "Password must contain at least one number."
    return True, ""


def validate_name(name: str) -> tuple[bool, str]:
    """Validate user/organization name."""
    name = name.strip()
    if len(name) < 2:
        return False, "Name must be at least 2 characters long."
    if len(name) > 200:
        return False, "Name must be 200 characters or less."
    return True, ""
