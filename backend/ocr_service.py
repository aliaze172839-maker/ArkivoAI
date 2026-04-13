"""
OCR Service — معالجة متتالية صفحة بصفحة لتوفير الذاكرة
"""
import os, gc, platform, logging
from paddleocr import PaddleOCR
from pdf2image import convert_from_path, pdfinfo_from_path
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

# ══ محرك OCR واحد فقط في الذاكرة طوال عمر السيرفر ══
_engine = None

def _get_engine():
    global _engine
    if _engine is None:
        logger.info("Loading PaddleOCR engine...")
        _engine = PaddleOCR(
            use_angle_cls=False,
            use_gpu=False,
            lang='latin',
            show_log=False,
            enable_mkldnn=False
        )
        logger.info("PaddleOCR engine ready.")
    return _engine

# تحميل مسبق عند بدء السيرفر
_get_engine()

# ── Poppler ──────────────────────────────────────────
if platform.system() == "Windows":
    POPPLER_PATH = os.environ.get("POPPLER_PATH", r"E:\\fiverocr\\poppler\\poppler-24.07.0\\Library\\bin")
else:
    POPPLER_PATH = os.environ.get("POPPLER_PATH", "/usr/bin")

# ══ Helpers ══════════════════════════════════════════

def _polygon_to_rect(box):
    xs = [pt[0] for pt in box]
    ys = [pt[1] for pt in box]
    x, y = min(xs), min(ys)
    return {"x": round(x,1), "y": round(y,1),
            "width": round(max(xs)-x,1), "height": round(max(ys)-y,1)}

def _parse_result(result):
    if not result or not result[0]:
        return []
    blocks = []
    for line in result[0]:
        text, conf = line[1][0], line[1][1]
        if conf < 0.3:
            continue
        blocks.append({"text": text, "confidence": round(conf,3), **_polygon_to_rect(line[0])})
    return _sort_blocks(blocks)

def _sort_blocks(blocks, row_threshold=15):
    if not blocks:
        return blocks
    sorted_y = sorted(blocks, key=lambda b: b["y"])
    rows, cur_row, cur_y = [], [sorted_y[0]], sorted_y[0]["y"]
    for b in sorted_y[1:]:
        if abs(b["y"] - cur_y) < row_threshold:
            cur_row.append(b)
        else:
            rows.append(cur_row)
            cur_row, cur_y = [b], b["y"]
    rows.append(cur_row)
    result = []
    for row in rows:
        result.extend(sorted(row, key=lambda b: b["x"]))
    return result

# ══ دالة OCR الأساسية — تعمل على PIL Image مباشرة ════

def _ocr_pil(pil_image: Image.Image) -> dict:
    """
    ✅ الدالة الوحيدة التي تُشغّل OCR — تعمل على صورة واحدة فقط
    سواء كانت JPG أصلية أو صفحة محوّلة من PDF
    """
    engine = _get_engine()
    img_w, img_h = pil_image.size
    img_array = np.array(pil_image)

    result = engine.ocr(img_array, cls=False)
    blocks = _parse_result(result)
    full_text = "\n".join(b["text"] for b in blocks if b["confidence"] > 0.5)

    del img_array, result
    gc.collect()

    return {
        "text": full_text,
        "blocks": blocks,
        "image_width": img_w,
        "image_height": img_h
    }

# ══ Entry Points العامة ═══════════════════════════════

def extract_layout_from_image(image_path: str, lang: str = "latin") -> dict:
    """صورة JPG/PNG — افتحها وشغّل OCR مباشرة"""
    with Image.open(image_path) as img:
        img_copy = img.copy()  # نسخ لأن Image.open lazy
    result = _ocr_pil(img_copy)
    img_copy.close()
    return result

def extract_layout_from_pdf(pdf_path: str, lang: str = "latin") -> dict:
    """
    ✅ PDF — حوّل كل صفحة إلى صورة ثم شغّل OCR عليها كصورة عادية
    الذاكرة ثابتة = صورة واحدة فقط في الوقت الواحد
    """
    kwargs = {}
    if POPPLER_PATH:
        kwargs["poppler_path"] = POPPLER_PATH

    info = pdfinfo_from_path(pdf_path, **kwargs)
    page_count = info["Pages"]

    all_text_parts, pages = [], []

    for i in range(1, page_count + 1):
        logger.info(f"OCR: PDF page {i}/{page_count}")

        # ✅ صفحة واحدة فقط → صورة → OCR → احذف من الذاكرة
        pil_pages = convert_from_path(
            pdf_path, dpi=200,
            first_page=i, last_page=i,
            **kwargs
        )
        pil_img = pil_pages[0]
        page_data = _ocr_pil(pil_img)   # ← نفس الدالة المستخدمة للصور!

        all_text_parts.append(f"--- Page {i} ---\n{page_data['text']}")
        pages.append({
            "page": i,
            "text": page_data["text"],
            "blocks": page_data["blocks"],
            "image_width": page_data["image_width"],
            "image_height": page_data["image_height"],
        })

        # ✅ تحرير فوري من الذاكرة
        pil_img.close()
        del pil_pages, pil_img, page_data
        gc.collect()

    return {
        "text": "\n\n".join(all_text_parts),
        "page_count": page_count,
        "pages": pages
    }

# ══ دوال Backward-Compatible (main.py يستدعيها) ══════

def process_document(file_path: str, file_type: str, lang: str = "latin") -> tuple[str, int]:
    file_type = file_type.lower()
    if file_type in ("jpg","jpeg","png","bmp","tiff"):
        data = extract_layout_from_image(file_path)
        return data["text"], 1
    elif file_type == "pdf":
        data = extract_layout_from_pdf(file_path)
        return data["text"], data["page_count"]
    else:
        raise ValueError(f"Unsupported file type: {file_type}")

def process_document_with_layout(file_path: str, file_type: str, lang: str = "latin") -> dict:
    file_type = file_type.lower()
    if file_type in ("jpg","jpeg","png","bmp","tiff"):
        data = extract_layout_from_image(file_path)
        return {"text": data["text"], "page_count": 1, "pages": [{
            "page":1, "text": data["text"], "blocks": data["blocks"],
            "image_width": data["image_width"], "image_height": data["image_height"]
        }]}
    elif file_type == "pdf":
        return extract_layout_from_pdf(file_path)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")

# للتوافق مع أي كود قديم يستدعي extract_layout_from_pil
extract_layout_from_pil = lambda pil_img, lang="latin": _ocr_pil(pil_img)
