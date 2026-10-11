/**
 * TemplateManager: stores and manages crop templates in browser localStorage.
 *
 * Crop coordinates are NORMALIZED (0.0 to 1.0) in SCREEN coords (Y=0 is TOP of page).
 *
 * Flipkart label analysis (from invoice_labels_1785611291883.pdf, page size 595x842):
 *   - Label content occupies x=32%–68% of page width (rest is blank margin)
 *   - Label header (STD, AWB, QR):       screen y = 0.034
 *   - "Not for resale. Printed at..."    screen y = 0.437 (y_pt = 367.9)
 *   - Dotted separator line:             screen y ≈ 0.457 (y_pt = 385)
 *   - Tax Invoice starts:                screen y = 0.465 (y_pt = 392)
 *
 * So for Flipkart: x0=0.305 x1=0.695 captures content only (no blank side margins).
 * y1 = 0.452 cleanly cuts off above the dotted line, isolating the 3x5 label only.
 * Tight crop yields a portrait label (~214x352 pt, aspect 0.61) which tiles MUCH
 * better on A4 paper than the wide-margin crop (571x364 pt, aspect 1.57) that was
 * including ~350pt of blank side whitespace.
 */


const DEFAULT_TEMPLATES = [
  {
    id: "flipkart-3x5-default",
    name: "Flipkart 3x5 Thermal",
    marketplace: "Flipkart",
    cropRect: { x0: 0.305, y0: 0.034, x1: 0.695, y1: 0.452 },
    labelSize: "3x5",
    createdAt: new Date().toISOString()
  },
  {
    id: "meesho-thermal-default",
    name: "Meesho Thermal",
    marketplace: "Meesho",
    cropRect: { x0: 0.02, y0: 0.02, x1: 0.98, y1: 0.46 },
    labelSize: "3x5",
    createdAt: new Date().toISOString()
  },
  {
    id: "amazon-a6-default",
    name: "Amazon A6 Label",
    marketplace: "Amazon",
    cropRect: { x0: 0.02, y0: 0.02, x1: 0.98, y1: 0.46 },
    labelSize: "A6",
    createdAt: new Date().toISOString()
  },
  {
    id: "shiprocket-thermal-default",
    name: "Shiprocket Thermal",
    marketplace: "Shiprocket",
    cropRect: { x0: 0.02, y0: 0.02, x1: 0.98, y1: 0.46 },
    labelSize: "3x5",
    createdAt: new Date().toISOString()
  }
];

class TemplateManager {
  constructor() {
    this.storageKey = "shiplabel_templates_v3"; // v3: tightened Flipkart x-crop to remove blank side margins
    this.templates = [];
    this.init();
  }

  init() {
    const stored = Security.storageGet(this.storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) throw new Error("not an array");
        // Never trust stored data: re-validate every template
        this.templates = parsed.slice(0, Security.MAX_TEMPLATES).map(t => {
          const clean = Security.sanitizeTemplate(t);
          if (clean && !clean.id) clean.id = this.newId();
          return clean;
        }).filter(Boolean);
        if (this.templates.length === 0) throw new Error("no valid templates");
      } catch (e) {
        console.error("Template parse error:", e);
        this.templates = DEFAULT_TEMPLATES.map(t => ({ ...t }));
        this.save();
      }
    } else {
      // Fresh install or version bump — load updated defaults
      this.templates = DEFAULT_TEMPLATES.map(t => ({ ...t }));
      this.save();
    }
  }

  newId() {
    const rand = (window.crypto && crypto.getRandomValues)
      ? Array.from(crypto.getRandomValues(new Uint8Array(6)), b => b.toString(16).padStart(2, "0")).join("")
      : Math.random().toString(16).slice(2, 14);
    return "tmpl_" + Date.now() + "_" + rand;
  }

  save() {
    Security.storageSet(this.storageKey, JSON.stringify(this.templates));
  }

  getAll() {
    return this.templates;
  }

  getById(id) {
    return this.templates.find(t => t.id === id);
  }

  addTemplate(name, marketplace, cropRect, labelSize = "3x5") {
    if (this.templates.length >= Security.MAX_TEMPLATES) return null;
    const clean = Security.sanitizeTemplate({ name, marketplace, cropRect, labelSize });
    if (!clean) return null;
    clean.id = this.newId();
    this.templates.push(clean);
    this.save();
    return clean;
  }

  deleteTemplate(id) {
    this.templates = this.templates.filter(t => t.id !== id);
    this.save();
  }
}

window.templateManager = new TemplateManager();
