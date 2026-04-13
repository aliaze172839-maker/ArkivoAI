"""
extraction_service.py
─────────────────────
OpenRouter LLM-Based Extraction Service.
Arkivo AI SaaS Platform.
All secrets loaded from config module.
"""

import json
import logging
import requests

from backend.config import OPENROUTER_API_KEY, OPENROUTER_MODEL, OPENROUTER_URL

logger = logging.getLogger(__name__)


def make_empty_metadata():
    return {
        "type": "other",
        "document_type": {"value": "other", "confidence": 100},
        "company": {"value": None, "confidence": 0},
        "date": {"value": None, "confidence": 0},
        "invoice_number": {"value": None, "confidence": 0},
        "total_amount": {"value": None, "confidence": 0},
        "currency": {"value": None, "confidence": 0},
        "due_date": {"value": None, "confidence": 0},
        "expiry_date": {"value": None, "confidence": 0},
        "client_name": {"value": None, "confidence": 0},
    }

def clean_json_response(text: str) -> str:
    """Removes markdown fences from the LLM response if present to ensure json.loads succeeds."""
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()

def extract_document_data(text: str, layout_blocks: list[dict] = None) -> dict:
    """
    Sends the document text to OpenRouter to parse using the configured model.
    Completely replaces Rule-Based logic for universal accuracy.
    """
    if not text or not text.strip():
        return make_empty_metadata()

    if not OPENROUTER_API_KEY:
        logger.warning("OPENROUTER_API_KEY not set — skipping AI extraction.")
        return make_empty_metadata()

    # Create a specialized financial & data extraction extraction prompt
    prompt = f"""You are a professional Data Extraction AI Engine for an invoicing SaaS. 
Your only job is to analyze the OCR text of a document (Invoice, Contract, Report, etc.) and accurately extract the following 9 fields.
The text might be in English, Albanian/Kosovar (e.g., Fatura, Nëntotali, Vlera), Serbian, Arabic, etc. Use your multi-language reasoning.

Fields to extract:
1. document_type (must be one of: invoice, contract, report, other)
2. company (the vendor/company issuing the document. Look for LLC, SHPK, Inc, often at the top)
3. date (the issue date of the document)
4. invoice_number (the ID/number of the invoice. Exclude words like 'Data'. Look for Nr, Br, #, Inv)
5. total_amount (the FINAL true total to be paid. Ignore Subtotals like 'Nëntotali' or 'Subtotal')
6. currency (e.g., EUR, USD, ALL, GBP, etc.)
7. due_date (when the payment is expected or expiry date. Format: YYYY-MM-DD)
8. expiry_date (if the document is a contract/report. Format: YYYY-MM-DD)
9. client_name (the person/company being billed. Often follows 'Bill To', 'Fatura Për', 'To:', 'Konsumatori')

CRITICAL INSTRUCTIONS:
- You must reply ONLY with a valid pure JSON format.
- Do not add any conversational text, greetings, code blocks, or markdown formatting (```). Just the {{ and }} directly.
- Each field must be a nested object with "value" (string or null) and "confidence" (number 0-100 indicating your certainty).
- For 'document_type', provide the same nested object.
- Make "type" a top-level string (same as document_type.value) for database sorting.
- DATE EXTRACTION RULES:
  - NEVER change or assume the year! You MUST extract the date literally as it appears in the text.
  - If the document says 2026, your output MUST be 2026. Do NOT default to 2024 or the current year.
  - Correctly handle the Albanian/European date format DD.MM.YYYY. Convert it accurately to YYYY-MM-DD (e.g., '02.02.2026' -> '2026-02-02').
  - Use ISO format (YYYY-MM-DD) for all date fields (date, due_date, expiry_date).


EXPECTED EXACT JSON STRUCTURE:
{{
  "type": "invoice",
  "document_type": {{"value": "invoice", "confidence": 99}},
  "company": {{"value": "XYZ LLC", "confidence": 95}},
  "date": {{"value": "2024-04-12", "confidence": 90}},
  "invoice_number": {{"value": "INV-123", "confidence": 90}},
  "total_amount": {{"value": "136200", "confidence": 95}},
  "currency": {{"value": "ALL", "confidence": 100}},
  "due_date": {{"value": "2024-05-12", "confidence": 90}},
  "expiry_date": {{"value": null, "confidence": 0}},
  "client_name": {{"value": "John Doe", "confidence": 85}}
}}

OCR Text to Process:
\"\"\"
{text[:6000]}
\"\"\"
"""

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "HTTP-Referer": "https://arkivo-agent.local",
        "X-Title": "Arkivo Engine",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1, # Extremely low temp for deterministic data extraction
    }

    try:
        logger.info(f"Sending document to OpenRouter model: {OPENROUTER_MODEL}")
        response = requests.post(
            OPENROUTER_URL,
            headers=headers,
            json=payload,
            timeout=20
        )
        
        if response.status_code == 200:
            try:
                result = response.json()
            except Exception as parse_err:
                logger.error(f"Failed to parse API response: {parse_err}")
                return make_empty_metadata()

            # Guard against unexpected response format (list, missing keys, etc.)
            if not isinstance(result, dict) or not result.get("choices"):
                logger.error(f"Unexpected API response: {str(result)[:200]}")
                return make_empty_metadata()

            raw_content = result["choices"][0].get("message", {}).get("content", "")
            if not raw_content:
                logger.error("Empty content in API response")
                return make_empty_metadata()
            cleaned_json = clean_json_response(raw_content)
            
            try:
                extracted = json.loads(cleaned_json)
                
                # Merge with base skeleton to prevent KeyError in frontend
                base = make_empty_metadata()
                for k in base.keys():
                    if k in extracted:
                        base[k] = extracted[k]
                        
                return base
            except json.JSONDecodeError:
                logger.error(f"OpenRouter did not return valid JSON. Raw output: {raw_content[:500]}")
                
        else:
            logger.error(f"OpenRouter API Error: status={response.status_code}")
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to connect to OpenRouter: {e}")

    # Ultimate fallback if everything fails
    return make_empty_metadata()