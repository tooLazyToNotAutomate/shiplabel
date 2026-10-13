/**
 * Security: input validation and safe storage helpers.
 * All processing is client-side; these guards protect against malicious
 * imported templates, tampered localStorage and hostile/oversized PDFs.
 */

const Security = {
  MAX_FILE_BYTES: 50 * 1024 * 1024,   // per PDF
  MAX_FILES: 500,
  MAX_TOTAL_BYTES: 500 * 1024 * 1024,
  MAX_PAGES_PER_PDF: 500,
  MAX_TEMPLATES: 200,
  MAX_IMPORT_BYTES: 1024 * 1024,

  MARKETPLACES: ["Flipkart", "Meesho", "Amazon", "Shiprocket", "Custom"],
  LABEL_SIZES: ["3x5", "4x6", "A6"],
  OUTPUT_MODES: [
    "Thermal 3x5", "Thermal 4x6", "A4 Sheet (4-up Grid)", "A4 Sheet (6-up Grid)",
    "A4 Sheet (2-up Grid)", "PNG ZIP"
  ],

  /** Escape text for safe use in HTML (defence in depth; prefer textContent). */
  escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  },

  /** Strip control chars, trim and cap length. */
  cleanText(value, max = 60) {
    return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
  },

  isFiniteNum(n) {
    return typeof n === "number" && Number.isFinite(n);
  },

  /** Returns a sanitized crop rect or null. Enforces 0..1 and a minimum size. */
  sanitizeCropRect(r) {
    if (!r || typeof r !== "object") return null;
    const { x0, y0, x1, y1 } = r;
    if (![x0, y0, x1, y1].every(Security.isFiniteNum)) return null;
    if (x0 < 0 || y0 < 0 || x1 > 1 || y1 > 1) return null;
    if (x1 - x0 < 0.02 || y1 - y0 < 0.02) return null;
    return { x0, y0, x1, y1 };
  },

  /** Returns a clean template object or null if invalid. Never trusts input fields. */
  sanitizeTemplate(t) {
    if (!t || typeof t !== "object") return null;
    const name = Security.cleanText(t.name, 60);
    const cropRect = Security.sanitizeCropRect(t.cropRect);
    if (!name || !cropRect) return null;
    return {
      id: /^[A-Za-z0-9_-]{1,64}$/.test(t.id) ? t.id : null, // caller assigns if null
      name,
      marketplace: Security.MARKETPLACES.includes(t.marketplace) ? t.marketplace : "Custom",
      cropRect,
      labelSize: Security.LABEL_SIZES.includes(t.labelSize) ? t.labelSize : "3x5",
      createdAt: typeof t.createdAt === "string" ? Security.cleanText(t.createdAt, 40) : new Date().toISOString()
    };
  },

  sanitizeHistoryEntry(h) {
    if (!h || typeof h !== "object") return null;
    return {
      id: Security.cleanText(h.id, 40),
      timestamp: Security.cleanText(h.timestamp, 40),
      marketplace: Security.MARKETPLACES.includes(h.marketplace) ? h.marketplace : "Custom",
      filesCount: Number.isInteger(h.filesCount) && h.filesCount >= 0 && h.filesCount <= 100000 ? h.filesCount : 0,
      mode: Security.OUTPUT_MODES.includes(h.mode) ? h.mode : "Unknown"
    };
  },

  pick(value, allowed, fallback) {
    return allowed.includes(value) ? value : fallback;
  },

  /** localStorage wrappers that never throw. */
  storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  },
  storageSet(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
  },
  storageRemove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  },

  formatBytes(n) {
    return n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
  },

  /**
   * Validate user-supplied PDFs: extension, size, count and the %PDF- magic header.
   * Returns { valid: File[], errors: string[] } where each error is a plain-language
   * explanation meant to be shown to the user.
   */
  async validatePdfFiles(files) {
    const valid = [];
    const errors = [];
    let total = 0;
    let overCount = 0;
    let overTotal = 0;
    const maxMb = Security.MAX_FILE_BYTES / 1048576;

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (i >= Security.MAX_FILES) { overCount++; continue; }
      if (!f.name.toLowerCase().endsWith(".pdf")) {
        errors.push(`"${f.name}" skipped: ${f.name.includes(".") ? "it is a ." + f.name.split(".").pop().slice(0, 10).toLowerCase() + " file" : "it has no file extension"}. Only PDF files whose name ends in ".pdf" (for example label.pdf or invoice_123.pdf) are accepted.`);
        continue;
      }
      if (f.size === 0) { errors.push(`"${f.name}" skipped: the file is empty.`); continue; }
      if (f.size > Security.MAX_FILE_BYTES) {
        errors.push(`"${f.name}" skipped: ${Security.formatBytes(f.size)} is over the ${maxMb} MB per-file limit.`);
        continue;
      }
      if (total + f.size > Security.MAX_TOTAL_BYTES) { overTotal++; continue; }
      try {
        const head = new Uint8Array(await f.slice(0, 1024).arrayBuffer());
        const text = String.fromCharCode(...head);
        if (!text.includes("%PDF-")) {
          errors.push(`"${f.name}" skipped: its name ends in ".pdf" but the contents are not a real PDF (it may be a renamed image or Word file, or a damaged download). Only genuine PDF files named like label.pdf or invoice_123.pdf are accepted. Please download the label again from the marketplace.`);
          continue;
        }
      } catch (e) {
        errors.push(`"${f.name}" skipped: the file could not be read.`);
        continue;
      }
      total += f.size;
      valid.push(f);
    }
    if (overCount > 0) {
      errors.push(`${overCount} file(s) skipped: you can add at most ${Security.MAX_FILES} PDFs at a time. Process these first, then add the rest.`);
    }
    if (overTotal > 0) {
      errors.push(`${overTotal} file(s) skipped: the combined size limit of ${Security.MAX_TOTAL_BYTES / 1048576} MB per batch was reached. Process this batch, then add the rest.`);
    }
    return { valid, errors };
  },

  /** Safe filename segment for downloads. */
  safeFilePart(value) {
    return String(value ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 30) || "Label";
  }
};

window.Security = Security;
