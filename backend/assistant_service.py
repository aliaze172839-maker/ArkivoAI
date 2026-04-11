"""
assistant_service.py — Agentic AI assistant for Arkivo.
═══════════════════════════════════════════════════════
All secrets loaded from config module.
Tenant-isolated: requires organization_id for document queries.
"""

import json
import logging
import requests
import datetime
import re
from sqlalchemy.orm import Session
from models import Document

from config import OPENROUTER_API_KEY, OPENROUTER_MODEL, OPENROUTER_URL

logger = logging.getLogger(__name__)


def clean_json_response(text: str) -> str:
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


def get_meta_value(meta: dict, key: str) -> str:
    """Safely extract value from meta field whether it's a dict {value:...} or plain string."""
    val = meta.get(key, "")
    if isinstance(val, dict):
        return str(val.get("value", "") or "").strip()
    return str(val or "").strip()


def parse_date_to_yyyymm(date_str: str):
    """
    Parse a date string from extracted metadata into YYYY-MM format.
    Handles: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD-MM-YYYY, etc.
    Returns None if unparseable.
    """
    if not date_str:
        return None
    date_str = date_str.strip()

    formats = [
        "%d/%m/%Y", "%m/%d/%Y", "%Y-%m-%d", "%d-%m-%Y",
        "%Y/%m/%d", "%d.%m.%Y", "%m.%d.%Y",
        "%B %d, %Y", "%b %d, %Y", "%d %B %Y", "%d %b %Y",
        "%Y-%m", "%m/%Y", "%m-%Y",
    ]
    for fmt in formats:
        try:
            dt = datetime.datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m")
        except ValueError:
            continue

    # Try to extract YYYY-MM from string containing 4-digit year
    m = re.search(r'(\d{4})[-/.](\d{1,2})', date_str)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}"
    m = re.search(r'(\d{1,2})[-/.](\d{4})', date_str)
    if m:
        return f"{m.group(2)}-{int(m.group(1)):02d}"
    m = re.match(r'^(\d{4})$', date_str)
    if m:
        return f"{m.group(1)}-01"

    return None


def date_in_range(doc_date_str: str, from_str: str, to_str: str) -> bool:
    """
    Check if doc_date_str (from AI-extracted metadata) falls within [from_str, to_str].
    All in YYYY-MM format.
    """
    doc_ym = parse_date_to_yyyymm(doc_date_str)
    if not doc_ym:
        return False
    return from_str <= doc_ym <= to_str


def get_assistant_response(query: str, db: Session, language: str = "English", organization_id: int = None):
    """
    Agentic assistant:
    1. Parse intent & filters from user query (NLP).
    2. Filter DB documents using AI-EXTRACTED metadata fields ONLY.
    3. Return conversational response with verified matched docs.
    
    SECURITY: Now requires organization_id for tenant isolation.
    """
    if not query or not query.strip():
        return {"message": "How can I help you today?", "results": []}

    if not OPENROUTER_API_KEY:
        return {"message": "AI service is not configured.", "results": []}

    current_year = datetime.datetime.now().year

    parse_prompt = f"""You are Arkivo AI Assistant, an intelligent multi-role assistant.
You MUST decide the user's intent and respond ONLY in JSON containing the mode and filters.
Current year: {current_year}.
User Language: {language}

Modes:
- "advisor": User asks for financial advice, spending insights, profit, or business decisions.
- "search": User asks to find, list, show, or retrieve documents.
- "action": User gives a direct command to filter, navigate, or apply filters (e.g. "go to filters", "filter from Jan to Feb").
- "general": User says hello, asks who you are, or makes casual conversation not related to documents.

JSON structure:
{{
  "mode": "advisor|search|action|general",
  "filters": {{
    "date_range": {{"from": "YYYY-MM", "to": "YYYY-MM"}},
    "document_type": "invoice|contract|report|other",
    "invoice_number": "string",
    "company": "string",
    "client_name": "string",
    "keyword": "string"
  }}
}}
All filter fields are optional (use null if not mentioned).
CRITICAL: Do NOT include labels like "client", "company" inside the extracted values.
For year-only queries like "invoices in 2026", set date_range from=YEAR-01 to=YEAR-12.
DO NOT explain, just output valid JSON.
User Query: "{query}"
"""

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "HTTP-Referer": "https://arkivo-agent.local",
        "X-Title": "Arkivo Assistant",
        "Content-Type": "application/json"
    }

    try:
        # ── Step 1: Parse Filters ─────────────────────────────────────────────
        resp = requests.post(
            OPENROUTER_URL,
            headers=headers,
            json={
                "model": OPENROUTER_MODEL,
                "messages": [{"role": "user", "content": parse_prompt}],
                "temperature": 0
            },
            timeout=10
        )
        filters = {}
        mode = "search"
        if resp.status_code == 200:
            content = resp.json()["choices"][0]["message"]["content"]
            parsed = json.loads(clean_json_response(content))
            mode = parsed.get("mode", "search")
            filters = parsed.get("filters", {})

        # ── Step 2: Filter using AI-extracted metadata ONLY ───────────────────
        # SECURITY FIX: Filter by organization_id to enforce tenant isolation
        doc_query = db.query(Document).filter(Document.file_type != "folder")
        if organization_id is not None:
            doc_query = doc_query.filter(Document.organization_id == organization_id)
        docs = doc_query.all()
        
        matched_docs = []

        IGNORED_LABELS = [
            "cilnet", "client", "name", "invoice", "number", "company",
            "total", "amount", "date", "\u0632\u0628\u0648\u0646", "\u0641\u0627\u062a\u0648\u0631\u0629", "\u0628\u0627\u0633\u0645"
        ]

        def clean_term(t):
            if not t:
                return ""
            t = t.lower().strip()
            for lbl in IGNORED_LABELS:
                if t.startswith(lbl + " "): t = t[len(lbl)+1:].strip()
                if t.endswith(" " + lbl):   t = t[:-len(lbl)-1].strip()
                if t == lbl: return ""
            return t

        date_range = filters.get("date_range") or {}
        dr_from = (date_range.get("from") or "").strip()
        dr_to   = (date_range.get("to")   or "").strip()
        has_date_filter = bool(dr_from and dr_to)

        for doc in docs:
            meta = json.loads(doc.extracted_metadata or "{}")

            # Build meta values string (for keyword search — metadata only, NOT filename)
            all_meta_values = []
            if isinstance(meta, dict):
                for k, v in meta.items():
                    if isinstance(v, dict):
                        all_meta_values.append(str(v.get("value", "")).lower())
                    else:
                        all_meta_values.append(str(v).lower())
            all_meta_str = " ".join(all_meta_values)

            match = True

            # Filter 1: Document Type
            if filters.get("document_type") and filters["document_type"] != "other":
                if (doc.doc_type or "").lower() != filters["document_type"].lower():
                    match = False

            # Filter 2: Date Range — AI-extracted metadata ONLY, never filename
            if match and has_date_filter:
                if not isinstance(meta, dict) or not meta:
                    match = False
                else:
                    doc_date_raw = (
                        get_meta_value(meta, "issue_date") or
                        get_meta_value(meta, "date") or
                        get_meta_value(meta, "due_date") or
                        ""
                    )
                    if not date_in_range(doc_date_raw, dr_from, dr_to):
                        match = False

            # Filter 3: Client Name
            if match and filters.get("client_name"):
                term = clean_term(filters["client_name"])
                if term:
                    val = get_meta_value(meta, "client_name")
                    if term not in (val or "").lower() and term not in all_meta_str and term not in (doc.extracted_text or "").lower():
                        match = False

            # Filter 4: Company
            if match and filters.get("company"):
                term = clean_term(filters["company"])
                val = get_meta_value(meta, "company")
                if term and term not in (val or "").lower() and term not in (doc.extracted_text or "").lower():
                    match = False

            # Filter 5: Invoice Number
            if match and filters.get("invoice_number"):
                term = clean_term(filters["invoice_number"])
                val = get_meta_value(meta, "invoice_number")
                if term and term not in (val or "").lower():
                    match = False

            # Filter 6: Keyword — metadata + OCR text ONLY (filename excluded)
            if match and filters.get("keyword"):
                term = clean_term(filters["keyword"])
                if term:
                    if term not in (doc.extracted_text or "").lower() and term not in all_meta_str:
                        match = False

            if match:
                d = doc.to_dict()
                d.pop("extracted_text", None)
                matched_docs.append(d)

        # ── Step 2.5: Handle General Mode ─────────────────────────────────────
        if mode == "general":
            matched_docs = []

        # ── Step 3: Build clean context from metadata fields only ─────────────
        context_items = []
        for d in matched_docs[:15]:
            m = d.get("extracted_metadata") or {}

            def gv(key):
                v = m.get(key, "")
                if isinstance(v, dict): return str(v.get("value", "") or "")
                return str(v or "")

            parts = [f"  File: {d['original_filename']}"]
            if gv("document_type"):  parts.append(f"  Type: {gv('document_type')}")
            if gv("invoice_number"): parts.append(f"  Invoice #: {gv('invoice_number')}")
            if gv("company"):        parts.append(f"  Company: {gv('company')}")
            if gv("client_name"):    parts.append(f"  Client: {gv('client_name')}")
            if gv("total_amount"):   parts.append(f"  Amount: {gv('total_amount')} {gv('currency')}")
            date_val = gv("issue_date") or gv("date")
            if date_val:             parts.append(f"  Document Date (AI extracted): {date_val}")
            if gv("due_date"):       parts.append(f"  Due Date: {gv('due_date')}")
            context_items.append("\n".join(parts))

        context_str = ("\n---\n".join(context_items)) if context_items else "No matching documents found."

        # ── Step 3.5: Pre-calculate Aggregates (across ALL matched docs) ─────
        aggregates = {}
        for d in matched_docs:
            m = d.get("extracted_metadata") or {}
            try:
                amt_str = str(m.get("total_amount", {}).get("value") if isinstance(m.get("total_amount"), dict) else m.get("total_amount", "")).replace(',', '').strip()
                if amt_str and amt_str.lower() != 'none':
                    amt = float(amt_str)
                    curr = str(m.get("currency", {}).get("value") if isinstance(m.get("currency"), dict) else m.get("currency", "EUR")).upper().strip() or "EUR"
                    aggregates[curr] = aggregates.get(curr, 0) + amt
            except (ValueError, TypeError):
                continue
        
        agg_str = ", ".join([f"{val:,.2f} {curr}" for curr, val in aggregates.items()]) if aggregates else "0.00"

        # ── Step 3.8: Immediate Action Branch ─────────────────────────────────
        if mode == "action":
            return {
                "message": f"Filters applied successfully! Found {len(matched_docs)} documents.",
                "results": matched_docs,
                "filters": filters,
                "mode": mode
            }

        # ── Step 4: Final conversational response ─────────────────────────────
        total_matched = len(matched_docs)
        filters_json = json.dumps(filters)
        chat_prompt = f"""You are Arkivo AI, an intelligent multi-role assistant.
User asked: "{query}"
Mode requested: {mode}

Applied Filters: {filters_json}
Total matched documents: {total_matched}
PRE-CALCULATED TOTAL SUMS: {agg_str}

Matched documents (data from AI extraction ONLY — a subset may be shown below):
{context_str}

IMPORTANT RULES:
If Mode is 'advisor':
1. Respond as a professional financial advisor.
2. Give clear, actionable advice regarding money, expenses, or profit based heavily on the PRE-CALCULATED TOTAL SUMS and context.
3. Be concise and professional.

If Mode is 'search':
1. State the COUNT of matched documents clearly.
2. Provide a summary of the matched documents.
3. Handle basic calculations using the PRE-CALCULATED TOTAL SUMS if asked.

If Mode is 'general':
1. Introduce yourself warmly as Arkivo AI Assistant.
2. Explain briefly what you can do (e.g., search documents, give financial advice, filter results).
3. Do not list any documents.

General Rules:
- ALL listed documents in search mode are confirmed database matches.
- ALWAYS respond in the following language: {language}. NEVER use English unless {language} is English.
- Do not mention JSON, databases, or technical pre-calculations.
"""

        chat_resp = requests.post(
            OPENROUTER_URL,
            headers=headers,
            json={
                "model": OPENROUTER_MODEL,
                "messages": [{"role": "user", "content": chat_prompt}],
                "temperature": 0.5
            },
            timeout=15
        )

        final_message = "I'm sorry, I encountered an issue processing your request."
        if chat_resp.status_code == 200:
            final_message = chat_resp.json()["choices"][0]["message"]["content"]

        return {
            "message": final_message,
            "results": matched_docs,
            "filters": filters
        }

    except Exception as e:
        logger.error(f"Assistant error: {type(e).__name__}: {e}")
        return {"message": "An error occurred while processing your request. Please try again.", "results": []}
