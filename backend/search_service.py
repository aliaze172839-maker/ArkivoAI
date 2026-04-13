"""
search_service.py — AI-powered natural language search parsing.
══════════════════════════════════════════════════════════════
All secrets loaded from config module.
"""

import json
import logging
import requests
import datetime

from backend.config import OPENROUTER_API_KEY, OPENROUTER_MODEL, OPENROUTER_URL
logger = logging.getLogger(__name__)


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

def parse_search_query(query: str) -> dict:
    """
    Parses a natural language search query into structured JSON filters using OpenRouter.
    """
    if not query or not query.strip():
        return {}

    if not OPENROUTER_API_KEY:
        logger.warning("OPENROUTER_API_KEY not set — falling back to keyword search.")
        return {"keyword": query}

    current_year = datetime.datetime.now().year
    
    prompt = f"""You are an intelligent search processor for a Document Management System.
Your job is to parse the user's natural language search query and convert it into a strict JSON filter object.

The current year is {current_year}. If the user mentions a month without a year, assume it is {current_year}.
For example, "january to march" means "from: {current_year}-01, to: {current_year}-03".

Extract the following parameters:
- date_range: an object with "from" and "to" keys in "YYYY-MM" format. If only a single month/year is mentioned, both "from" and "to" should be the same. 
- document_type: "invoice", "contract", "report", or "other". If plural, use singular.
- invoice_number: the identification number of the document (e.g., A246, INV-001).
- company: the name of the vendor/company issuing the document.
- client_name: the name of the person or entity being billed/addressed.
- keyword: any general search terms that don't fit the above fields.

CRITICAL INSTRUCTIONS:
- You must reply ONLY with a valid pure JSON format.
- Do not add any conversational text, greetings, code blocks, or markdown formatting (```).
- If a parameter is not mentioned, its value should be null.

EXPECTED EXACT JSON STRUCTURE:
{{
  "date_range": {{
    "from": "YYYY-MM",
    "to": "YYYY-MM"
  }},
  "document_type": "invoice",
  "invoice_number": "A246",
  "company": "Tech Corp",
  "client_name": "John Doe",
  "keyword": "urgent"
}}

User Query: "{query}"
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
        "temperature": 0.0,
    }

    try:
        logger.info(f"Sending search query to OpenRouter model: {OPENROUTER_MODEL}")
        response = requests.post(
            OPENROUTER_URL,
            headers=headers,
            json=payload,
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            raw_content = result["choices"][0]["message"]["content"]
            cleaned_json = clean_json_response(raw_content)
            
            try:
                filters = json.loads(cleaned_json)
                return filters
            except json.JSONDecodeError:
                logger.error(f"OpenRouter search parse did not return valid JSON.")
                
        else:
            logger.error(f"OpenRouter API Error: status={response.status_code}")
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to connect to OpenRouter for search parsing: {e}")

    # Fallback: treat the entire term as a keyword query if API fails
    return {"keyword": query}
