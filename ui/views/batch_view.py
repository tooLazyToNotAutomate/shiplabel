import customtkinter as ctk
import tkinter as tk
from tkinter import filedialog, messagebox
import os
import threading
from typing import List, Optional
from core.template_manager import TemplateManager, Template
from core.batch_processor import BatchProcessor, BatchItem
from ui.widgets.drag_drop_zone import DragDropZone
import ui.theme as theme

class BatchView(ctk.CTkFrame):
    """
    Batch Processor View: Fast parallel processing for 1000+ PDFs with live progress tracking.
    """

    def __init__(self, master, template_manager: TemplateManager, **kwargs):
        super().__init__(master, fg_color=theme.COLOR_BG_MAIN, **kwargs)
        self.template_manager = template_manager
        self.batch_processor = BatchProcessor(max_workers=4)

        self.input_paths: List[str] = []
        self.batch_items: List[BatchItem] = []
        self.is_running: bool = False

        # Top Bar
        self.top_bar = ctk.CTkFrame(self, fg_color="transparent")
        self.top_bar.pack(fill="x", padx=24, pady=(20, 10))

        self.title_label = ctk.CTkLabel(
            self.top_bar,
            text="Batch Processor (1000+ PDFs)",
            font=(theme.FONT_FAMILY, 22, "bold"),
            text_color=theme.COLOR_TEXT_PRIMARY
        )
        self.title_label.pack(side="left")

        # Container
        self.container = ctk.CTkScrollableFrame(self, fg_color="transparent")
        self.container.pack(fill="both", expand=True, padx=24, pady=10)

        # 1. Dropzone
        self.dropzone = DragDropZone(self.container, on_files_selected=self._on_inputs_selected)
        self.dropzone.pack(fill="x", pady=(0, 10))

        # 2. Options Card
        self.opt_card = ctk.CTkFrame(
            self.container,
            fg_color=theme.COLOR_BG_CARD,
            border_color=theme.COLOR_BORDER,
            border_width=1,
            corner_radius=8
        )
        self.opt_card.pack(fill="x", pady=10)

        self.opt_grid = ctk.CTkFrame(self.opt_card, fg_color="transparent")
        self.opt_grid.pack(fill="x", padx=16, pady=14)

        ctk.CTkLabel(self.opt_grid, text="Template:", font=(theme.FONT_FAMILY, 12, "bold")).grid(row=0, column=0, padx=5, pady=6, sticky="w")
        self.combo_tmpl = ctk.CTkOptionMenu(self.opt_grid, values=["(No templates)"], width=220)
        self.combo_tmpl.grid(row=0, column=1, padx=10, pady=6, sticky="w")

        ctk.CTkLabel(self.opt_grid, text="Output Format:", font=(theme.FONT_FAMILY, 12, "bold")).grid(row=0, column=2, padx=5, pady=6, sticky="w")
        self.combo_format = ctk.CTkOptionMenu(
            self.opt_grid,
            values=["Thermal 3x5", "Thermal 4x6", "A4 Sheet (4-up Grid)", "A4 Sheet (2-up Grid)"],
            width=200
        )
        self.combo_format.grid(row=0, column=3, padx=10, pady=6, sticky="w")

        # 3. Progress Panel Card
        self.prog_card = ctk.CTkFrame(
            self.container,
            fg_color=theme.COLOR_BG_CARD,
            border_color=theme.COLOR_BORDER,
            border_width=1,
            corner_radius=8
        )
        self.prog_card.pack(fill="x", pady=10)

        self.prog_header = ctk.CTkFrame(self.prog_card, fg_color="transparent")
        self.prog_header.pack(fill="x", padx=16, pady=(14, 6))

        self.lbl_progress_title = ctk.CTkLabel(
            self.prog_header,
            text="Progress Status",
            font=(theme.FONT_FAMILY, 14, "bold"),
            text_color=theme.COLOR_TEXT_PRIMARY
        )
        self.lbl_progress_title.pack(side="left")

        self.lbl_progress_count = ctk.CTkLabel(
            self.prog_header,
            text="0 / 0 Files Processed",
            font=(theme.FONT_FAMILY, 12, "bold"),
            text_color=theme.COLOR_TEXT_MUTED
        )
        self.lbl_progress_count.pack(side="right")

        self.progress_bar = ctk.CTkProgressBar(self.prog_card, height=12, corner_radius=6, progress_color=theme.COLOR_PRIMARY)
        self.progress_bar.set(0.0)
        self.progress_bar.pack(fill="x", padx=16, pady=6)

        self.lbl_status_msg = ctk.CTkLabel(
            self.prog_card,
            text="Ready to start batch processing.",
            font=(theme.FONT_FAMILY, 11),
            text_color=theme.COLOR_TEXT_SECONDARY
        )
        self.lbl_status_msg.pack(anchor="w", padx=16, pady=(0, 14))

        # 4. Control Buttons
        self.btn_bar = ctk.CTkFrame(self.container, fg_color="transparent")
        self.btn_bar.pack(fill="x", pady=15)

        self.btn_start = ctk.CTkButton(
            self.btn_bar,
            text="Start Batch Processing",
            fg_color=theme.COLOR_PRIMARY,
            hover_color=theme.COLOR_PRIMARY_HOVER,
            font=(theme.FONT_FAMILY, 14, "bold"),
            height=44,
            corner_radius=6,
            command=self._start_batch
        )
        self.btn_start.pack(side="left", expand=True, fill="x", padx=(0, 5))

        self.btn_cancel = ctk.CTkButton(
            self.btn_bar,
            text="Cancel",
            fg_color=theme.COLOR_DANGER_BG,
            text_color=theme.COLOR_DANGER,
            hover_color=theme.COLOR_DANGER_HOVER,
            font=(theme.FONT_FAMILY, 14, "bold"),
            height=44,
            width=120,
            corner_radius=6,
            state="disabled",
            command=self._cancel_batch
        )
        self.btn_cancel.pack(side="right", padx=(5, 0))

        self.refresh_templates()

    def refresh_templates(self):
        templates = self.template_manager.get_all_templates()
        if templates:
            names = [f"{t.name} ({t.marketplace})" for t in templates]
            self.combo_tmpl.configure(values=names)
            self.combo_tmpl.set(names[0])
        else:
            self.combo_tmpl.configure(values=["(No templates)"])
            self.combo_tmpl.set("(No templates)")

    def _on_inputs_selected(self, paths: List[str]):
        self.input_paths = paths
        self.batch_items = self.batch_processor.collect_pdf_files(paths)
        total = len(self.batch_items)
        self.lbl_progress_count.configure(text=f"0 / {total} Files Ready")
        self.lbl_status_msg.configure(text=f"Loaded {total} PDF files for batch processing.")

    def _start_batch(self):
        if not self.batch_items:
            messagebox.showwarning("No Files", "Please select PDF files or a folder first.")
            return

        templates = self.template_manager.get_all_templates()
        if not templates:
            messagebox.showwarning("No Templates", "Please create a crop template first.")
            return

        selected_tmpl_str = self.combo_tmpl.get()
        target_tmpl: Optional[Template] = None
        for t in templates:
            if f"{t.name} ({t.marketplace})" == selected_tmpl_str or t.name == selected_tmpl_str:
                target_tmpl = t
                break
        if not target_tmpl:
            target_tmpl = templates[0]

        output_dir = filedialog.askdirectory(title="Select Output Directory for Batch PDF")
        if not output_dir:
            return

        self.is_running = True
        self.btn_start.configure(state="disabled")
        self.btn_cancel.configure(state="normal")
        self.progress_bar.set(0.0)

        fmt = self.combo_format.get()
        rows, cols = (2, 2) if "4-up" in fmt else ((2, 1) if "2-up" in fmt else (1, 1))

        # Run background thread for batch processor so UI never freezes!
        def _worker():
            def _progress_cb(current, total, filename, status):
                pct = current / max(1, total)
                self.after(0, lambda: self._update_ui_progress(current, total, filename, status, pct))

            result = self.batch_processor.process_batch(
                items=self.batch_items,
                template=target_tmpl,
                output_dir=output_dir,
                output_mode=fmt,
                grid_rows=rows,
                grid_cols=cols,
                paper_name="A4",
                progress_callback=_progress_cb
            )

            self.after(0, lambda: self._on_batch_complete(result, output_dir))

        threading.Thread(target=_worker, daemon=True).start()

    def _update_ui_progress(self, current: int, total: int, filename: str, status: str, pct: float):
        self.progress_bar.set(pct)
        self.lbl_progress_count.configure(text=f"{current} / {total} Processed ({int(pct*100)}%)")
        self.lbl_status_msg.configure(text=f"[{status}] Processing: {filename}")

    def _on_batch_complete(self, result: dict, output_dir: str):
        self.is_running = False
        self.btn_start.configure(state="normal")
        self.btn_cancel.configure(state="disabled")

        if result.get("success"):
            cnt = result.get("processed_count", 0)
            sec = result.get("elapsed_seconds", 0)
            out_p = result.get("output_path", "")
            self.lbl_status_msg.configure(text=f"🎉 Complete! Processed {cnt} PDFs in {sec} seconds.")
            messagebox.showinfo(
                "Batch Processing Complete",
                f"Successfully processed {cnt} shipping labels in {sec} seconds!\n\nOutput saved to:\n{out_p}"
            )
            os.startfile(output_dir)
        else:
            msg = result.get("message", "Batch process failed.")
            self.lbl_status_msg.configure(text=f"Error: {msg}")
            messagebox.showerror("Batch Error", msg)

    def _cancel_batch(self):
        if self.is_running:
            self.batch_processor.cancel()
            self.lbl_status_msg.configure(text="Cancelling batch processor...")
