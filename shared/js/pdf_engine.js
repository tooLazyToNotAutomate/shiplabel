/**
 * PDFEngine: Client-side PDF processing using the "crop by translation" technique.
 *
 * CROP APPROACH:
 *   Creates a new page with exact crop dimensions, embeds source page with negative
 *   offset so desired region aligns to (0,0). Content outside new page bounds is
 *   automatically clipped by the PDF spec — invoice is never visible in output.
 *
 * GRID LAYOUT (Page-Fill mode):
 *   Cells ALWAYS divide the full page equally (like a guillotine-cut template).
 *   Labels are scaled to fill each cell's width (aspect-ratio preserved) then
 *   centered vertically. This eliminates giant whitespace bands at page edges and
 *   distributes any remaining space evenly inside each cell. Cut marks run edge-to-
 *   edge across the full sheet, matching how a guillotine cutter operates.
 */

const PAPER_SIZES_PT = {
  "A4":          [595.28, 841.89],
  "Thermal 3x5": [216.0,  360.0],
  "Thermal 4x6": [288.0,  432.0]
};

class PDFEngine {

  /**
   * Crop all pages of a PDF using normalized rect { x0, y0, x1, y1 } (0=top, 1=bottom).
   * Returns a Uint8Array of a new PDF containing ONLY the cropped label regions.
   */
  static async cropPDF(arrayBuffer, cropRectNorm) {
    const { PDFDocument } = PDFLib;
    const srcDoc = await PDFDocument.load(arrayBuffer);
    const outDoc = await PDFDocument.create();

    const srcPageCount = srcDoc.getPageCount();
    if (srcPageCount > Security.MAX_PAGES_PER_PDF) {
      throw new Error("PDF has too many pages");
    }

    for (let i = 0; i < srcPageCount; i++) {
      const srcPage = srcDoc.getPages()[i];
      const { width: srcW, height: srcH } = srcPage.getSize();

      const cropX       = cropRectNorm.x0 * srcW;
      const cropW       = (cropRectNorm.x1 - cropRectNorm.x0) * srcW;
      const cropH       = (cropRectNorm.y1 - cropRectNorm.y0) * srcH;
      const cropYBottom = (1 - cropRectNorm.y1) * srcH;

      const newPage = outDoc.addPage([cropW, cropH]);
      const [embedded] = await outDoc.embedPdf(srcDoc, [i]);
      newPage.drawPage(embedded, {
        x: -cropX,
        y: -cropYBottom,
        width:  srcW,
        height: srcH
      });
    }

    return await outDoc.save();
  }

  /**
   * Export: Thermal output — 1 label per page, fitted to thermal paper dimensions.
   */
  static async exportThermal(croppedPdfBytesList, labelSize = "Thermal 3x5") {
    const { PDFDocument } = PDFLib;
    const outDoc = await PDFDocument.create();
    const [targetW, targetH] = PAPER_SIZES_PT[labelSize] || PAPER_SIZES_PT["Thermal 3x5"];

    for (const pdfBytes of croppedPdfBytesList) {
      const srcDoc = await PDFDocument.load(pdfBytes);
      for (let i = 0; i < srcDoc.getPageCount(); i++) {
        const [embedded] = await outDoc.embedPdf(srcDoc, [i]);
        const { width: embW, height: embH } = embedded;

        const scale   = Math.min(targetW / embW, targetH / embH);
        const drawW   = embW * scale;
        const drawH   = embH * scale;
        const offsetX = (targetW - drawW) / 2;
        const offsetY = (targetH - drawH) / 2;

        const newPage = outDoc.addPage([targetW, targetH]);
        newPage.drawPage(embedded, { x: offsetX, y: offsetY, width: drawW, height: drawH });
      }
    }

    return await outDoc.save();
  }

  /**
   * Export: Page-fill grid layout.
   *
   * The page is divided into (rows × cols) equal cells. Each label is scaled to fill
   * its cell's width (aspect-ratio preserved) then centered in the cell. Auto-picks
   * landscape vs portrait based on which orientation gives the larger label.
   *
   * Key insight: cells fill the full page (like a guillotine-cut template). Any
   * whitespace from label aspect ratio mismatch is distributed evenly inside each
   * cell rather than concentrated as large bands at page edges.
   */
  static async exportGrid(
    croppedPdfBytesList,
    rows         = 2,
    cols         = 2,
    paperName    = "A4",
    drawCutMarks = true
  ) {
    const { PDFDocument, rgb } = PDFLib;
    const outDoc = await PDFDocument.create();

    // Collect all label pages
    const allEmbedded = [];
    for (const pdfBytes of croppedPdfBytesList) {
      const srcDoc = await PDFDocument.load(pdfBytes);
      for (let i = 0; i < srcDoc.getPageCount(); i++) {
        const [emb] = await outDoc.embedPdf(srcDoc, [i]);
        allEmbedded.push(emb);
      }
    }
    if (allEmbedded.length === 0) return null;

    const labelW = allEmbedded[0].width;
    const labelH = allEmbedded[0].height;

    // Auto-select orientation: pick landscape or portrait based on which gives the bigger label
    const [bW, bH] = PAPER_SIZES_PT[paperName] || PAPER_SIZES_PT["A4"];
    const edgeMargin = 6;  // tiny outer margin so cut marks don't clip off page
    const gutter     = 4;  // thin gap between adjacent cells

    // Portrait (short × long)
    const pW = Math.min(bW, bH), pH = Math.max(bW, bH);
    const cellW_P = (pW - edgeMargin * 2 - gutter * (cols - 1)) / cols;
    const cellH_P = (pH - edgeMargin * 2 - gutter * (rows - 1)) / rows;
    const scaleP  = Math.min(cellW_P / labelW, cellH_P / labelH);

    // Landscape (long × short)
    const lW = Math.max(bW, bH), lH = Math.min(bW, bH);
    const cellW_L = (lW - edgeMargin * 2 - gutter * (cols - 1)) / cols;
    const cellH_L = (lH - edgeMargin * 2 - gutter * (rows - 1)) / rows;
    const scaleL  = Math.min(cellW_L / labelW, cellH_L / labelH);

    let pageW, pageH, cellW, cellH, labelScale;
    if (scaleL >= scaleP) {
      pageW = lW; pageH = lH; cellW = cellW_L; cellH = cellH_L; labelScale = scaleL;
    } else {
      pageW = pW; pageH = pH; cellW = cellW_P; cellH = cellH_P; labelScale = scaleP;
    }

    // Label draw dimensions (aspect-ratio preserved, fills cell width exactly)
    const drawW = labelW * labelScale;
    const drawH = labelH * labelScale;

    const labelsPerPage = rows * cols;
    const totalSheets   = Math.ceil(allEmbedded.length / labelsPerPage);

    for (let sheetIdx = 0; sheetIdx < totalSheets; sheetIdx++) {
      const sheet = outDoc.addPage([pageW, pageH]);
      const chunk = allEmbedded.slice(
        sheetIdx * labelsPerPage,
        (sheetIdx + 1) * labelsPerPage
      );

      chunk.forEach((embedded, idx) => {
        const r = Math.floor(idx / cols);
        const c = idx % cols;

        // Cell origin — bottom-left in PDF coordinate space
        const cellX = edgeMargin + c * (cellW + gutter);
        const cellY = edgeMargin + (rows - 1 - r) * (cellH + gutter);

        // Center label within cell (distributes whitespace evenly top/bottom/left/right)
        const labelX = cellX + (cellW - drawW) / 2;
        const labelY = cellY + (cellH - drawH) / 2;

        sheet.drawPage(embedded, { x: labelX, y: labelY, width: drawW, height: drawH });

        if (drawCutMarks) {
          // Marks at cell boundary corners — not label corners — so they guide full-sheet cutting
          PDFEngine._drawCutMarks(sheet, cellX, cellY, cellW, cellH, rgb(0.4, 0.4, 0.4));
        }
      });
    }

    return await outDoc.save();
  }

  /** Draws L-shaped cut marks at all four corners of a rectangle */
  static _drawCutMarks(page, x, y, w, h, color) {
    const len = 8, t = 0.4;
    // Top-Left
    page.drawLine({ start:{x: x - len, y: y + h}, end:{x: x,       y: y + h      }, thickness:t, color });
    page.drawLine({ start:{x: x,       y: y + h}, end:{x: x,       y: y + h + len}, thickness:t, color });
    // Top-Right
    page.drawLine({ start:{x: x + w,   y: y + h}, end:{x: x+w+len, y: y + h      }, thickness:t, color });
    page.drawLine({ start:{x: x + w,   y: y + h}, end:{x: x + w,   y: y + h + len}, thickness:t, color });
    // Bottom-Left
    page.drawLine({ start:{x: x - len, y: y    }, end:{x: x,       y: y          }, thickness:t, color });
    page.drawLine({ start:{x: x,       y: y    }, end:{x: x,       y: y - len    }, thickness:t, color });
    // Bottom-Right
    page.drawLine({ start:{x: x + w,   y: y    }, end:{x: x+w+len, y: y          }, thickness:t, color });
    page.drawLine({ start:{x: x + w,   y: y    }, end:{x: x + w,   y: y - len    }, thickness:t, color });
  }

  /**
   * Export: Convert cropped PDF pages to crisp PNG images and bundle in a ZIP file.
   */
  static async exportPNGZip(croppedPdfBytesList, prefix = "Label") {
    if (!window.JSZip) throw new Error("JSZip library not loaded");
    const zip = new JSZip();
    const folder = zip.folder("Cropped_Labels");
    let count = 0;

    for (let docIdx = 0; docIdx < croppedPdfBytesList.length; docIdx++) {
      const pdfBytes = croppedPdfBytesList[docIdx];
      const pdf = await pdfjsLib.getDocument({ data: pdfBytes, isEvalSupported: false, enableXfa: false }).promise;
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        count++;
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 }); // 2x crisp rendering
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        await page.render({ canvasContext: ctx, viewport }).promise;

        const dataUrl = canvas.toDataURL("image/png");
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
        const padNum = String(count).padStart(3, '0');
        folder.file(`${prefix}_${padNum}.png`, base64Data, { base64: true });
      }
    }

    return await zip.generateAsync({ type: "uint8array" });
  }
}

window.PDFEngine = PDFEngine;

