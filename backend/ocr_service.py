"""
OCR Service — Multi-language text extraction with bounding box layout data.
═══════════════════════════════════════════════════════════════════════════════
Uses PaddleOCR (latin model) for English, Albanian, and Serbian.
"""

import os
import gc
import platform
import logging

from paddleocr import PaddleOCR
from pdf2image import convert_from_path, pdfinfo_from_path
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

# ══════════════════════════════════════════════════════════════════════════════
#  PaddleOCR Engine (loaded once, reused)
# ══════════════════════════════════════════════════════════════════════════════
_ocr = None

def get_ocr():
    global _ocr
    if _ocr is None:
        _ocr = PaddleOCR(use_angle_cls=False, use_gpu=False, lang='latin', show_log=False)
    return _ocr
_engines = {}

def _get_engine(lang: str = "latin"):
    if lang not in _engines:
        logger.info(f"Loading PaddleOCR engine for lang='{lang}'")
        _engines[lang] = PaddleOCR(use_angle_cls=True, lang=lang, show_log=False)
    return _engines[lang]

_get_engine("latin")

# ── Poppler Path ─────────────────────────────────────────────────────────────
if platform.system() == "Windows":
    POPPLER_PATH = os.environ.get(
        "POPPLER_PATH",
        r"E:\fiverocr\poppler\poppler-24.07.0\Library\bin"
    )
else:
    POPPLER_PATH = os.environ.get("POPPLER_PATH", "/usr/bin")


# ══════════════════════════════════════════════════════════════════════════════
#  Bounding Box Helpers
# ══════════════════════════════════════════════════════════════════════════════

def _polygon_to_rect(box):
    xs = [pt[0] for pt in box]
    ys = [pt[1] for pt in box]
    x = min(xs)
    y = min(ys)
    return {
        "x": round(x, 1),
        "y": round(y, 1),
        "width": round(max(xs) - x, 1),
        "height": round(max(ys) - y, 1),
    }


def _parse_ocr_result(result):
    if not result or not result[0]:
        return []

    blocks = []
    for line_info in result[0]:
        box        = line_info[0]
        text       = line_info[1][0]
        confidence = line_info[1][1]

        if confidence < 0.3:
            continue

        rect = _polygon_to_rect(box)
        blocks.append({"text": text, "confidence": round(confidence, 3), **rect})

    if blocks:
        blocks = _reading_order_sort(blocks)

    return blocks


def _reading_order_sort(blocks, row_threshold=15):
    if not blocks:
        return blocks

    sorted_by_y = sorted(blocks, key=lambda b: b["y"])
    rows = []
    current_row = [sorted_by_y[0]]
    current_y   = sorted_by_y[0]["y"]

    for block in sorted_by_y[1:]:
        if abs(block["y"] - current_y) < row_threshold:
            current_row.append(block)
        else:
            rows.append(current_row)
            current_row = [block]
            current_y   = block["y"]
    rows.append(current_row)

    result = []
    for row in rows:
        row.sort(key=lambda b: b["x"])
        result.extend(row)

    return result


# ══════════════════════════════════════════════════════════════════════════════
#  Core Extraction — with Memory Optimization
# ══════════════════════════════════════════════════════════════════════════════

def extract_layout_from_image(image_path: str, lang: str = "latin") -> dict:
    try:
        engine = _get_engine(lang)

        with Image.open(image_path) as img:
            img_w, img_h = img.size

        result = engine.ocr(image_path, cls=True)
        blocks = _parse_ocr_result(result)

        text_lines = [b["text"] for b in blocks if b["confidence"] > 0.5]
        full_text  = "\n".join(text_lines)

        # ✅ تحرير الذاكرة
        del result
        gc.collect()

        return {
            "text": full_text,
            "blocks": blocks,
            "image_width": img_w,
            "image_height": img_h,
        }

    except Exception as e:
        logger.error(f"OCR failed for image {image_path}: {e}")
        raise


def extract_layout_from_pil(pil_image: Image.Image, lang: str = "latin") -> dict:
    try:
        engine    = _get_engine(lang)
        img_w, img_h = pil_image.size
        img_array = np.array(pil_image)

        result = engine.ocr(img_array, cls=True)
        blocks = _parse_ocr_result(result)

        text_lines = [b["text"] for b in blocks if b["confidence"] > 0.5]
        full_text  = "\n".join(text_lines)

        # ✅ تحرير الذاكرة بعد كل صفحة
        del img_array, result
        gc.collect()

        return {
            "text": full_text,
            "blocks": blocks,
            "image_width": img_w,
            "image_height": img_h,
        }

    except Exception as e:
        logger.error(f"OCR failed for PIL image: {e}")
        raise


def extract_layout_from_pdf(pdf_path: str, lang: str = "latin") -> dict:
    try:
        kwargs = {}
        if POPPLER_PATH:
            kwargs["poppler_path"] = POPPLER_PATH

        # ✅ احسب عدد الصفحات أولاً بدون تحميل كل شيء
        info       = pdfinfo_from_path(pdf_path, **kwargs)
        page_count = info["Pages"]

        all_text_parts = []
        pages          = []

        for i in range(1, page_count + 1):
            # ✅ حوّل صفحة واحدة فقط في كل مرة (بدل كل الصفحات دفعة واحدة)
            # ✅ dpi=200 بدل 300 — يوفر ~50% ذاكرة مع دقة OCR كافية
            images   = convert_from_path(
                pdf_path, dpi=200,
                first_page=i, last_page=i,
                **kwargs
            )
            page_img  = images[0]
            page_data = extract_layout_from_pil(page_img, lang=lang)
            page_text = page_data["text"]

            all_text_parts.append(f"--- Page {i} ---\n{page_text}")
            pages.append({
                "page":         i,
                "text":         page_text,
                "blocks":       page_data["blocks"],
                "image_width":  page_data["image_width"],
                "image_height": page_data["image_height"],
            })

            # ✅ تحرير الذاكرة بعد كل صفحة فور الانتهاء منها
            del images, page_img, page_data
            gc.collect()

        return {
            "text":       "\n\n".join(all_text_parts),
            "page_count": page_count,
            "pages":      pages,
        }

    except Exception as e:
        logger.error(f"OCR failed for PDF {pdf_path}: {e}")
        raise


# ══════════════════════════════════════════════════════════════════════════════
#  Public Entry Points
# ══════════════════════════════════════════════════════════════════════════════

def process_document(file_path: str, file_type: str, lang: str = "latin") -> tuple[str, int]:
    """Backward-compatible — Returns: (text, page_count)"""
    file_type = file_type.lower()

    if file_type in ("jpg", "jpeg", "png", "bmp", "tiff"):
        data = extract_layout_from_image(file_path, lang=lang)
        return data["text"], 1

    elif file_type == "pdf":
        data = extract_layout_from_pdf(file_path, lang=lang)
        return data["text"], data["page_count"]

    else:
        raise ValueError(f"Unsupported file type: {file_type}")


def process_document_with_layout(file_path: str, file_type: str, lang: str = "latin") -> dict:
    """Full entry point — returns text + layout data."""
    file_type = file_type.lower()

    if file_type in ("jpg", "jpeg", "png", "bmp", "tiff"):
        data = extract_layout_from_image(file_path, lang=lang)
        return {
            "text":       data["text"],
            "page_count": 1,
            "pages": [{
                "page":         1,
                "text":         data["text"],
                "blocks":       data["blocks"],
                "image_width":  data["image_width"],
                "image_height": data["image_height"],
            }],
        }

    elif file_type == "pdf":
        return extract_layout_from_pdf(file_path, lang=lang)

    else:
        raise ValueError(f"Unsupported file type: {file_type}")
