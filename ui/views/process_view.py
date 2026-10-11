import customtkinter as ctk
import tkinter as tk
from tkinter import filedialog, messagebox
import os
import tempfile
from typing import List, Optional
from core.template_manager import TemplateManager, Template
from core.pdf_engine import PDFEngine
from core.output_engine import OutputEngine
from ui.widgets.drag_drop_zone import DragDropZone
import ui.theme as theme

class ProcessView(ctk.CTkFrame):
    """
    Label Processing View: Select input files, match template, select output format, and export.
    """

    def __init__(self, master, template_manager: TemplateManager, **kwargs):
        super().__init__(master, fg_color=theme.COLOR_BG_MAIN, **kwargs)
        self.template_manager = template_manager
        self.selected_files: List[str] = []

        # Top Bar
        self.top_bar = ctk.CTkFrame(self, fg_color="transparent")
        self.top_bar.pack(fill="x", padx=24, pady=(20, 10))

        self.title_label = ctk.CTkLabel(
            self.top_bar,
            text="Process Shipping Labels",
            font=(theme.FONT_FAMILY, 22, "bold"),
            text_color=theme.COLOR_TEXT_PRIMARY
        )
        self.title_label.pack(side="left")

        # Scrollable container for controls
        self.container = ctk.CTkScrollableFrame(self, fg_color="transparent")
        self.container.pack(fill="both", expand=True, padx=24, pady=10)

        # 1. File Input Zone
        self.dropzone = DragDropZone(self.container, on_files_selected=self._on_files_changed)
        self.dropzone.pack(fill="x", pady=(0, 15))

        # 2. Template Selection Section
        self.tmpl_card = ctk.CTkFrame(
            self.container,
            fg_color=theme.COLOR_BG_CARD,
            border_color=theme.COLOR_BORDER,
            border_width=1,
            corner_radius=8
        )
        self.tmpl_card.pack(fill="x", pady=10)

        ctk.CTkLabel(
            self.tmpl_card,
            text="Select Crop Template",
            font=(theme.FONT_FAMILY, 14, "bold"),
            text_color=theme.COLOR_TEXT_PRIMARY
        ).pack(anchor="w", padx=16, pady=(14, 6))

        self.tmpl_frame = ctk.CTkFrame(self.tmpl_card, fg_color="transparent")
        self.tmpl_frame.pack(fill="x", padx=16, pady=(0, 14))

        self.combo_tmpl = ctk.CTkOptionMenu(
            self.tmpl_frame,
            values=["(No templates saved)"],
            width=300,
            dynamic_resizing=False
        )
        self.combo_tmpl.pack(side="left", padx=(0, 10))

        self.btn_auto_match = ctk.CTkButton(
            self.tmpl_frame,
            text="Auto-Detect Template",
            fg_color=theme.COLOR_BG_HOVER,
            text_color=theme.COLOR_TEXT_PRIMARY,
            hover_color=theme.COLOR_BG_HOVER,
            border_color=theme.COLOR_BORDER,
            border_width=1,
            corner_radius=6,
            command=self._auto_detect_template
        )
        self.btn_auto_match.pack(side="left")

        # 3. Output Format Options Section
        self.output_card = ctk.CTkFrame(
            self.container,
            fg_color=theme.COLOR_BG_CARD,
            border_color=theme.COLOR_BORDER,
            border_width=1,
            corner_radius=8
        )
        self.output_card.pack(fill="x", pady=10)

        ctk.CTkLabel(
            self.output_card,
            text="Output Format Settings",
            font=(theme.FONT_FAMILY, 14, "bold"),
            text_color=theme.COLOR_TEXT_PRIMARY
        ).pack(anchor="w", padx=16, pady=(14, 6))

        self.opt_frame = ctk.CTkFrame(self.output_card, fg_color="transparent")
        self.opt_frame.pack(fill="x", padx=16, pady=(0, 14))

        ctk.CTkLabel(self.opt_frame, text="Output Mode:", font=(theme.FONT_FAMILY, 12, "bold")).grid(row=0, column=0, padx=5, pady=8, sticky="w")
        self.combo_mode = ctk.CTkOptionMenu(
            self.opt_frame,
            values=["Thermal 3x5", "Thermal 4x6", "A4 Sheet (4-up Grid)", "A4 Sheet (2-up Grid)", "Custom Grid"],
            width=220,
            command=self._on_mode_change
        )
        self.combo_mode.grid(row=0, column=1, padx=10, pady=8, sticky="w")

        self.lbl_paper = ctk.CTkLabel(self.opt_frame, text="Paper Size:", font=(theme.FONT_FAMILY, 12, "bold"))
        self.lbl_paper.grid(row=0, column=2, padx=5, pady=8, sticky="w")
        self.combo_paper = ctk.CTkOptionMenu(
            self.opt_frame,
            values=["A4", "Letter", "Legal"],
            width=120
        )
        self.combo_paper.grid(row=0, column=3, padx=10, pady=8, sticky="w")

        self.chk_cutmarks = ctk.CTkCheckBox(
            self.opt_frame,
            text="Draw Cut Marks",
            font=(theme.FONT_FAMILY, 12),
            border_width=1
        )
        self.chk_cutmarks.select()
        self.chk_cutmarks.grid(row=0, column=4, padx=15, pady=8, sticky="w")

        # 4. Action Bar
        self.action_card = ctk.CTkFrame(
            self.container,
            fg_color="transparent"
        )
        self.action_card.pack(fill="x", pady=15)

        self.btn_process = ctk.CTkButton(
            self.action_card,
            text="Process & Export Labels",
            fg_color=theme.COLOR_PRIMARY,
            hover_color=theme.COLOR_PRIMARY_HOVER,
            font=(theme.FONT_FAMILY, 14, "bold"),
            height=44,
            corner_radius=6,
            command=self._process_labels
        )
        self.btn_process.pack(fill="x")

        self.refresh_templates_dropdown()

    def refresh_templates_dropdown(self):
        templates = self.template_manager.get_all_templates()
        if templates:
            names = [f"{t.name} ({t.marketplace})" for t in templates]
            self.combo_tmpl.configure(values=names)
            self.combo_tmpl.set(names[0])
        else:
            self.combo_tmpl.configure(values=["(No templates saved)"])
            self.combo_tmpl.set("(No templates saved)")

    def _on_files_changed(self, files: List[str]):
        self.selected_files = files

    def _on_mode_change(self, mode: str):
        if mode.startswith("Thermal"):
            self.combo_paper.configure(state="disabled")
            self.chk_cutmarks.configure(state="disabled")
        else:
            self.combo_paper.configure(state="normal")
            self.chk_cutmarks.configure(state="normal")

    def _auto_detect_template(self):
        if not self.selected_files:
            messagebox.showwarning("No Input File", "Please select at least one PDF file first.")
            return

        # Read first file info
        first_path = self.selected_files[0]
        if os.path.isdir(first_path):
            for r, _, fs in os.walk(first_path):
                for f in fs:
                    if f.endswith(".pdf"):
                        first_path = os.path.join(r, f)
                        break
                if not first_path.endswith(".pdf"):
                    messagebox.showwarning("No PDF Found", "No PDF files found in directory.")
                    return

        try:
            info = PDFEngine.get_pdf_info(first_path)
            tmpl = self.template_manager.find_matching_template(info["width"], info["height"])
            if tmpl:
                tmpl_str = f"{tmpl.name} ({tmpl.marketplace})"
                self.combo_tmpl.set(tmpl_str)
                messagebox.showinfo("Template Matched", f"Auto-detected template: '{tmpl.name}'")
            else:
                messagebox.showwarning("No Match", f"No matching template found for page size {info['width']:.0f}x{info['height']:.0f} pt.\nPlease select a template manually or create a new one.")
        except Exception as e:
            messagebox.showerror("Error", f"Could not inspect PDF page size: {e}")

    def _process_labels(self):
        if not self.selected_files:
            messagebox.showwarning("No Input File", "Please select PDF files or a folder first.")
            return

        templates = self.template_manager.get_all_templates()
        if not templates:
            messagebox.showwarning("No Templates", "No templates available. Please create a template first in the Template Manager.")
            return

        selected_tmpl_name = self.combo_tmpl.get()
        matched_tmpl: Optional[Template] = None
        for t in templates:
            if f"{t.name} ({t.marketplace})" == selected_tmpl_name or t.name == selected_tmpl_name:
                matched_tmpl = t
                break

        if not matched_tmpl:
            matched_tmpl = templates[0]

        # Select Output Directory
        output_dir = filedialog.askdirectory(title="Select Destination Folder for Exported PDF")
        if not output_dir:
            return

        # Perform Processing
        mode = self.combo_mode.get()
        paper_size = self.combo_paper.get()
        cut_marks = bool(self.chk_cutmarks.get())

        temp_cropped_files: List[str] = []

        try:
            # Flatten files list
            pdf_paths: List[str] = []
            for item in self.selected_files:
                if os.path.isfile(item) and item.endswith(".pdf"):
                    pdf_paths.append(item)
                elif os.path.isdir(item):
                    for root, _, files in os.walk(item):
                        for f in files:
                            if f.endswith(".pdf"):
                                pdf_paths.append(os.path.join(root, f))

            if not pdf_paths:
                messagebox.showwarning("No PDFs Found", "No PDF files found in selection.")
                return

            temp_dir = tempfile.mkdtemp(prefix="shiplabel_proc_")
            for idx, pdf_path in enumerate(pdf_paths):
                out_crop = os.path.join(temp_dir, f"cropped_{idx}.pdf")
                ok = PDFEngine.crop_pdf(pdf_path, out_crop, matched_tmpl.crop_rect)
                if ok:
                    temp_cropped_files.append(out_crop)

            if not temp_cropped_files:
                messagebox.showerror("Error", "Failed to crop input files.")
                return

            final_pdf_path = os.path.join(output_dir, f"ShipLabel_{matched_tmpl.marketplace}_{len(temp_cropped_files)}_Labels.pdf")

            if mode.startswith("Thermal"):
                success = OutputEngine.export_thermal(temp_cropped_files, final_pdf_path, label_size=mode)
            else: # A4 Sheet Grid
                rows, cols = (2, 2) if "4-up" in mode else (2, 1)
                success = OutputEngine.export_grid(
                    temp_cropped_files,
                    final_pdf_path,
                    rows=rows,
                    cols=cols,
                    paper_name=paper_size,
                    draw_cut_marks=cut_marks
                )

            if success:
                messagebox.showinfo("Processing Complete", f"Successfully processed {len(temp_cropped_files)} labels!\nOutput saved to:\n{final_pdf_path}")
                os.startfile(output_dir)
            else:
                messagebox.showerror("Error", "Failed to generate final output PDF.")

        except Exception as e:
            messagebox.showerror("Processing Error", f"An unexpected error occurred:\n{e}")
