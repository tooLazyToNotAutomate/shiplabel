import tkinter as tk
from PIL import Image, ImageTk
from typing import Optional, Dict, Tuple, Callable
import ui.theme as theme

HANDLE_SIZE = 8

class CropCanvas(tk.Frame):
    """
    Interactive Canvas for viewing PDF pages and drawing/resizing crop area rectangles.
    Calculates normalized (0.0..1.0) coordinates for template saving.
    """

    def __init__(self, master, **kwargs):
        super().__init__(master, bg=theme.COLOR_BG_CARD, **kwargs)

        self.canvas = tk.Canvas(self, bg=theme.COLOR_CANVAS_BG, highlightthickness=0)
        self.canvas.pack(fill=tk.BOTH, expand=True)

        self.pil_image: Optional[Image.Image] = None
        self.tk_image: Optional[ImageTk.PhotoImage] = None

        self.orig_width_pt: float = 1.0
        self.orig_height_pt: float = 1.0

        self.img_x0: float = 0
        self.img_y0: float = 0
        self.img_w: float = 1
        self.img_h: float = 1

        # Crop box coordinates on canvas (pixels relative to image top-left)
        self.rect_x0: Optional[float] = None
        self.rect_y0: Optional[float] = None
        self.rect_x1: Optional[float] = None
        self.rect_y1: Optional[float] = None

        # Drag state
        self.is_drawing: bool = False
        self.is_resizing: bool = False
        self.active_handle: Optional[str] = None
        self.start_x: float = 0
        self.start_y: float = 0

        # Change callback
        self.on_crop_change_callback: Optional[Callable[[Dict[str, float]], None]] = None

        # Bind events
        self.canvas.bind("<Configure>", self._on_canvas_resize)
        self.canvas.bind("<ButtonPress-1>", self._on_button_press)
        self.canvas.bind("<B1-Motion>", self._on_mouse_drag)
        self.canvas.bind("<ButtonRelease-1>", self._on_button_release)

    def load_image(self, pil_img: Image.Image, width_pt: float, height_pt: float):
        self.pil_image = pil_img
        self.orig_width_pt = width_pt
        self.orig_height_pt = height_pt
        self._redraw_image()

    def _redraw_image(self):
        if self.pil_image is None:
            return

        cw = self.canvas.winfo_width()
        ch = self.canvas.winfo_height()
        if cw <= 10 or ch <= 10:
            return

        # Fit image inside canvas preserving aspect ratio
        img_w, img_h = self.pil_image.size
        aspect = img_w / img_h

        if cw / ch > aspect:
            display_h = ch - 20
            display_w = int(display_h * aspect)
        else:
            display_w = cw - 20
            display_h = int(display_w / aspect)

        display_w = max(display_w, 50)
        display_h = max(display_h, 50)

        resized = self.pil_image.resize((display_w, display_h), Image.Resampling.LANCZOS)
        self.tk_image = ImageTk.PhotoImage(resized)

        self.canvas.delete("all")
        self.img_x0 = (cw - display_w) / 2
        self.img_y0 = (ch - display_h) / 2
        self.img_w = display_w
        self.img_h = display_h

        self.canvas.create_image(self.img_x0, self.img_y0, anchor=tk.NW, image=self.tk_image)
        self._draw_crop_box()

    def _on_canvas_resize(self, event):
        self._redraw_image()

    def _draw_crop_box(self):
        self.canvas.delete("crop_element")
        if self.rect_x0 is None or self.rect_y0 is None or self.rect_x1 is None or self.rect_y1 is None:
            return

        abs_x0 = self.img_x0 + self.rect_x0
        abs_y0 = self.img_y0 + self.rect_y0
        abs_x1 = self.img_x0 + self.rect_x1
        abs_y1 = self.img_y0 + self.rect_y1

        # Draw semi-transparent rectangle outline
        self.canvas.create_rectangle(
            abs_x0, abs_y0, abs_x1, abs_y1,
            outline=theme.COLOR_CROP_BOX, width=2, tags="crop_element"
        )

        # Handles (NW, NE, SE, SW)
        handles = {
            "nw": (abs_x0, abs_y0),
            "ne": (abs_x1, abs_y0),
            "se": (abs_x1, abs_y1),
            "sw": (abs_x0, abs_y1),
        }
        for h_name, (hx, hy) in handles.items():
            self.canvas.create_rectangle(
                hx - HANDLE_SIZE // 2, hy - HANDLE_SIZE // 2,
                hx + HANDLE_SIZE // 2, hy + HANDLE_SIZE // 2,
                fill=theme.COLOR_HANDLE, outline="#FFFFFF", tags=("crop_element", f"handle_{h_name}")
            )

    def _on_button_press(self, event):
        if self.pil_image is None:
            return

        cx, cy = event.x, event.y
        rel_x = cx - self.img_x0
        rel_y = cy - self.img_y0

        # Check if clicking on handle
        if self.rect_x0 is not None:
            abs_x0 = self.img_x0 + self.rect_x0
            abs_y0 = self.img_y0 + self.rect_y0
            abs_x1 = self.img_x0 + self.rect_x1
            abs_y1 = self.img_y0 + self.rect_y1

            handles = {
                "nw": (abs_x0, abs_y0),
                "ne": (abs_x1, abs_y0),
                "se": (abs_x1, abs_y1),
                "sw": (abs_x0, abs_y1),
            }
            for h_name, (hx, hy) in handles.items():
                if abs(cx - hx) <= HANDLE_SIZE and abs(cy - hy) <= HANDLE_SIZE:
                    self.is_resizing = True
                    self.active_handle = h_name
                    return

        # Start drawing new box inside image bounds
        if 0 <= rel_x <= self.img_w and 0 <= rel_y <= self.img_h:
            self.is_drawing = True
            self.rect_x0 = rel_x
            self.rect_y0 = rel_y
            self.rect_x1 = rel_x
            self.rect_y1 = rel_y
            self._draw_crop_box()

    def _on_mouse_drag(self, event):
        if self.pil_image is None:
            return

        rel_x = max(0, min(self.img_w, event.x - self.img_x0))
        rel_y = max(0, min(self.img_h, event.y - self.img_y0))

        if self.is_drawing:
            self.rect_x1 = rel_x
            self.rect_y1 = rel_y
            self._draw_crop_box()
        elif self.is_resizing and self.active_handle:
            if "w" in self.active_handle:
                self.rect_x0 = rel_x
            if "e" in self.active_handle:
                self.rect_x1 = rel_x
            if "n" in self.active_handle:
                self.rect_y0 = rel_y
            if "s" in self.active_handle:
                self.rect_y1 = rel_y
            self._draw_crop_box()

    def _on_button_release(self, event):
        if self.is_drawing or self.is_resizing:
            self.is_drawing = False
            self.is_resizing = False
            self.active_handle = None

            # Normalize min/max
            if self.rect_x0 is not None and self.rect_x1 is not None:
                x0, x1 = min(self.rect_x0, self.rect_x1), max(self.rect_x0, self.rect_x1)
                y0, y1 = min(self.rect_y0, self.rect_y1), max(self.rect_y0, self.rect_y1)
                self.rect_x0, self.rect_x1 = x0, x1
                self.rect_y0, self.rect_y1 = y0, y1

            self._draw_crop_box()

            if self.on_crop_change_callback:
                self.on_crop_change_callback(self.get_normalized_crop_rect())

    def get_normalized_crop_rect(self) -> Dict[str, float]:
        """
        Returns normalized coordinates (0.0 to 1.0) relative to page bounds.
        """
        if self.rect_x0 is None or self.img_w == 0 or self.img_h == 0:
            return {"x0": 0.0, "y0": 0.0, "x1": 1.0, "y1": 1.0}

        return {
            "x0": max(0.0, min(1.0, self.rect_x0 / self.img_w)),
            "y0": max(0.0, min(1.0, self.rect_y0 / self.img_h)),
            "x1": max(0.0, min(1.0, self.rect_x1 / self.img_w)),
            "y1": max(0.0, min(1.0, self.rect_y1 / self.img_h)),
        }

    def set_normalized_crop_rect(self, norm_rect: Dict[str, float]):
        """
        Sets crop box from normalized rect.
        """
        if self.img_w > 0 and self.img_h > 0:
            self.rect_x0 = norm_rect.get("x0", 0.0) * self.img_w
            self.rect_y0 = norm_rect.get("y0", 0.0) * self.img_h
            self.rect_x1 = norm_rect.get("x1", 1.0) * self.img_w
            self.rect_y1 = norm_rect.get("y1", 1.0) * self.img_h
            self._draw_crop_box()
