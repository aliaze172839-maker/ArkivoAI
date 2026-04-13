"""
OCR Service — Multi-language text extraction with bounding box layout data.
═══════════════════════════════════════════════════════════════════════════════
Uses PaddleOCR (latin model) for English, Albanian, and Serbian.

Returns two data formats:
  1. Plain text (backward compatible)
  2. Structured layout: text + bounding boxes per page
"""

import os
import platform
import json
import logging
from typing import Optional

from paddleocr import PaddleOCR
from pdf2image import convert_from_path
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

# ══════════════════════════════════════════════════════════════════════════════
#  PaddleOCR Engines (loaded once, reused)
# ══════════════════════════════════════════════════════════════════════════════
# 'latin' covers: English, Albanian, Serbian (Latin script), and most European
# use_angle_cls=True → detects rotated text

_engines = {}

def _get_engine(lang: str = "latin"):
    """Get or create a PaddleOCR engine for the given language."""
    if lang not in _engines:
        logger.info(f"Loading PaddleOCR engine for lang='{lang}'")
        _engines[lang] = PaddleOCR(use_angle_cls=True, lang=lang, show_log=False)
    return _engines[lang]

# Pre-load the default engine
_get_engine("latin")

# ── Poppler (PDF→image) ─────────────────────────────────────────────────────
# Windows: use POPPLER_PATH env or local Windows path
# Linux/Railway: poppler-utils installs binaries in /usr/bin
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
    """
    Convert PaddleOCR 4-corner polygon to {x, y, width, height}.
    box = [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]
    """
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
    """
    Parse PaddleOCR result into sorted blocks with bounding boxes.

    Returns: list of dicts:
        [{ text, x, y, width, height, confidence }, ...]
    Sorted in reading order (top-to-bottom, then left-to-right).
    """
    if not result or not result[0]:
        return []

    blocks = []
    for line_info in result[0]:
        box = line_info[0]
        text = line_info[1][0]
        confidence = line_info[1][1]

        if confidence < 0.3:
            continue

        rect = _polygon_to_rect(box)
        blocks.append({
            "text": text,
            "confidence": round(confidence, 3),
            **rect,
        })

    if blocks:
        blocks = _reading_order_sort(blocks)

    return blocks


def _reading_order_sort(blocks, row_threshold=15):
    """
    Sort blocks into reading order:
    1. Group blocks into rows (blocks with similar Y positions)
    2. Sort rows top-to-bottom
    3. Within each row, sort left-to-right
    """
    if not blocks:
        return blocks

    sorted_by_y = sorted(blocks, key=lambda b: b["y"])

    rows = []
    current_row = [sorted_by_y[0]]
    current_y = sorted_by_y[0]["y"]

    for block in sorted_by_y[1:]:
        if abs(block["y"] - current_y) < row_threshold:
            current_row.append(block)
        else:
            rows.append(current_row)
            current_row = [block]
            current_y = block["y"]
    rows.append(current_row)

    result = []
    for row in rows:
        row.sort(key=lambda b: b["x"])
        result.extend(row)

    return result


# ══════════════════════════════════════════════════════════════════════════════
#  Core Extraction Functions — with Layout
# ══════════════════════════════════════════════════════════════════════════════

def extract_layout_from_image(image_path: str, lang: str = "latin") -> dict:
    """
    Run OCR on an image file, return text + bounding boxes.
    """
    try:
        engine = _get_engine(lang)

        with Image.open(image_path) as img:
            img_w, img_h = img.size

        result = engine.ocr(image_path, cls=True)
        blocks = _parse_ocr_result(result)

        text_lines = [b["text"] for b in blocks if b["confidence"] > 0.5]
        full_text = "\n".join(text_lines)

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
    """
    Run OCR on a PIL Image (used for PDF pages).
    """
    try:
        engine = _get_engine(lang)
        img_w, img_h = pil_image.size
        img_array = np.array(pil_image)

        result = engine.ocr(img_array, cls=True)
        blocks = _parse_ocr_result(result)

        text_lines = [b["text"] for b in blocks if b["confidence"] > 0.5]
        full_text = "\n".join(text_lines)

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
    """
    Convert PDF to images, OCR each page with layout data.
    """
    try:
        kwargs = {}
        if POPPLER_PATH:
            kwargs["poppler_path"] = POPPLER_PATH

        images = convert_from_path(pdf_path, dpi=300, **kwargs)
        page_count = len(images)

        all_text_parts = []
        pages = []

        for i, page_img in enumerate(images, 1):
            page_data = extract_layout_from_pil(page_img, lang=lang)
            page_text = page_data["text"]

            all_text_parts.append(f"--- Page {i} ---\n{page_text}")

            pages.append({
                "page": i,
                "text": page_text,
                "blocks": page_data["blocks"],
                "image_width": page_data["image_width"],
                "image_height": page_data["image_height"],
            })

        return {
            "text": "\n\n".join(all_text_parts),
            "page_count": page_count,
            "pages": pages,
        }

    except Exception as e:
        logger.error(f"OCR failed for PDF {pdf_path}: {e}")
        raise


# ══════════════════════════════════════════════════════════════════════════════
#  Public Entry Points
# ══════════════════════════════════════════════════════════════════════════════

def process_document(file_path: str, file_type: str, lang: str = "latin") -> tuple[str, int]:
    """
    Backward-compatible entry point.
    Returns: (extracted_text, page_count)
    """
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
    """
    Full entry point — returns text + layout data.
    """
    file_type = file_type.lower()

    if file_type in ("jpg", "jpeg", "png", "bmp", "tiff"):
        data = extract_layout_from_image(file_path, lang=lang)
        return {
            "text": data["text"],
            "page_count": 1,
            "pages": [{
                "page": 1,
                "text": data["text"],
                "blocks": data["blocks"],
                "image_width": data["image_width"],
                "image_height": data["image_height"],
            }],
        }

    elif file_type == "pdf":
        return extract_layout_from_pdf(file_path, lang=lang)

    else:
        raise ValueError(f"Unsupported file type: {file_type}")
