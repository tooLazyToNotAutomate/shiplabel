/**
 * App: Controller for ShipLabel Web Studio.
 */

// pdf.js hardening: no eval of font programs (CVE-2024-4367), same-origin worker only
if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "shared/vendor/pdf.worker.min.js";
}
const PDFJS_SAFE_OPTS = { isEvalSupported: false, enableXfa: false };

class App {
  constructor() {
    this.currentView = "dashboard";
    this.processFiles = [];
    this.batchFiles = [];
    this.samplePdfBuffer = null;
    this.cropCanvas = null;

    this.settings = {
      defaultPaper: "A4",
      defaultMode: "A4 Sheet (4-up Grid)",
      cutMarks: true,
      autoDetect: true
    };

    this.history = [];

    this.init();
  }

  init() {
    this.loadSettings();
    this.loadHistory();

    this.bindNavigation();
    this.bindTemplates();
    this.bindProcess();
    this.bindBatch();
    this.bindHistory();
    this.bindSettings();

    this.renderTemplates();
    this.renderHistory();
  }

  // Settings Storage
  loadSettings() {
    try {
      const stored = Security.storageGet("shiplabel_settings");
      if (stored) {
        const p = JSON.parse(stored) || {};
        this.settings = {
          defaultPaper: Security.pick(p.defaultPaper, Security.PAPER_SIZES, this.settings.defaultPaper),
          defaultMode: Security.pick(p.defaultMode, Security.OUTPUT_MODES, this.settings.defaultMode),
          cutMarks: typeof p.cutMarks === "boolean" ? p.cutMarks : this.settings.cutMarks,
          autoDetect: typeof p.autoDetect === "boolean" ? p.autoDetect : this.settings.autoDetect
        };
      }
    } catch (e) {
      console.error("Settings load error:", e);
    }

    // Apply defaults to controls
    const elPaper = document.getElementById("process-paper-size");
    const elMode = document.getElementById("process-output-mode");
    const elCut = document.getElementById("process-cut-marks");

    if (elPaper) elPaper.value = this.settings.defaultPaper;
    if (elMode) elMode.value = this.settings.defaultMode;
    if (elCut) elCut.checked = this.settings.cutMarks;

    const sPaper = document.getElementById("setting-default-paper");
    const sMode = document.getElementById("setting-default-mode");
    const sCut = document.getElementById("setting-cut-marks");
    const sAuto = document.getElementById("setting-autodetect");

    if (sPaper) sPaper.value = this.settings.defaultPaper;
    if (sMode) sMode.value = this.settings.defaultMode;
    if (sCut) sCut.checked = this.settings.cutMarks;
    if (sAuto) sAuto.checked = this.settings.autoDetect;
  }

  saveSettings() {
    this.settings.defaultPaper = document.getElementById("setting-default-paper").value;
    this.settings.defaultMode = document.getElementById("setting-default-mode").value;
    this.settings.cutMarks = document.getElementById("setting-cut-marks").checked;
    this.settings.autoDetect = document.getElementById("setting-autodetect").checked;

    this.settings.defaultPaper = Security.pick(this.settings.defaultPaper, Security.PAPER_SIZES, "A4");
    this.settings.defaultMode = Security.pick(this.settings.defaultMode, Security.OUTPUT_MODES, "A4 Sheet (4-up Grid)");
    const ok = Security.storageSet("shiplabel_settings", JSON.stringify(this.settings));
    alert(ok ? "Settings saved successfully!" : "Could not save settings (browser storage unavailable).");
  }

  // History Storage
  loadHistory() {
    try {
      const stored = Security.storageGet("shiplabel_history");
      if (stored) {
        const parsed = JSON.parse(stored);
        this.history = Array.isArray(parsed)
          ? parsed.slice(0, 50).map(Security.sanitizeHistoryEntry).filter(Boolean)
          : [];
      }
    } catch (e) {
      console.error("History load error:", e);
      this.history = [];
    }
  }

  addHistoryEntry(entry) {
    entry = Security.sanitizeHistoryEntry(entry) || {};
    entry.id = "hist_" + Date.now();
    entry.timestamp = new Date().toLocaleString();
    this.history.unshift(entry);
    if (this.history.length > 50) this.history.pop(); // keep last 50
    Security.storageSet("shiplabel_history", JSON.stringify(this.history));
    this.renderHistory();
  }

  clearHistory() {
    if (confirm("Clear all processing history?")) {
      this.history = [];
      Security.storageRemove("shiplabel_history");
      this.renderHistory();
    }
  }

  renderHistory() {
    const tbody = document.getElementById("history-table-body");
    if (!tbody) return;

    tbody.textContent = "";
    if (this.history.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 5;
      td.style.cssText = "text-align: center; color: var(--text-muted); padding: 30px;";
      td.textContent = "No processing history yet.";
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    this.history.forEach(item => {
      const tr = document.createElement("tr");
      const cell = (text, extra) => {
        const td = document.createElement("td");
        td.style.cssText = "padding: 10px;" + (extra || "");
        td.textContent = text;
        tr.appendChild(td);
        return td;
      };
      cell(item.timestamp);
      const mpTd = cell("");
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = item.marketplace || "Custom";
      mpTd.appendChild(badge);
      cell(`${item.filesCount} file(s)`, " font-weight: 600;");
      cell(item.mode);
      cell("Completed", " color: var(--success); font-weight: 600;");
      tbody.appendChild(tr);
    });
  }

  // Navigation
  bindNavigation() {
    const mobileMenuBtn = document.getElementById("mobile-menu-btn");
    const sidebarCloseBtn = document.getElementById("sidebar-close-btn");
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebar-overlay");

    const toggleSidebar = (show) => {
      if (!sidebar || !overlay) return;
      if (show) {
        sidebar.classList.add("open");
        overlay.classList.add("active");
      } else {
        sidebar.classList.remove("open");
        overlay.classList.remove("active");
      }
    };

    if (mobileMenuBtn) mobileMenuBtn.addEventListener("click", () => toggleSidebar(true));
    if (sidebarCloseBtn) sidebarCloseBtn.addEventListener("click", () => toggleSidebar(false));
    if (overlay) overlay.addEventListener("click", () => toggleSidebar(false));

    document.querySelectorAll("[data-goto]").forEach(btn => {
      btn.addEventListener("click", () => this.switchView(btn.getAttribute("data-goto")));
    });

    document.querySelectorAll(".nav-item").forEach(item => {
      item.addEventListener("click", () => {
        const view = item.getAttribute("data-view");
        this.switchView(view);
        // Close sidebar on mobile after clicking
        if (window.innerWidth <= 900) {
          toggleSidebar(false);
        }
      });
    });
  }

  switchView(viewName) {
    this.currentView = viewName;
    window.scrollTo(0, 0);
    const main = document.getElementById("main-content");
    if (main) main.scrollTop = 0;
    document.querySelectorAll(".nav-item").forEach(item => {
      item.classList.toggle("active", item.getAttribute("data-view") === viewName);
    });

    document.querySelectorAll(".view").forEach(v => {
      v.classList.toggle("active", v.id === `view-${viewName}`);
    });

    if (viewName === "templates") {
      this.renderTemplates();
    } else if (viewName === "process") {
      this.populateTemplateDropdown("process-template-select");
    } else if (viewName === "batch") {
      this.populateTemplateDropdown("batch-template-select");
    } else if (viewName === "history") {
      this.renderHistory();
    }
  }

  // Smart Marketplace Auto-Detection
  async autoDetectMarketplace(file, selectId, badgeId) {
    if (!this.settings.autoDetect) return;

    try {
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer, ...PDFJS_SAFE_OPTS }).promise;
      const page = await pdf.getPage(1);
      const textContent = await page.getTextContent();
      const text = textContent.items.map(i => i.str).join(" ").toLowerCase();

      let detectedMp = null;
      let matchedTmplId = null;

      if (text.includes("flipkart") || text.includes("e-kart") || text.includes("ekart")) {
        detectedMp = "Flipkart";
        matchedTmplId = "flipkart-3x5-default";
      } else if (text.includes("meesho")) {
        detectedMp = "Meesho";
        matchedTmplId = "meesho-thermal-default";
      } else if (text.includes("amazon")) {
        detectedMp = "Amazon";
        matchedTmplId = "amazon-a6-default";
      } else if (text.includes("shiprocket")) {
        detectedMp = "Shiprocket";
        matchedTmplId = "shiprocket-thermal-default";
      }

      if (detectedMp && matchedTmplId) {
        const select = document.getElementById(selectId);
        if (select) select.value = matchedTmplId;

        const badge = document.getElementById(badgeId);
        if (badge) {
          badge.style.display = "inline-block";
          badge.textContent = `Auto-detected: ${detectedMp} Crop Template`;
        }
      }
    } catch (e) {
      console.log("Auto-detection skipped:", e);
    }
  }

  // Drag & Drop Helper
  setupDropzone(dropzoneEl, fileInputEl, onFilesSelected) {
    dropzoneEl.addEventListener("click", () => fileInputEl.click());
    dropzoneEl.setAttribute("role", "button");
    dropzoneEl.setAttribute("tabindex", "0");
    dropzoneEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fileInputEl.click();
      }
    });

    dropzoneEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzoneEl.classList.add("dragover");
    });

    dropzoneEl.addEventListener("dragleave", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzoneEl.classList.remove("dragover");
    });

    dropzoneEl.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzoneEl.classList.remove("dragover");

      this.acceptFiles(Array.from(e.dataTransfer.files), onFilesSelected, dropzoneEl);
    });

    fileInputEl.addEventListener("change", (e) => {
      const files = Array.from(e.target.files);
      e.target.value = ""; // allow re-selecting the same file
      this.acceptFiles(files, onFilesSelected, dropzoneEl);
    });
  }

  // Validate (type, magic bytes, size, count) before any parsing, and tell the user why files were skipped
  async acceptFiles(files, onFilesSelected, dropzoneEl) {
    if (files.length === 0) return;
    const { valid, errors } = await Security.validatePdfFiles(files);
    this.showUploadNotice(dropzoneEl, valid.length, files.length, errors);
    if (valid.length > 0) onFilesSelected(valid);
  }

  showUploadNotice(dropzoneEl, accepted, total, errors) {
    if (!dropzoneEl) return;
    let box = dropzoneEl.parentElement.querySelector(".upload-notice");
    if (errors.length === 0) {
      if (box) box.remove();
      return;
    }
    if (!box) {
      box = document.createElement("div");
      box.className = "upload-notice";
      box.setAttribute("role", "alert");
      dropzoneEl.insertAdjacentElement("afterend", box);
    }
    box.textContent = "";
    const head = document.createElement("strong");
    head.textContent = accepted > 0
      ? `${accepted} of ${total} file(s) accepted. Some were skipped:`
      : "No files were accepted:";
    box.appendChild(head);
    const list = document.createElement("ul");
    errors.slice(0, 8).forEach(msg => {
      const li = document.createElement("li");
      li.textContent = msg;
      list.appendChild(li);
    });
    if (errors.length > 8) {
      const li = document.createElement("li");
      li.textContent = `...and ${errors.length - 8} more.`;
      list.appendChild(li);
    }
    box.appendChild(list);
  }

  // Templates
  bindTemplates() {
    const btnCreate = document.getElementById("btn-create-template");
    const modal = document.getElementById("template-modal");
    const btnClose = document.getElementById("btn-close-modal");
    const btnCancel = document.getElementById("btn-cancel-modal");
    const btnSave = document.getElementById("btn-save-template");

    const btnExport = document.getElementById("btn-export-templates");
    const btnImport = document.getElementById("btn-import-templates");
    const fileImport = document.getElementById("import-templates-file");

    // Hidden file input for sample PDF selection
    const sampleInput = document.createElement("input");
    sampleInput.type = "file";
    sampleInput.accept = ".pdf";
    sampleInput.style.display = "none";
    document.body.appendChild(sampleInput);

    btnCreate.addEventListener("click", () => sampleInput.click());

    sampleInput.addEventListener("change", async (e) => {
      if (e.target.files.length === 0) return;
      const { valid, errors } = await Security.validatePdfFiles([e.target.files[0]]);
      e.target.value = "";
      if (valid.length === 0) {
        alert("Invalid file: " + errors.join("\n"));
        return;
      }
      const buffer = await valid[0].arrayBuffer();
      this.samplePdfBuffer = buffer;

      await this.loadSamplePdfToCanvas(buffer);
      modal.classList.add("active");
    });

    const closeModal = () => modal.classList.remove("active");
    btnClose.addEventListener("click", closeModal);
    btnCancel.addEventListener("click", closeModal);

    btnSave.addEventListener("click", () => {
      const name = document.getElementById("modal-tmpl-name").value.trim();
      const mp = Security.pick(document.getElementById("modal-tmpl-mp").value, Security.MARKETPLACES, "Custom");
      const size = Security.pick(document.getElementById("modal-tmpl-size").value, Security.LABEL_SIZES, "3x5");

      if (!name) {
        alert("Please enter a Template Name.");
        return;
      }

      const cropRect = this.cropCanvas.getCropRect();
      const saved = window.templateManager.addTemplate(name, mp, cropRect, size);
      if (!saved) {
        alert("Could not save template: invalid crop area or template limit reached.");
        return;
      }
      closeModal();
      this.renderTemplates();
      alert(`Template '${saved.name}' saved successfully!`);
    });

    // Modal Crop Presets
    document.getElementById("preset-flipkart")?.addEventListener("click", () => {
      if (this.cropCanvas) this.cropCanvas.setCropRect({ x0: 0.305, y0: 0.034, x1: 0.695, y1: 0.452 });
    });

    document.getElementById("preset-top-half")?.addEventListener("click", () => {
      if (this.cropCanvas) this.cropCanvas.setCropRect({ x0: 0.02, y0: 0.02, x1: 0.98, y1: 0.48 });
    });

    document.getElementById("preset-reset")?.addEventListener("click", () => {
      if (this.cropCanvas) this.cropCanvas.setCropRect({ x0: 0, y0: 0, x1: 1, y1: 1 });
    });

    // Export / Import Templates JSON
    btnExport?.addEventListener("click", () => {
      const templates = window.templateManager.getAll();
      const jsonStr = JSON.stringify(templates, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "shiplabel_templates.json";
      a.click();
      URL.revokeObjectURL(url);
    });

    btnImport?.addEventListener("click", () => fileImport.click());

    fileImport?.addEventListener("change", async (e) => {
      if (e.target.files.length === 0) return;
      try {
        const file = e.target.files[0];
        e.target.value = "";
        if (file.size > Security.MAX_IMPORT_BYTES) {
          alert("Import file too large (max 1 MB).");
          return;
        }
        const imported = JSON.parse(await file.text());
        if (!Array.isArray(imported)) throw new Error("not an array");

        let added = 0;
        imported.slice(0, Security.MAX_TEMPLATES).forEach(t => {
          if (t && window.templateManager.addTemplate(t.name, t.marketplace, t.cropRect, t.labelSize)) added++;
        });
        this.renderTemplates();
        alert(`Imported ${added} of ${imported.length} templates (invalid entries were skipped).`);
      } catch (err) {
        alert("Failed to import templates: Invalid JSON format.");
      }
    });
  }

  async loadSamplePdfToCanvas(arrayBuffer) {
    const canvasEl = document.getElementById("crop-canvas");
    const infoEl = document.getElementById("crop-dimensions-info");

    const updateInfo = (rect) => {
      if (!infoEl) return;
      const wPct = Math.round((rect.x1 - rect.x0) * 100);
      const hPct = Math.round((rect.y1 - rect.y0) * 100);
      infoEl.textContent = `Crop: ${wPct}% width × ${hPct}% height`;
    };

    if (!this.cropCanvas) {
      this.cropCanvas = new CropCanvas(canvasEl, updateInfo);
    }

    try {
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, ...PDFJS_SAFE_OPTS }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.5 });

      canvasEl.width = viewport.width;
      canvasEl.height = viewport.height;

      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = viewport.width;
      tempCanvas.height = viewport.height;
      const tempCtx = tempCanvas.getContext("2d");

      await page.render({ canvasContext: tempCtx, viewport }).promise;

      const img = new Image();
      img.src = tempCanvas.toDataURL();
      img.onload = () => {
        this.cropCanvas.setImage(img);
        // Default crop: Flipkart 3x5 preset
        this.cropCanvas.setCropRect({ x0: 0.305, y0: 0.034, x1: 0.695, y1: 0.452 });
        updateInfo({ x0: 0.305, y0: 0.034, x1: 0.695, y1: 0.452 });
      };
    } catch (e) {
      console.error("Error rendering PDF to canvas:", e);
      alert("Failed to render PDF page. Make sure it's a valid PDF file.");
    }
  }

  renderTemplates() {
    const container = document.getElementById("template-list-container");
    container.textContent = "";
    const templates = window.templateManager.getAll();

    if (templates.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No templates created yet. Click 'Create New Template' to learn a crop area.";
      container.appendChild(empty);
      return;
    }

    templates.forEach(t => {
      const card = document.createElement("div");
      card.className = "tmpl-card";

      const rect = t.cropRect;
      const cropStr = `X: ${(rect.x0*100).toFixed(0)}%..${(rect.x1*100).toFixed(0)}%, Y: ${(rect.y0*100).toFixed(0)}%..${(rect.y1*100).toFixed(0)}%`;

      const top = document.createElement("div");
      const header = document.createElement("div");
      header.className = "tmpl-header";
      const nameEl = document.createElement("span");
      nameEl.className = "tmpl-name";
      nameEl.innerHTML = '<svg class="icon"><use href="#i-crop"/></svg>';
      nameEl.appendChild(document.createTextNode(t.name));
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = t.marketplace;
      header.append(nameEl, badge);
      const details = document.createElement("div");
      details.className = "tmpl-details";
      details.textContent = `Size: ${t.labelSize} • Crop: ${cropStr}`;
      top.append(header, details);

      const actions = document.createElement("div");
      actions.className = "tmpl-actions";
      const del = document.createElement("button");
      del.className = "btn btn-danger btn-sm";
      del.innerHTML = '<svg class="icon icon-sm"><use href="#i-trash"/></svg>';
      del.appendChild(document.createTextNode("Delete"));
      del.addEventListener("click", () => this.deleteTemplate(t.id));
      actions.appendChild(del);

      card.append(top, actions);
      container.appendChild(card);
    });
  }

  deleteTemplate(id) {
    if (confirm("Are you sure you want to delete this template?")) {
      window.templateManager.deleteTemplate(id);
      this.renderTemplates();
    }
  }

  populateTemplateDropdown(selectId) {
    const select = document.getElementById(selectId);
    select.innerHTML = "";
    const templates = window.templateManager.getAll();

    templates.forEach(t => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = `${t.name} (${t.marketplace})`;
      select.appendChild(opt);
    });
  }

  // Process View
  bindProcess() {
    const dropzone = document.getElementById("process-dropzone");
    const fileInput = document.getElementById("process-file-input");
    const statusLabel = document.getElementById("process-file-status");
    const btnSubmit = document.getElementById("btn-process-submit");

    this.setupDropzone(dropzone, fileInput, (files) => {
      this.processFiles = files;
      statusLabel.textContent = `Selected ${files.length} file(s): ` + files.map(f => f.name).join(", ");
      this.autoDetectMarketplace(files[0], "process-template-select", "process-autodetect-badge");
    });

    btnSubmit.addEventListener("click", async () => {
      if (this.processFiles.length === 0) {
        alert("Please select at least one PDF file.");
        return;
      }

      const tmplId = document.getElementById("process-template-select").value;
      const tmpl = window.templateManager.getById(tmplId);
      if (!tmpl) {
        alert("Please select a valid crop template.");
        return;
      }

      const mode = document.getElementById("process-output-mode").value;
      const paperSize = document.getElementById("process-paper-size").value;
      const cutMarks = document.getElementById("process-cut-marks").checked;

      const submitLabel = btnSubmit.innerHTML;
      btnSubmit.disabled = true;
      btnSubmit.textContent = "Processing PDF...";

      try {
        const croppedBuffers = [];
        for (const file of this.processFiles) {
          const buf = await file.arrayBuffer();
          const croppedBytes = await PDFEngine.cropPDF(buf, tmpl.cropRect);
          croppedBuffers.push(croppedBytes);
        }

        let resultBytes, fileExt, mimeType;
        if (mode === "PNG ZIP") {
          resultBytes = await PDFEngine.exportPNGZip(croppedBuffers, Security.safeFilePart(tmpl.marketplace));
          fileExt = "zip";
          mimeType = "application/zip";
        } else if (mode.startsWith("Thermal")) {
          resultBytes = await PDFEngine.exportThermal(croppedBuffers, mode);
          fileExt = "pdf";
          mimeType = "application/pdf";
        } else {
          let rows = 2, cols = 2;
          if (mode.includes("6-up")) {
            rows = 2; cols = 3;
          } else if (mode.includes("2-up")) {
            rows = 2; cols = 1;
          }
          resultBytes = await PDFEngine.exportGrid(croppedBuffers, rows, cols, paperSize, cutMarks);
          fileExt = "pdf";
          mimeType = "application/pdf";
        }

        // Instant Download
        const blob = new Blob([resultBytes], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ShipLabel_${Security.safeFilePart(tmpl.marketplace)}_${this.processFiles.length}_Labels.${fileExt}`;
        a.click();
        URL.revokeObjectURL(url);

        // Record history
        this.addHistoryEntry({
          marketplace: tmpl.marketplace,
          filesCount: this.processFiles.length,
          mode: mode
        });

        alert("Label processing complete! Download started automatically.");
      } catch (err) {
        console.error("Error processing PDFs:", err);
        alert("An error occurred during PDF processing. The file may be corrupted, encrypted or too complex.");
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = submitLabel;
      }
    });
  }

  // Batch View
  bindBatch() {
    const dropzone = document.getElementById("batch-dropzone");
    const fileInput = document.getElementById("batch-file-input");
    const statusLabel = document.getElementById("batch-file-status");
    const btnStart = document.getElementById("btn-batch-start");
    const progressFill = document.getElementById("batch-progress-fill");
    const progressStatus = document.getElementById("batch-progress-status");

    this.setupDropzone(dropzone, fileInput, (files) => {
      this.batchFiles = files;
      statusLabel.textContent = `Loaded ${files.length} file(s) for batch processing.`;
      this.autoDetectMarketplace(files[0], "batch-template-select", "batch-autodetect-badge");
    });

    btnStart.addEventListener("click", async () => {
      if (this.batchFiles.length === 0) {
        alert("Please select PDF files for batch processing.");
        return;
      }

      const tmplId = document.getElementById("batch-template-select").value;
      const tmpl = window.templateManager.getById(tmplId);
      if (!tmpl) {
        alert("Please select a crop template.");
        return;
      }

      const format = document.getElementById("batch-format-select").value;
      btnStart.disabled = true;

      try {
        const croppedBuffers = [];
        const total = this.batchFiles.length;

        for (let i = 0; i < total; i++) {
          const file = this.batchFiles[i];
          const pct = Math.round(((i + 1) / total) * 100);
          progressFill.style.width = `${pct}%`;
          progressStatus.textContent = `Processing file ${i + 1} of ${total}: ${file.name}`;

          const buf = await file.arrayBuffer();
          const croppedBytes = await PDFEngine.cropPDF(buf, tmpl.cropRect);
          croppedBuffers.push(croppedBytes);
        }

        progressStatus.textContent = "Formatting output...";
        let resultBytes, fileExt, mimeType;
        if (format === "PNG ZIP") {
          resultBytes = await PDFEngine.exportPNGZip(croppedBuffers, Security.safeFilePart(tmpl.marketplace));
          fileExt = "zip";
          mimeType = "application/zip";
        } else if (format.startsWith("Thermal")) {
          resultBytes = await PDFEngine.exportThermal(croppedBuffers, format);
          fileExt = "pdf";
          mimeType = "application/pdf";
        } else {
          let rows = 2, cols = 2;
          if (format.includes("6-up")) {
            rows = 2; cols = 3;
          } else if (format.includes("2-up")) {
            rows = 2; cols = 1;
          }
          resultBytes = await PDFEngine.exportGrid(croppedBuffers, rows, cols, "A4", true);
          fileExt = "pdf";
          mimeType = "application/pdf";
        }

        const blob = new Blob([resultBytes], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ShipLabel_Batch_${Security.safeFilePart(tmpl.marketplace)}_${total}_Labels.${fileExt}`;
        a.click();
        URL.revokeObjectURL(url);

        progressStatus.textContent = `Batch processing complete! ${total} files exported.`;

        // Record history
        this.addHistoryEntry({
          marketplace: tmpl.marketplace,
          filesCount: total,
          mode: format
        });

        alert(`Successfully processed ${total} labels! Download initiated.`);
      } catch (err) {
        console.error("Batch processing error:", err);
        alert("Batch processing failed. A file may be corrupted, encrypted or too complex.");
      } finally {
        btnStart.disabled = false;
      }
    });
  }

  // History
  bindHistory() {
    document.getElementById("btn-clear-history")?.addEventListener("click", () => {
      this.clearHistory();
    });
  }

  // Settings
  bindSettings() {
    document.getElementById("btn-save-settings")?.addEventListener("click", () => {
      this.saveSettings();
    });
  }
}

window.app = new App();
