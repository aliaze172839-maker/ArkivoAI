"""
config.py — Centralized, secure configuration for the Arkivo platform.
═══════════════════════════════════════════════════════════════════════
All secrets and tunables are loaded from environment variables.
A .env file is supported for local development via python-dotenv.
"""

import os
import secrets
from pathlib import Path

ENV_FILE_PATH = Path(__file__).parent / ".env"

# ── Load .env file if present (dev only) ─────────────────────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv(ENV_FILE_PATH)
except ImportError:
    pass  # python-dotenv is optional in production

# ── JWT / Auth ───────────────────────────────────────────────────────────────
JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "")
if not JWT_SECRET_KEY or JWT_SECRET_KEY == "CHANGE_ME_TO_A_RANDOM_64_CHAR_STRING":
    # Auto-generate a secure random key for development (printed once)
    JWT_SECRET_KEY = secrets.token_urlsafe(48)
    print(
        "⚠️  WARNING: JWT_SECRET_KEY is not set. A random key was generated for "
        "this session. Set JWT_SECRET_KEY in your .env file or environment for "
        "persistent sessions across restarts."
    )

JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "1440"))  # 24 hours

# ── OpenRouter AI ────────────────────────────────────────────────────────────
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
if not OPENROUTER_API_KEY:
    print("⚠️  WARNING: OPENROUTER_API_KEY is not set. AI features will not work.")

OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "openai/gpt-4o-mini")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# ── CORS ─────────────────────────────────────────────────────────────────────
_origins_env = os.environ.get("ALLOWED_ORIGINS", "")
if _origins_env:
    ALLOWED_ORIGINS = [o.strip() for o in _origins_env.split(",") if o.strip()]
else:
    # Permissive defaults for local dev only
    ALLOWED_ORIGINS = ["http://localhost:8008", "http://127.0.0.1:8008"]

# ── File Uploads ─────────────────────────────────────────────────────────────
MAX_FILE_SIZE_MB = int(os.environ.get("MAX_FILE_SIZE_MB", "20"))
MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024
ALLOWED_EXTENSIONS = {"pdf", "jpg", "jpeg", "png"}
UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    os.environ.get("UPLOAD_DIR", "uploads"),
)

# ── Database ─────────────────────────────────────────────────────────────────
DB_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    f"sqlite:///{os.path.join(DB_DIR, 'documents.db')}",
)

# ── Rate Limiting ────────────────────────────────────────────────────────────
RATE_LIMIT_AUTH = os.environ.get("RATE_LIMIT_AUTH", "5/minute")
RATE_LIMIT_API = os.environ.get("RATE_LIMIT_API", "60/minute")
RATE_LIMIT_AI = os.environ.get("RATE_LIMIT_AI", "20/minute")


# ══════════════════════════════════════════════════════════════════════════════
# Runtime helpers — update .env and live config values
# ══════════════════════════════════════════════════════════════════════════════

def _read_env_lines() -> list[str]:
    """Read .env file lines, return empty list if not exists."""
    if ENV_FILE_PATH.exists():
        return ENV_FILE_PATH.read_text(encoding="utf-8").splitlines()
    return []


def _write_env_lines(lines: list[str]):
    """Write lines back to .env file."""
    ENV_FILE_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def update_env_value(key: str, value: str):
    """
    Update a single key=value pair in the .env file.
    If the key exists, replace its value. If not, append it.
    Also updates os.environ so the change takes effect immediately.
    """
    lines = _read_env_lines()
    found = False
    new_lines = []
    for line in lines:
        stripped = line.strip()
        # Match KEY= or KEY = (with optional whitespace)
        if stripped.startswith(f"{key}=") or stripped.startswith(f"{key} ="):
            new_lines.append(f"{key}={value}")
            found = True
        else:
            new_lines.append(line)
    if not found:
        new_lines.append(f"{key}={value}")
    _write_env_lines(new_lines)
    os.environ[key] = value


def get_env_value(key: str, default: str = "") -> str:
    """Read a value from the .env file (not just os.environ)."""
    lines = _read_env_lines()
    for line in lines:
        stripped = line.strip()
        if stripped.startswith(f"{key}="):
            return stripped.split("=", 1)[1].strip()
    return default


def mask_api_key(key: str) -> str:
    """Mask an API key for safe display: show first 10 and last 4 chars."""
    if not key or len(key) < 16:
        return "•" * len(key) if key else ""
    return key[:10] + "•" * (len(key) - 14) + key[-4:]
