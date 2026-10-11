/**
 * CropCanvas: HTML5 Canvas widget for interactive template crop rectangle drawing & resizing.
 */

class CropCanvas {
  constructor(canvasElement, onCropChange) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.onCropChange = onCropChange;

    this.image = null;
    this.cropRect = null; // { x0, y0, x1, y1 } normalized 0..1

    this.isDrawing = false;
    this.isResizing = false;
    this.activeHandle = null;

    this.startPos = { x: 0, y: 0 };
    this.handleSize = 8;

    this.bindEvents();
  }

  setImage(imgElement) {
    this.image = imgElement;
    this.cropRect = null;
    this.redraw();
  }

  setCropRect(normRect) {
    this.cropRect = normRect;
    this.redraw();
  }

  getCropRect() {
    return this.cropRect || { x0: 0, y0: 0, x1: 1, y1: 1 };
  }

  bindEvents() {
    this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
  }

  getCanvasCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  onMouseDown(e) {
    if (!this.image) return;
    const pos = this.getCanvasCoords(e);

    // Check handle click if rect exists
    if (this.cropRect) {
      const handles = this.getHandleCoords();
      for (const [name, h] of Object.entries(handles)) {
        if (Math.abs(pos.x - h.x) <= this.handleSize && Math.abs(pos.y - h.y) <= this.handleSize) {
          this.isResizing = true;
          this.activeHandle = name;
          return;
        }
      }
    }

    // Start drawing new rectangle
    this.isDrawing = true;
    const normX = pos.x / this.canvas.width;
    const normY = pos.y / this.canvas.height;
    this.cropRect = { x0: normX, y0: normY, x1: normX, y1: normY };
    this.redraw();
  }

  onMouseMove(e) {
    if (!this.image || (!this.isDrawing && !this.isResizing)) return;
    const pos = this.getCanvasCoords(e);
    const normX = Math.max(0, Math.min(1, pos.x / this.canvas.width));
    const normY = Math.max(0, Math.min(1, pos.y / this.canvas.height));

    if (this.isDrawing) {
      this.cropRect.x1 = normX;
      this.cropRect.y1 = normY;
      this.redraw();
    } else if (this.isResizing && this.activeHandle) {
      if (this.activeHandle.includes('w')) this.cropRect.x0 = normX;
      if (this.activeHandle.includes('e')) this.cropRect.x1 = normX;
      if (this.activeHandle.includes('n')) this.cropRect.y0 = normY;
      if (this.activeHandle.includes('s')) this.cropRect.y1 = normY;
      this.redraw();
    }
  }

  onMouseUp() {
    if (this.isDrawing || this.isResizing) {
      this.isDrawing = false;
      this.isResizing = false;
      this.activeHandle = null;

      // Normalize min/max
      if (this.cropRect) {
        const x0 = Math.min(this.cropRect.x0, this.cropRect.x1);
        const x1 = Math.max(this.cropRect.x0, this.cropRect.x1);
        const y0 = Math.min(this.cropRect.y0, this.cropRect.y1);
        const y1 = Math.max(this.cropRect.y0, this.cropRect.y1);
        this.cropRect = { x0, y0, x1, y1 };
      }

      this.redraw();
      if (this.onCropChange) this.onCropChange(this.cropRect);
    }
  }

  getHandleCoords() {
    if (!this.cropRect) return {};
    const x0 = this.cropRect.x0 * this.canvas.width;
    const y0 = this.cropRect.y0 * this.canvas.height;
    const x1 = this.cropRect.x1 * this.canvas.width;
    const y1 = this.cropRect.y1 * this.canvas.height;

    return {
      nw: { x: x0, y: y0 },
      ne: { x: x1, y: y0 },
      se: { x: x1, y: y1 },
      sw: { x: x0, y: y1 }
    };
  }

  redraw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.image) {
      this.ctx.drawImage(this.image, 0, 0, this.canvas.width, this.canvas.height);
    }

    if (!this.cropRect) return;

    const x0 = this.cropRect.x0 * this.canvas.width;
    const y0 = this.cropRect.y0 * this.canvas.height;
    const x1 = this.cropRect.x1 * this.canvas.width;
    const y1 = this.cropRect.y1 * this.canvas.height;

    const w = x1 - x0;
    const h = y1 - y0;

    // Draw translucent highlight overlay
    this.ctx.fillStyle = 'rgba(57, 101, 250, 0.18)';
    this.ctx.fillRect(x0, y0, w, h);

    // Draw border line
    this.ctx.strokeStyle = '#3965fa';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x0, y0, w, h);

    // Draw handles
    const handles = this.getHandleCoords();
    this.ctx.fillStyle = '#1b1b39';
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1;

    for (const pos of Object.values(handles)) {
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
    }
  }
}

window.CropCanvas = CropCanvas;
