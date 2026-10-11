import fitz  # PyMuPDF
import math
from typing import List, Dict, Tuple, Optional

# Standard Paper Sizes in Points (72 points per inch)
PAPER_SIZES = {
    "A4": (595.28, 841.89),       # 210 x 297 mm
    "Letter": (612.0, 792.0),     # 8.5 x 11 in
    "Legal": (612.0, 1008.0),    # 8.5 x 14 in
    "Thermal 3x5": (216.0, 360.0), # 3 x 5 in
    "Thermal 4x6": (288.0, 432.0)  # 4 x 6 in
}

class OutputEngine:
    """
    Assembles cropped label PDFs into various output formats:
    - Single Thermal PDF (1 label per page, scaled to thermal label dimensions)
    - A4 Sheet Grid (4-up, 2-up, 6-up) with cut marks
    - Custom Grid (n rows x m cols) with customizable margins
    """

    @staticmethod
    def export_thermal(cropped_pdf_paths: List[str], output_path: str, label_size: str = "Thermal 3x5") -> bool:
        """
        Exports labels as individual pages scaled to thermal printer paper size.
        """
        try:
            target_width, target_height = PAPER_SIZES.get(label_size, PAPER_SIZES["Thermal 3x5"])
            out_doc = fitz.open()

            for src_path in cropped_pdf_paths:
                src_doc = fitz.open(src_path)
                for pno in range(len(src_doc)):
                    src_page = src_doc[pno]
                    # Create new thermal page
                    new_page = out_doc.new_page(width=target_width, height=target_height)
                    # Fit source cropbox into thermal dimensions
                    target_rect = fitz.Rect(0, 0, target_width, target_height)
                    new_page.show_pdf_page(target_rect, src_doc, pno)
                src_doc.close()

            out_doc.save(output_path, garbage=4, deflate=True)
            out_doc.close()
            return True
        except Exception as e:
            print(f"Error exporting thermal output: {e}")
            return False

    @staticmethod
    def export_grid(cropped_pdf_paths: List[str], output_path: str,
                    rows: int = 2, cols: int = 2,
                    paper_name: str = "A4",
                    orientation: str = "portrait",
                    margin_pt: float = 18.0,
                    draw_cut_marks: bool = True) -> bool:
        """
        Arranges cropped PDF pages into a grid (e.g. 4-up on A4) with cut marks.
        """
        try:
            base_w, base_h = PAPER_SIZES.get(paper_name, PAPER_SIZES["A4"])
            if orientation.lower() == "landscape":
                page_w, page_h = max(base_w, base_h), min(base_w, base_h)
            else:
                page_w, page_h = min(base_w, base_h), max(base_w, base_h)

            labels_per_page = rows * cols
            out_doc = fitz.open()

            # Flatten all source pages into a sequence
            all_source_pages: List[Tuple[str, int]] = []
            for src_path in cropped_pdf_paths:
                src_doc = fitz.open(src_path)
                num_pages = len(src_doc)
                src_doc.close()
                for pno in range(num_pages):
                    all_source_pages.append((src_path, pno))

            if not all_source_pages:
                return False

            # Available grid area after margins
            avail_w = page_w - (2 * margin_pt)
            avail_h = page_h - (2 * margin_pt)

            cell_w = avail_w / cols
            cell_h = avail_h / rows

            total_pages = math.ceil(len(all_source_pages) / labels_per_page)

            for page_idx in range(total_pages):
                new_page = out_doc.new_page(width=page_w, height=page_h)
                chunk = all_source_pages[page_idx * labels_per_page : (page_idx + 1) * labels_per_page]

                for idx, (src_path, src_pno) in enumerate(chunk):
                    r = idx // cols
                    c = idx % cols

                    x0 = margin_pt + c * cell_w
                    y0 = margin_pt + r * cell_h
                    x1 = x0 + cell_w
                    y1 = y0 + cell_h

                    cell_rect = fitz.Rect(x0, y0, x1, y1)

                    # Open source doc to show page
                    src_doc = fitz.open(src_path)
                    new_page.show_pdf_page(cell_rect, src_doc, src_pno, keep_proportion=True)
                    src_doc.close()

                    # Draw cut marks around cell
                    if draw_cut_marks:
                        OutputEngine._draw_cell_cut_marks(new_page, cell_rect, mark_len=8.0)

            out_doc.save(output_path, garbage=4, deflate=True)
            out_doc.close()
            return True
        except Exception as e:
            print(f"Error exporting grid output: {e}")
            return False

    @staticmethod
    def _draw_cell_cut_marks(page, rect: fitz.Rect, mark_len: float = 8.0):
        """
        Draws light gray cut mark ticks at the corners of a grid cell.
        """
        shape = page.new_shape()
        color = (0.6, 0.6, 0.6)  # slate gray
        width = 0.5

        # Top-Left corner
        shape.draw_line(fitz.Point(rect.x0 - mark_len, rect.y0), fitz.Point(rect.x0, rect.y0))
        shape.draw_line(fitz.Point(rect.x0, rect.y0 - mark_len), fitz.Point(rect.x0, rect.y0))

        # Top-Right corner
        shape.draw_line(fitz.Point(rect.x1, rect.y0), fitz.Point(rect.x1 + mark_len, rect.y0))
        shape.draw_line(fitz.Point(rect.x1, rect.y0 - mark_len), fitz.Point(rect.x1, rect.y0))

        # Bottom-Left corner
        shape.draw_line(fitz.Point(rect.x0 - mark_len, rect.y1), fitz.Point(rect.x0, rect.y1))
        shape.draw_line(fitz.Point(rect.x0, rect.y1), fitz.Point(rect.x0, rect.y1 + mark_len))

        # Bottom-Right corner
        shape.draw_line(fitz.Point(rect.x1, rect.y1), fitz.Point(rect.x1 + mark_len, rect.y1))
        shape.draw_line(fitz.Point(rect.x1, rect.y1), fitz.Point(rect.x1, rect.y1 + mark_len))

        shape.finish(color=color, width=width)
        shape.commit()
