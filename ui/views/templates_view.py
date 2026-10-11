import customtkinter as ctk
import tkinter as tk
from tkinter import filedialog, messagebox
import os
from typing import Optional
from core.template_manager import TemplateManager, Template
from core.pdf_engine import PDFEngine
from ui.widgets.crop_canvas import CropCanvas
import ui.theme as theme

class TemplatesView(ctk.CTkFrame):
    """
    Template Management View: Allows learning and saving custom crop templates.
    """

    def __init__(self, master, template_manager: TemplateManager, **kwargs):
        super().__init__(master, fg_color=theme.COLOR_BG_MAIN, **kwargs)
        self.template_manager = template_manager

        # Top Bar
        self.top_bar = ctk.CTkFrame(self, fg_color="transparent")
        self.top_bar.pack(fill="x", padx=24, pady=(20, 10))

        self.title_label = ctk.CTkLabel(
            self.top_bar,
            text="Template Manager (Learn System)",
            font=(theme.FONT_FAMILY, 22, "bold"),
            text_color=theme.COLOR_TEXT_PRIMARY
        )
        self.title_label.pack(side="left")

        self.btn_create = ctk.CTkButton(
            self.top_bar,
            text="Create New Template",
            fg_color=theme.COLOR_PRIMARY,
            hover_color=theme.COLOR_PRIMARY_HOVER,
            font=(theme.FONT_FAMILY, 12, "bold"),
            corner_radius=6,
            height=36,
            command=self._open_create_template_dialog
        )
        self.btn_create.pack(side="right")

        # Scrollable list of templates
        self.scroll_frame = ctk.CTkScrollableFrame(
            self,
            fg_color="transparent"
        )
        self.scroll_frame.pack(fill="both", expand=True, padx=24, pady=10)

        self.refresh_templates()

    def refresh_templates(self):
        # Clear existing
        for child in self.scroll_frame.winfo_children():
            child.destroy()

        templates = self.template_manager.get_all_templates()

        if not templates:
            empty_lbl = ctk.CTkLabel(
                self.scroll_frame,
                text="No templates created yet. Click '+ Create New Template' to open a sample PDF and draw a crop rectangle.",
                font=(theme.FONT_FAMILY, 13),
                text_color=theme.COLOR_TEXT_MUTED
            )
            empty_lbl.pack(pady=40)
            return

        for tmpl in templates:
            self._render_template_card(tmpl)

    def _render_template_card(self, tmpl: Template):
        card = ctk.CTkFrame(
            self.scroll_frame,
            fg_color=theme.COLOR_BG_CARD,
            border_color=theme.COLOR_BORDER,
            border_width=1,
            corner_radius=8
        )
        card.pack(fill="x", pady=6)

        left_info = ctk.CTkFrame(card, fg_color="transparent")
        left_info.pack(side="left", padx=16, pady=14)

        t_name = ctk.CTkLabel(
            left_info,
            text=f"📐 {tmpl.name}",
            font=(theme.FONT_FAMILY, 14, "bold"),
            text_color=theme.COLOR_TEXT_PRIMARY
        )
        t_name.pack(anchor="w")

        r_info = tmpl.crop_rect
        rect_desc = f"Crop: X({r_info['x0']:.2f}..{r_info['x1']:.2f}), Y({r_info['y0']:.2f}..{r_info['y1']:.2f})"
        meta = f"Marketplace: {tmpl.marketplace}  •  Page: {int(tmpl.page_width)}x{int(tmpl.page_height)} pt  •  {rect_desc}"
        
        t_meta = ctk.CTkLabel(
            left_info,
            text=meta,
            font=(theme.FONT_FAMILY, 11),
            text_color=theme.COLOR_TEXT_SECONDARY
        )
        t_meta.pack(anchor="w", pady=(2, 0))

        # Actions
        btn_del = ctk.CTkButton(
            card,
            text="Delete",
            fg_color=theme.COLOR_DANGER_BG,
            text_color=theme.COLOR_DANGER,
            hover_color=theme.COLOR_DANGER_HOVER,
            width=80,
            height=30,
            font=(theme.FONT_FAMILY, 11, "bold"),
            corner_radius=6,
            command=lambda tid=tmpl.id: self._delete_template(tid)
        )
        btn_del.pack(side="right", padx=16)

    def _delete_template(self, tmpl_id: str):
        if messagebox.askyesno("Delete Template", "Are you sure you want to delete this template?"):
            self.template_manager.delete_template(tmpl_id)
            self.refresh_templates()

    def _open_create_template_dialog(self):
        pdf_path = filedialog.askopenfilename(
            title="Select Sample PDF to Learn Crop Template",
            filetypes=[("PDF Files", "*.pdf")]
        )
        if not pdf_path:
            return

        try:
            pil_img, width_pt, height_pt = PDFEngine.render_page_to_pil(pdf_path, page_num=0, dpi=150)
        except Exception as e:
            messagebox.showerror("Error Opening PDF", f"Failed to render sample PDF page:\n{e}")
            return

        # Create Toplevel Wizard Window
        dlg = ctk.CTkToplevel(self)
        dlg.title("Learn New Template — ShipLabel")
        dlg.geometry("960x700")
        dlg.grab_set()
        dlg.configure(fg_color=theme.COLOR_BG_MAIN)

        # Top Control Frame
        form_frame = ctk.CTkFrame(dlg, fg_color=theme.COLOR_BG_CARD, border_color=theme.COLOR_BORDER, border_width=1, corner_radius=8)
        form_frame.pack(fill="x", padx=16, pady=12)

        # Form Inputs
        ctk.CTkLabel(form_frame, text="Template Name:", font=(theme.FONT_FAMILY, 12, "bold")).grid(row=0, column=0, padx=10, pady=10, sticky="e")
        entry_name = ctk.CTkEntry(form_frame, placeholder_text="e.g. Flipkart 3x5 Thermal", width=200)
        entry_name.grid(row=0, column=1, padx=5, pady=10)

        ctk.CTkLabel(form_frame, text="Marketplace:", font=(theme.FONT_FAMILY, 12, "bold")).grid(row=0, column=2, padx=10, pady=10, sticky="e")
        combo_mp = ctk.CTkOptionMenu(form_frame, values=["Flipkart", "Meesho", "Amazon", "Shiprocket", "Delhivery", "Custom"], width=140)
        combo_mp.grid(row=0, column=3, padx=5, pady=10)

        ctk.CTkLabel(form_frame, text="Label Size:", font=(theme.FONT_FAMILY, 12, "bold")).grid(row=0, column=4, padx=10, pady=10, sticky="e")
        combo_size = ctk.CTkOptionMenu(form_frame, values=["3x5", "4x6", "A6", "Custom"], width=100)
        combo_size.grid(row=0, column=5, padx=5, pady=10)

        # Instruction banner
        inst_lbl = ctk.CTkLabel(
            dlg,
            text="Draw a rectangle around the shipping label on the page below using your mouse.",
            font=(theme.FONT_FAMILY, 12, "bold"),
            text_color=theme.COLOR_PRIMARY
        )
        inst_lbl.pack(pady=(0, 6))

        # Crop Canvas
        canvas_widget = CropCanvas(dlg)
        canvas_widget.pack(fill="both", expand=True, padx=16, pady=(0, 12))
        canvas_widget.load_image(pil_img, width_pt, height_pt)

        # Bottom Button Bar
        btn_bar = ctk.CTkFrame(dlg, fg_color="transparent")
        btn_bar.pack(fill="x", padx=16, pady=(0, 16))

        def _save():
            name = entry_name.get().strip()
            if not name:
                messagebox.showwarning("Validation Error", "Please enter a Template Name.")
                return

            crop_rect = canvas_widget.get_normalized_crop_rect()

            # Check if user drew a valid rect
            if crop_rect["x1"] - crop_rect["x0"] < 0.05 or crop_rect["y1"] - crop_rect["y0"] < 0.05:
                messagebox.showwarning("Validation Error", "Please draw a valid crop rectangle around the label area.")
                return

            orientation = "portrait" if height_pt >= width_pt else "landscape"

            self.template_manager.add_template(
                name=name,
                marketplace=combo_mp.get(),
                crop_rect=crop_rect,
                page_width=width_pt,
                page_height=height_pt,
                orientation=orientation,
                label_size=combo_size.get()
            )

            dlg.destroy()
            self.refresh_templates()
            messagebox.showinfo("Success", f"Template '{name}' saved successfully!")

        btn_save = ctk.CTkButton(
            btn_bar,
            text="Save Crop Template",
            fg_color=theme.COLOR_SUCCESS,
            hover_color="#047857",
            font=(theme.FONT_FAMILY, 12, "bold"),
            height=36,
            command=_save
        )
        btn_save.pack(side="right", padx=5)

        btn_cancel = ctk.CTkButton(
            btn_bar,
            text="Cancel",
            fg_color=theme.COLOR_BG_HOVER,
            text_color=theme.COLOR_TEXT_PRIMARY,
            hover_color=theme.COLOR_BG_HOVER,
            height=36,
            command=dlg.destroy
        )
        btn_cancel.pack(side="right", padx=5)
