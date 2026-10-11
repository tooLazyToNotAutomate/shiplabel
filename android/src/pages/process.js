Pages.process = {
  title: "Process Labels",
  render(root) {
    const s = Settings.load();
    const templates = window.templateManager.getAll();
    let files = [];
    let tmplId = templates[0] && templates[0].id;
    let mode = s.defaultMode, paper = s.paperSize, cutMarks = s.cutMarks;

    const list = h("div", {});
    const input = h("input", { type: "file", accept: "application/pdf,.pdf", multiple: true, hidden: true });
    const errBox = h("p", { class: "muted", role: "alert" });
    const go = h("button", { class: "btn", disabled: true }, "Process & Share");

    const refresh = () => {
      list.replaceChildren(...files.map(f => h("div", { class: "file-item" }, h("span", {}, f.name), h("span", { class: "muted" }, Security.formatBytes(f.size)))));
      go.disabled = files.length === 0;
    };

    input.addEventListener("change", async () => {
      const { valid, errors } = await Security.validatePdfFiles(Array.from(input.files));
      files = files.concat(valid);
      errBox.textContent = errors.join(" ");
      input.value = "";
      refresh();
    });

    go.addEventListener("click", async () => {
      const tmpl = window.templateManager.getById(tmplId);
      if (!tmpl) return Toast.error("Pick a crop template first.");
      go.disabled = true;
      go.textContent = "Processing…";
      try {
        const cropped = [];
        for (const f of files) cropped.push(await PDFEngine.cropPDF(await f.arrayBuffer(), tmpl.cropRect));
        const part = Security.safeFilePart(tmpl.marketplace);
        let bytes, ext, mime;
        if (mode === "PNG ZIP") {
          bytes = await PDFEngine.exportPNGZip(cropped, part); ext = "zip"; mime = "application/zip";
        } else if (mode.startsWith("Thermal")) {
          bytes = await PDFEngine.exportThermal(cropped, mode); ext = "pdf"; mime = "application/pdf";
        } else {
          const rows = 2, cols = mode.includes("6-up") ? 3 : mode.includes("2-up") ? 1 : 2;
          bytes = await PDFEngine.exportGrid(cropped, rows, cols, paper, cutMarks); ext = "pdf"; mime = "application/pdf";
        }
        HistoryLog.add({ marketplace: tmpl.marketplace, filesCount: files.length, mode });
        await Native.saveAndShare(bytes, `ShipLabel_${part}_${files.length}_Labels.${ext}`, mime);
        Toast.ok("Done");
      } catch (err) {
        if (err && /cancel/i.test(String(err.message || err))) return; // share sheet dismissed
        console.error(err);
        Toast.error("Could not process these PDFs. They may be corrupted, encrypted or too complex.");
      } finally {
        go.textContent = "Process & Share";
        go.disabled = files.length === 0;
      }
    });

    root.append(
      h("div", { class: "card stack" },
        h("div", { class: "drop", role: "button", tabindex: "0", onclick: () => input.click() }, "Tap to choose label PDFs"),
        input, list, errBox
      ),
      h("div", { class: "card stack" },
        h("h2", {}, "Options"),
        selectField("Crop template", templates.map(t => ({ value: t.id, label: `${t.name} (${t.marketplace})` })), tmplId, v => (tmplId = v)),
        selectField("Output mode", Security.OUTPUT_MODES, mode, v => (mode = v)),
        selectField("Paper size (A4 grid)", Security.PAPER_SIZES, paper, v => (paper = v)),
        h("label", { class: "switch-row" }, "Draw cut marks",
          h("input", { type: "checkbox", checked: cutMarks, onchange: e => (cutMarks = e.target.checked) }))
      ),
      go
    );
  }
};
