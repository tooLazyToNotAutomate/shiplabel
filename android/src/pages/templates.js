const PDFJS_SAFE_OPTS = { isEvalSupported: false, enableXfa: false };

/** Render page 1 of a PDF to an <img>-like canvas source for the crop editor. */
async function renderFirstPage(file) {
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer(), ...PDFJS_SAFE_OPTS }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  return canvas;
}

Pages.templates = {
  title: "Templates",
  render(root) {
    const tm = window.templateManager;
    const listCard = h("div", { class: "card" });
    const editor = h("div", {});

    const drawList = () => {
      listCard.replaceChildren(
        h("h2", {}, "Saved templates"),
        ...tm.getAll().map(t => h("div", { class: "file-item" },
          h("span", {}, t.name, " ", h("span", { class: "badge" }, t.marketplace)),
          h("button", { class: "btn danger small", onclick: () => {
            if (tm.getAll().length <= 1) return Toast.error("Keep at least one template.");
            if (confirm(`Delete "${t.name}"?`)) { tm.deleteTemplate(t.id); drawList(); }
          } }, "Delete")))
      );
    };

    const input = h("input", { type: "file", accept: "application/pdf,.pdf", hidden: true });
    input.addEventListener("change", async () => {
      const { valid, errors } = await Security.validatePdfFiles(Array.from(input.files).slice(0, 1));
      input.value = "";
      if (!valid.length) return Toast.error(errors[0] || "That file could not be used.");
      let canvas;
      try { canvas = await renderFirstPage(valid[0]); } catch (e) { return Toast.error("Could not open that PDF."); }

      const canvasEl = h("canvas", {});
      const crop = new CropEditor(canvasEl, () => {});
      crop.setImage(canvas);
      crop.setRect({ x0: 0.1, y0: 0.05, x1: 0.9, y1: 0.45 });
      let name = "", marketplace = "Custom", size = "3x5";
      const nameInput = h("input", { type: "text", maxlength: "60", placeholder: "e.g. Meesho small", oninput: e => (name = e.target.value) });
      editor.replaceChildren(h("div", { class: "card stack" },
        h("h2", {}, "Draw the label area"),
        h("p", { class: "muted" }, "Drag to draw, drag edges to resize, drag inside to move."),
        h("div", { class: "crop-wrap" }, canvasEl),
        h("label", { class: "field" }, "Template name", nameInput),
        selectField("Marketplace", Security.MARKETPLACES, marketplace, v => (marketplace = v)),
        selectField("Label size", Security.LABEL_SIZES, size, v => (size = v)),
        h("button", { class: "btn", onclick: () => {
          const saved = tm.addTemplate(name, marketplace, crop.getRect(), size);
          if (!saved) return Toast.error("Enter a name and draw a valid crop box.");
          editor.replaceChildren(); drawList(); Toast.ok("Template saved");
        } }, "Save template"),
        h("button", { class: "btn secondary", onclick: () => editor.replaceChildren() }, "Cancel")
      ));
    });

    drawList();
    root.append(
      h("button", { class: "btn", onclick: () => input.click() }, "+ New template from sample PDF"),
      input,
      h("div", { style: "height:14px" }),
      editor,
      listCard
    );
  }
};
