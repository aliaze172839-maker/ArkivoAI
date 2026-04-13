import os
import io
import logging
import numpy as np
from typing import Optional

logger = logging.getLogger(__name__)

# ── OCR Engine: PaddleOCR (primary) ──────────────────────────────────────────
_paddle_ocr = None

def _get_paddle(lang: str = "latin"):
    global _paddle_ocr
    if _paddle_ocr is None:
        try:
            from paddleocr import PaddleOCR
            _paddle_ocr = PaddleOCR(use_angle_cls=True, lang=lang, show_log=False)
            logger.info(f"PaddleOCR loaded (lang={lang})")
        except Exception as e:
            logger.warning(f"PaddleOCR unavailable: {e}")
            _paddle_ocr = False
    return _paddle_ocr if _paddle_ocr is not False else None


# ── PDF → PIL Image using PyMuPDF (no poppler needed) ────────────────────────
def _pdf_page_to_pil(filepath: str, page_num: int, dpi: int = 150):
    """
    Renders a single PDF page to a PIL Image using fitz (pymupdf).
    page_num is 0-indexed.
    """
    import fitz  # pymupdf
    from PIL import Image

    doc = fitz.open(filepath)
    if page_num >= len(doc):
        raise ValueError(f"Page {page_num} out of range (doc has {len(doc)} pages)")

    mat = fitz.Matrix(dpi / 72, dpi / 72)
    pix = doc[page_num].get_pixmap(matrix=mat, alpha=False)
    img_bytes = pix.tobytes("png")
    doc.close()

    return Image.open(io.BytesIO(img_bytes))


def _get_pdf_page_count(filepath: str) -> int:
    import fitz
    doc = fitz.open(filepath)
    count = len(doc)
    doc.close()
    return count


# ── Core OCR on a PIL image ───────────────────────────────────────────────────
def _ocr_pil_image(pil_img, lang: str = "latin"):
    """
    Run OCR on a PIL Image.
    Returns list of blocks: [{text, x, y, width, height, confidence}]
    """
    img_np = np.array(pil_img.convert("RGB"))
    img_w, img_h = pil_img.size
    blocks = []

    # Try PaddleOCR first
    paddle = _get_paddle(lang)
    if paddle:
        try:
            result = paddle.ocr(img_np, cls=True)
            if result and result[0]:
                for line in result[0]:
                    if not line:
                        continue
                    box, (text, conf) = line
                    xs = [p[0] for p in box]
                    ys = [p[1] for p in box]
                    x, y = min(xs), min(ys)
                    w, h = max(xs) - x, max(ys) - y
                    blocks.append({
                        "text": text,
                        "x": round(float(x), 2),
                        "y": round(float(y), 2),
                        "width": round(float(w), 2),
                        "height": round(float(h), 2),
                        "confidence": round(float(conf), 4),
                    })
            return blocks, img_w, img_h
        except Exception as e:
            logger.warning(f"PaddleOCR failed, falling back to EasyOCR: {e}")

    # Fallback: EasyOCR
    try:
        import easyocr
        lang_map = {
            "latin": ["en"],
            "ar": ["ar", "en"],
            "ch": ["ch_sim", "en"],
            "fr": ["fr", "en"],
            "de": ["de", "en"],
        }
        easyocr_langs = lang_map.get(lang, ["en"])
        reader = easyocr.Reader(easyocr_langs, gpu=False)
        result = reader.readtext(img_np)
        for (box, text, conf) in result:
            xs = [p[0] for p in box]
            ys = [p[1] for p in box]
            x, y = min(xs), min(ys)
            w, h = max(xs) - x, max(ys) - y
            blocks.append({
                "text": text,
                "x": round(float(x), 2),
                "y": round(float(y), 2),
                "width": round(float(w), 2),
                "height": round(float(h), 2),
                "confidence": round(float(conf), 4),
            })
        return blocks, img_w, img_h
    except Exception as e:
        logger.error(f"EasyOCR also failed: {e}")

    return [], img_w, img_h


# ── Public API ────────────────────────────────────────────────────────────────

def process_document(filepath: str, filetype: str, lang: str = "latin") -> str:
    """
    Simple OCR — returns plain extracted text (no layout data).
    Used by older callers; internally calls process_document_with_layout.
    """
    result = process_document_with_layout(filepath, filetype, lang)
    return result.get("text", "")


def process_document_with_layout(filepath: str, filetype: str, lang: str = "latin") -> dict:
    """
    Full OCR with layout information.

    Returns:
    {
        "text": str,            # full concatenated text
        "page_count": int,
        "pages": [
            {
                "page": int,        # 1-indexed
                "text": str,
                "image_width": int,
                "image_height": int,
                "blocks": [
                    {
                        "text": str,
                        "x": float, "y": float,
                        "width": float, "height": float,
                        "confidence": float
                    }
                ]
            }
        ]
    }
    """
    ext = filetype.lower().lstrip(".")
    pages_data = []

    # ── PDF ───────────────────────────────────────────────────────────────────
    if ext == "pdf":
        try:
            page_count = _get_pdf_page_count(filepath)
        except Exception as e:
            logger.error(f"Cannot open PDF {filepath}: {e}")
            return {"text": "", "page_count": 0, "pages": []}

        for page_idx in range(page_count):
            try:
                pil_img = _pdf_page_to_pil(filepath, page_idx, dpi=150)
                blocks, img_w, img_h = _ocr_pil_image(pil_img, lang)
                page_text = "\n".join(b["text"] for b in blocks)
                pages_data.append({
                    "page": page_idx + 1,
                    "text": page_text,
                    "image_width": img_w,
                    "image_height": img_h,
                    "blocks": blocks,
                })
            except Exception as e:
                logger.error(f"OCR failed on page {page_idx + 1} of {filepath}: {e}")
                pages_data.append({
                    "page": page_idx + 1,
                    "text": "",
                    "image_width": 0,
                    "image_height": 0,
                    "blocks": [],
                })

    # ── Image (JPG / PNG / JPEG) ───────────────────────────────────────────────
    elif ext in ("jpg", "jpeg", "png"):
        try:
            from PIL import Image
            pil_img = Image.open(filepath)
            blocks, img_w, img_h = _ocr_pil_image(pil_img, lang)
            page_text = "\n".join(b["text"] for b in blocks)
            pages_data.append({
                "page": 1,
                "text": page_text,
                "image_width": img_w,
                "image_height": img_h,
                "blocks": blocks,
            })
        except Exception as e:
            logger.error(f"OCR failed on image {filepath}: {e}")
            pages_data.append({
                "page": 1,
                "text": "",
                "image_width": 0,
                "image_height": 0,
                "blocks": [],
            })
    else:
        logger.warning(f"Unsupported filetype for OCR: {ext}")
        return {"text": "", "page_count": 0, "pages": []}

    full_text = "\n\n".join(p["text"] for p in pages_data if p["text"])
    return {
        "text": full_text,
        "page_count": len(pages_data),
        "pages": pages_data,
    }
