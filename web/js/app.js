/**
 * App: Controller for TrimLabel Web Studio.
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
    this.bindProcess();
    this.bindBatch();
    this.bindHistory();
    this.bindSettings();

    this.renderHistory();
  }

  // Settings Storage
  loadSettings() {
    try {
      const stored = Security.storageGet("trimlabel_settings");
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

    this.applySettingsToControls();
  }

  // Push the saved defaults into the Settings form, the Process form and the Batch form
  applySettingsToControls() {
    const set = (id, prop, value) => {
      const el = document.getElementById(id);
      if (el) el[prop] = value;
    };
    set("setting-default-paper", "value", this.settings.defaultPaper);
    set("setting-default-mode", "value", this.settings.defaultMode);
    set("setting-cut-marks", "checked", this.settings.cutMarks);
    set("setting-autodetect", "checked", this.settings.autoDetect);

    set("process-paper-size", "value", this.settings.defaultPaper);
    set("process-output-mode", "value", this.settings.defaultMode);
    set("process-cut-marks", "checked", this.settings.cutMarks);

    set("batch-format-select", "value", this.settings.defaultMode);
  }

  saveSettings(silent = false) {
    this.settings.defaultPaper = document.getElementById("setting-default-paper").value;
    this.settings.defaultMode = document.getElementById("setting-default-mode").value;
    this.settings.cutMarks = document.getElementById("setting-cut-marks").checked;
    this.settings.autoDetect = document.getElementById("setting-autodetect").checked;

    this.settings.defaultPaper = Security.pick(this.settings.defaultPaper, Security.PAPER_SIZES, "A4");
    this.settings.defaultMode = Security.pick(this.settings.defaultMode, Security.OUTPUT_MODES, "A4 Sheet (4-up Grid)");
    const ok = Security.storageSet("trimlabel_settings", JSON.stringify(this.settings));
    this.applySettingsToControls();
    if (!ok) alert("Could not save settings (browser storage unavailable).");
    else if (!silent) this.showSettingsSaved();
  }

  showSettingsSaved() {
    const note = document.getElementById("settings-saved-note");
    if (!note) return;
    note.textContent = "Saved. New defaults are applied to Process and Batch.";
    clearTimeout(this._savedTimer);
    this._savedTimer = setTimeout(() => (note.textContent = ""), 3000);
  }

  // History Storage
  loadHistory() {
    try {
      const stored = Security.storageGet("trimlabel_history");
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
    Security.storageSet("trimlabel_history", JSON.stringify(this.history));
    this.renderHistory();
  }

  clearHistory() {
    if (confirm("Clear all processing history?")) {
      this.history = [];
      Security.storageRemove("trimlabel_history");
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

    if (viewName === "process") {
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
        a.download = `TrimLabel_${Security.safeFilePart(tmpl.marketplace)}_${this.processFiles.length}_Labels.${fileExt}`;
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
          resultBytes = await PDFEngine.exportGrid(croppedBuffers, rows, cols, this.settings.defaultPaper, this.settings.cutMarks);
          fileExt = "pdf";
          mimeType = "application/pdf";
        }

        const blob = new Blob([resultBytes], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `TrimLabel_Batch_${Security.safeFilePart(tmpl.marketplace)}_${total}_Labels.${fileExt}`;
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
    // Save as soon as an option changes, so ticking/unticking never needs the button
    ["setting-default-paper", "setting-default-mode", "setting-cut-marks", "setting-autodetect"].forEach(id => {
      document.getElementById(id)?.addEventListener("change", () => this.saveSettings());
    });
  }
}

window.app = new App();
