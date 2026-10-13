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

    this.settings = {
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

  // Push the saved defaults into the Settings form, the Print Labels form
  applySettingsToControls() {
    const set = (id, prop, value) => {
      const el = document.getElementById(id);
      if (el) el[prop] = value;
    };
    set("setting-default-mode", "value", this.settings.defaultMode);
    set("setting-cut-marks", "checked", this.settings.cutMarks);
    set("setting-autodetect", "checked", this.settings.autoDetect);

    set("process-cut-marks", "checked", this.settings.cutMarks);
    this.setRadio("process-layout", this.settings.defaultMode);
  }

  setRadio(name, value) {
    document.querySelectorAll(`input[name="${name}"]`).forEach(r => { r.checked = r.value === value; });
  }

  getRadio(name, fallback) {
    const r = document.querySelector(`input[name="${name}"]:checked`);
    return r ? r.value : fallback;
  }

  saveSettings(silent = false) {
    this.settings.defaultMode = document.getElementById("setting-default-mode").value;
    this.settings.cutMarks = document.getElementById("setting-cut-marks").checked;
    this.settings.autoDetect = document.getElementById("setting-autodetect").checked;

    this.settings.defaultMode = Security.pick(this.settings.defaultMode, Security.OUTPUT_MODES, "A4 Sheet (4-up Grid)");
    const ok = Security.storageSet("trimlabel_settings", JSON.stringify(this.settings));
    this.applySettingsToControls();
    if (!ok) alert("Could not save settings (browser storage unavailable).");
    else if (!silent) this.showSettingsSaved();
  }

  showSettingsSaved() {
    const note = document.getElementById("settings-saved-note");
    if (!note) return;
    note.textContent = "Saved. New defaults are applied to Print Labels.";
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
      btn.addEventListener("click", (e) => { e.preventDefault(); this.switchView(btn.getAttribute("data-goto")); });
    });

    document.querySelectorAll("[data-scroll]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById(btn.getAttribute("data-scroll"))?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
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
          badge.style.display = "flex";
          const text = document.getElementById("process-autodetect-text");
          if (text) text.textContent = `We recognised ${detectedMp} labels and picked the right style for you.`;
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

  // Print Labels view (handles one file or hundreds)
  bindProcess() {
    const dropzone = document.getElementById("process-dropzone");
    const fileInput = document.getElementById("process-file-input");
    const btnSubmit = document.getElementById("btn-process-submit");

    this.setupDropzone(dropzone, fileInput, (files) => {
      const key = f => `${f.name}|${f.size}|${f.lastModified}`;
      const have = new Set(this.processFiles.map(key));
      files.forEach(f => { if (!have.has(key(f))) { this.processFiles.push(f); have.add(key(f)); } });
      this.processFiles = this.processFiles.slice(0, Security.MAX_FILES);
      this.renderProcessFiles();
      if (this.processFiles.length === files.length) {
        this.autoDetectMarketplace(files[0], "process-template-select", "process-autodetect-badge");
      }
    });

    document.querySelectorAll('input[name="process-layout"]').forEach(r => {
      r.addEventListener("change", () => this.updateProcessSummary());
    });
    this.renderProcessFiles();
    document.getElementById("btn-detect-change")?.addEventListener("click", () => document.getElementById("process-template-select")?.focus());

    btnSubmit.addEventListener("click", async () => {
      if (this.processFiles.length === 0) {
        alert("Please add at least one PDF file.");
        return;
      }

      const tmplId = document.getElementById("process-template-select").value;
      const tmpl = window.templateManager.getById(tmplId);
      if (!tmpl) {
        alert("Please select a valid label type.");
        return;
      }

      const mode = Security.pick(this.getRadio("process-layout", this.settings.defaultMode), Security.OUTPUT_MODES, "A4 Sheet (4-up Grid)");
      const cutMarks = document.getElementById("process-cut-marks").checked;
      const total = this.processFiles.length;

      const submitLabel = btnSubmit.innerHTML;
      btnSubmit.disabled = true;

      try {
        const croppedBuffers = [];
        for (let i = 0; i < total; i++) {
          btnSubmit.textContent = total > 1 ? `Processing ${i + 1} of ${total}...` : "Processing PDF...";
          const buf = await this.processFiles[i].arrayBuffer();
          croppedBuffers.push(await PDFEngine.cropPDF(buf, tmpl.cropRect));
        }
        btnSubmit.textContent = "Formatting output...";

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
          resultBytes = await PDFEngine.exportGrid(croppedBuffers, rows, cols, "A4", cutMarks);
          fileExt = "pdf";
          mimeType = "application/pdf";
        }

        const blob = new Blob([resultBytes], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `TrimLabel_${Security.safeFilePart(tmpl.marketplace)}_${total}_Labels.${fileExt}`;
        a.click();
        URL.revokeObjectURL(url);

        this.addHistoryEntry({ marketplace: tmpl.marketplace, filesCount: total, mode });
        alert("Your print file is ready. The download has started.");
      } catch (err) {
        console.error("Error processing PDFs:", err);
        alert("An error occurred during PDF processing. The file may be corrupted, encrypted or too complex.");
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = submitLabel;
      }
    });
  }

  renderProcessFiles() {
    const list = document.getElementById("process-file-list");
    const status = document.getElementById("process-file-status");
    if (!list) return;
    list.textContent = "";
    this.processFiles.forEach((file, idx) => {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.className = "file-name";
      name.textContent = file.name;
      const size = document.createElement("span");
      size.className = "file-size";
      size.textContent = file._labels ? `${file._labels} label${file._labels === 1 ? "" : "s"}` : "…";
      const ico = document.createElement("span");
      ico.className = "file-ico";
      ico.innerHTML = '<svg class="icon icon-sm"><use href="#i-files"/></svg>';
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "file-remove";
      rm.setAttribute("aria-label", `Remove ${file.name}`);
      rm.innerHTML = '<svg class="icon icon-sm"><use href="#i-x"/></svg>';
      rm.addEventListener("click", () => {
        this.processFiles.splice(idx, 1);
        this.renderProcessFiles();
      });
      li.append(ico, name, size, rm);
      list.appendChild(li);
    });
    const n = this.processFiles.length;
    if (status) {
      status.textContent = n === 0 ? "No files selected" : `${n} file${n === 1 ? "" : "s"} ready`;
      if (n === 0) {
        const badge = document.getElementById("process-autodetect-badge");
        if (badge) badge.style.display = "none";
      }
    }
    this.updateProcessSummary();
  }

  // Count the labels (pages) in each added file in the background, then refresh the totals
  countLabels(file) {
    if (file._labels !== undefined || file._counting) return;
    file._counting = true;
    file.arrayBuffer()
      .then(buf => pdfjsLib.getDocument({ data: buf, ...PDFJS_SAFE_OPTS }).promise)
      .then(pdf => { file._labels = pdf.numPages; pdf.destroy && pdf.destroy(); })
      .catch(() => { file._labels = 1; })
      .finally(() => { file._counting = false; this.updateProcessSummary(); });
  }

  updateProcessSummary() {
    const labelsEl = document.getElementById("sum-labels");
    if (!labelsEl) return;
    this.processFiles.forEach(f => this.countLabels(f));
    const labels = this.processFiles.reduce((n, f) => n + (f._labels || 0), 0);
    const mode = this.getRadio("process-layout", this.settings.defaultMode);
    let out, unit;
    if (mode === "PNG ZIP") { out = labels; unit = labels === 1 ? "image" : "images"; }
    else if (mode.startsWith("Thermal")) { out = labels; unit = labels === 1 ? "page" : "pages"; }
    else {
      const per = mode.includes("6-up") ? 6 : mode.includes("2-up") ? 2 : 4;
      out = Math.ceil(labels / per);
      unit = out === 1 ? "sheet" : "sheets";
      unit = `A4 ${unit}`;
    }
    labelsEl.textContent = labels;
    document.getElementById("sum-out").textContent = out;
    document.getElementById("sum-out-label").textContent = unit;
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
    ["setting-default-mode", "setting-cut-marks", "setting-autodetect"].forEach(id => {
      document.getElementById(id)?.addEventListener("change", () => this.saveSettings());
    });
  }
}

window.app = new App();
