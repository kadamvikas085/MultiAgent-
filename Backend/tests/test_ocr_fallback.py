"""Manual OCR fallback smoke test.

Run from Backend with the virtualenv activated:
    python tests/test_ocr_fallback.py

The fixture is image-only, so PyMuPDF should report zero/near-zero extracted
text and IntelliSpec should enter the PaddleOCR fallback.
"""
from pathlib import Path
import fitz

fixture = Path(__file__).parent / "fixtures" / "intellispec_ocr_test.pdf"
doc = fitz.open(fixture)
try:
    text = "\n".join(page.get_text().strip() for page in doc).strip()
    print(f"PDF: {fixture}")
    print(f"Pages: {len(doc)}")
    print(f"Extracted text characters: {len(text)}")
    if text:
        raise SystemExit("FAIL: fixture contains extractable PDF text; OCR fallback may not trigger.")
    print("PASS: image-only PDF confirmed; PaddleOCR fallback should be invoked.")
finally:
    doc.close()
