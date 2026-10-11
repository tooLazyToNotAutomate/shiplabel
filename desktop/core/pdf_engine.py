import os
import fitz  # PyMuPDF
from PIL import Image
import io
from typing import Dict, List, Tuple, Optional

class PDFEngine:
    """
    High-performance vector PDF rendering and cropping engine using PyMuPDF.
    """

    @staticmethod
    def get_pdf_info(pdf_path: str) -> Dict:
        """
        Returns info about PDF: page_count, first page dimensions (pts), orientation.
        """
        doc = fitz.open(pdf_path)
        page_count = len(doc)
        if page_count == 0:
            doc.close()
            raise ValueError("PDF has no pages")
        
        first_page = doc[0]
        rect = first_page.rect
        width = rect.width
        height = rect.height
        orientation = "portrait" if height >= width else "landscape"
        doc.close()

        return {
            "page_count": page_count,
            "width": width,
            "height": height,
            "orientation": orientation
        }

    @staticmethod
    def render_page_to_pil(pdf_path: str, page_num: int = 0, dpi: int = 150) -> Tuple[Image.Image, float, float]:
        """
        Renders a specific page of a PDF file to a PIL Image.
        Returns (PIL Image, actual_width_pt, actual_height_pt).
        """
        doc = fitz.open(pdf_path)
        if page_num < 0 or page_num >= len(doc):
            doc.close()
            raise IndexError(f"Page index {page_num} out of bounds (0..{len(doc)-1})")
        
        page = doc[page_num]
        rect = page.rect
        width_pt = rect.width
        height_pt = rect.height

        zoom = dpi / 72.0
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        
        doc.close()
        return img, width_pt, height_pt

    @staticmethod
    def crop_pdf(input_path: str, output_path: str, crop_rect_norm: Dict[str, float], 
                 pages: Optional[List[int]] = None) -> bool:
        """
        Vector crop of PDF pages using normalized rect (0.0 to 1.0).
        Preserves vector quality (no rasterization!).
        crop_rect_norm: {"x0": ..., "y0": ..., "x1": ..., "y1": ...}
        """
        try:
            doc = fitz.open(input_path)
            target_pages = pages if pages is not None else list(range(len(doc)))

            for pno in target_pages:
                if 0 <= pno < len(doc):
                    page = doc[pno]
                    rect = page.rect
                    
                    x0 = crop_rect_norm["x0"] * rect.width
                    y0 = crop_rect_norm["y0"] * rect.height
                    x1 = crop_rect_norm["x1"] * rect.width
                    y1 = crop_rect_norm["y1"] * rect.height

                    crop_box = fitz.Rect(x0, y0, x1, y1)
                    page.set_cropbox(crop_box)
                    page.set_mediabox(crop_box)

            doc.save(output_path, garbage=4, deflate=True)
            doc.close()
            return True
        except Exception as e:
            print(f"Error cropping PDF {input_path}: {e}")
            return False

    @staticmethod
    def crop_pdf_to_bytes(pdf_bytes: bytes, crop_rect_norm: Dict[str, float]) -> bytes:
        """
        In-memory vector crop of PDF.
        """
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        for page in doc:
            rect = page.rect
            x0 = crop_rect_norm["x0"] * rect.width
            y0 = crop_rect_norm["y0"] * rect.height
            x1 = crop_rect_norm["x1"] * rect.width
            y1 = crop_rect_norm["y1"] * rect.height
            page.set_cropbox(fitz.Rect(x0, y0, x1, y1))
        
        output_stream = io.BytesIO()
        doc.save(output_stream, garbage=4, deflate=True)
        doc.close()
        return output_stream.getvalue()
