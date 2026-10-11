import pytest
import os
import fitz
from core.pdf_engine import PDFEngine
from core.output_engine import OutputEngine
from core.template_manager import TemplateManager

@pytest.fixture
def sample_pdf(tmp_path):
    pdf_p = os.path.join(tmp_path, "sample_label.pdf")
    doc = fitz.open()
    page = doc.new_page(width=595.28, height=841.89)  # A4
    page.insert_text((100, 100), "SHIPPING LABEL AREA", fontsize=20)
    page.insert_text((100, 700), "INVOICE FOOTER TO IGNORE", fontsize=16)
    doc.save(pdf_p)
    doc.close()
    return pdf_p

def test_pdf_info(sample_pdf):
    info = PDFEngine.get_pdf_info(sample_pdf)
    assert info["page_count"] == 1
    assert round(info["width"]) == 595
    assert round(info["height"]) == 842
    assert info["orientation"] == "portrait"

def test_crop_vector(sample_pdf, tmp_path):
    out_pdf = os.path.join(tmp_path, "cropped.pdf")
    crop_rect = {"x0": 0.1, "y0": 0.1, "x1": 0.9, "y1": 0.5}
    
    ok = PDFEngine.crop_pdf(sample_pdf, out_pdf, crop_rect)
    assert ok is True
    assert os.path.exists(out_pdf)

    cropped_doc = fitz.open(out_pdf)
    cropped_page = cropped_doc[0]
    cropbox = cropped_page.cropbox
    
    assert round(cropbox.width) == round(0.8 * 595.28)
    assert round(cropbox.height) == round(0.4 * 841.89)
    cropped_doc.close()

def test_output_engine_thermal(sample_pdf, tmp_path):
    cropped_pdf = os.path.join(tmp_path, "cropped.pdf")
    crop_rect = {"x0": 0.1, "y0": 0.1, "x1": 0.9, "y1": 0.5}
    PDFEngine.crop_pdf(sample_pdf, cropped_pdf, crop_rect)

    thermal_out = os.path.join(tmp_path, "thermal_3x5.pdf")
    ok = OutputEngine.export_thermal([cropped_pdf], thermal_out, label_size="Thermal 3x5")
    assert ok is True

    doc = fitz.open(thermal_out)
    assert len(doc) == 1
    p = doc[0]
    assert round(p.rect.width) == 216
    assert round(p.rect.height) == 360
    doc.close()

def test_output_engine_a4_grid(sample_pdf, tmp_path):
    cropped_pdf = os.path.join(tmp_path, "cropped.pdf")
    crop_rect = {"x0": 0.1, "y0": 0.1, "x1": 0.9, "y1": 0.5}
    PDFEngine.crop_pdf(sample_pdf, cropped_pdf, crop_rect)

    a4_out = os.path.join(tmp_path, "a4_4up.pdf")
    # 4 labels onto A4 page
    ok = OutputEngine.export_grid([cropped_pdf]*4, a4_out, rows=2, cols=2, paper_name="A4")
    assert ok is True

    doc = fitz.open(a4_out)
    assert len(doc) == 1
    p = doc[0]
    assert round(p.rect.width) == 595
    assert round(p.rect.height) == 842
    doc.close()
