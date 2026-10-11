/**
 * Touch-friendly crop editor. Drag on empty space to draw a box, drag an edge to
 * resize, drag inside to move. Uses Pointer Events (touch, pen, mouse).
 * The rect is normalized 0..1 with Y=0 at the top, same as the web app and desktop.
 */
class CropEditor {
  constructor(canvas, onChange) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.onChange = onChange;
    this.image = null;
    this.rect = null;
    this.drag = null;
    canvas.addEventListener("pointerdown", e => this.down(e));
    canvas.addEventListener("pointermove", e => this.move(e));
    canvas.addEventListener("pointerup", () => this.up());
    canvas.addEventListener("pointercancel", () => this.up());
  }

  setImage(img) {
    this.image = img;
    this.canvas.width = img.width;
    this.canvas.height = img.height;
    this.redraw();
  }
  setRect(r) { this.rect = r ? { ...r } : null; this.redraw(); }
  getRect() { return this.rect ? { ...this.rect } : null; }

  pos(e) {
    const b = this.canvas.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)),
      y: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height))
    };
  }

  /** Touch slop (about 22 CSS px) as a fraction of the displayed width. */
  slop() { return 22 / this.canvas.getBoundingClientRect().width; }

  down(e) {
    if (!this.image) return;
    this.canvas.setPointerCapture(e.pointerId);
    const p = this.pos(e), t = this.slop(), r = this.rect;
    if (r) {
      const inX = p.x > r.x0 - t && p.x < r.x1 + t, inY = p.y > r.y0 - t && p.y < r.y1 + t;
      const edges = {
        l: Math.abs(p.x - r.x0) < t && inY, r: Math.abs(p.x - r.x1) < t && inY,
        t: Math.abs(p.y - r.y0) < t && inX, b: Math.abs(p.y - r.y1) < t && inX
      };
      if (edges.l || edges.r || edges.t || edges.b) { this.drag = { mode: "resize", edges }; return; }
      if (p.x > r.x0 && p.x < r.x1 && p.y > r.y0 && p.y < r.y1) { this.drag = { mode: "move", start: p, orig: { ...r } }; return; }
    }
    this.drag = { mode: "draw", start: p };
    this.rect = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
  }

  move(e) {
    if (!this.drag) return;
    const p = this.pos(e), d = this.drag, r = this.rect, min = 0.02;
    if (d.mode === "draw") {
      r.x0 = Math.min(d.start.x, p.x); r.x1 = Math.max(d.start.x, p.x);
      r.y0 = Math.min(d.start.y, p.y); r.y1 = Math.max(d.start.y, p.y);
    } else if (d.mode === "move") {
      const w = d.orig.x1 - d.orig.x0, hh = d.orig.y1 - d.orig.y0;
      const nx = Math.min(1 - w, Math.max(0, d.orig.x0 + p.x - d.start.x));
      const ny = Math.min(1 - hh, Math.max(0, d.orig.y0 + p.y - d.start.y));
      Object.assign(r, { x0: nx, y0: ny, x1: nx + w, y1: ny + hh });
    } else {
      if (d.edges.l) r.x0 = Math.min(p.x, r.x1 - min);
      if (d.edges.r) r.x1 = Math.max(p.x, r.x0 + min);
      if (d.edges.t) r.y0 = Math.min(p.y, r.y1 - min);
      if (d.edges.b) r.y1 = Math.max(p.y, r.y0 + min);
    }
    this.redraw();
  }

  up() {
    if (this.drag && this.onChange) this.onChange(this.getRect());
    this.drag = null;
  }

  redraw() {
    const { ctx, canvas, image, rect: r } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!image) return;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    if (!r) return;
    const x = r.x0 * canvas.width, y = r.y0 * canvas.height;
    const w = (r.x1 - r.x0) * canvas.width, hh = (r.y1 - r.y0) * canvas.height;
    ctx.fillStyle = "rgba(27,27,57,.45)";
    ctx.fillRect(0, 0, canvas.width, y);
    ctx.fillRect(0, y + hh, canvas.width, canvas.height - y - hh);
    ctx.fillRect(0, y, x, hh);
    ctx.fillRect(x + w, y, canvas.width - x - w, hh);
    ctx.strokeStyle = "#3965fa";
    ctx.lineWidth = Math.max(3, canvas.width / 200);
    ctx.strokeRect(x, y, w, hh);
    ctx.fillStyle = "#3965fa";
    const s = Math.max(10, canvas.width / 45);
    for (const [cx, cy] of [[x, y], [x + w, y], [x, y + hh], [x + w, y + hh]]) ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
  }
}
window.CropEditor = CropEditor;
