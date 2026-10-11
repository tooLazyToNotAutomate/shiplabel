import customtkinter as ctk
import tkinter as tk
from tkinter import filedialog
from typing import List, Callable, Optional
import os
import ui.theme as theme

class DragDropZone(ctk.CTkFrame):
    """
    Drag and drop style file dropzone widget with explicit browse buttons for single files,
    folders, and ZIP archives.
    """

    def __init__(self, master, on_files_selected: Optional[Callable[[List[str]], None]] = None, **kwargs):
        super().__init__(
            master,
            fg_color=theme.COLOR_BG_CARD,
            border_color=theme.COLOR_BORDER,
            border_width=1,
            corner_radius=8,
            **kwargs
        )

        self.on_files_selected = on_files_selected
        self.selected_paths: List[str] = []

        # UI Container
        self.inner_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.inner_frame.pack(expand=True, fill="both", padx=20, pady=20)

        # Icon Label
        self.icon_label = ctk.CTkLabel(
            self.inner_frame,
            text="",
            font=(theme.FONT_FAMILY, 36)
        )
        self.icon_label.pack(pady=(0, 5))

        # Primary Text
        self.title_label = ctk.CTkLabel(
            self.inner_frame,
            text="Select Shipping Label PDFs or Folders",
            font=(theme.FONT_FAMILY, 15, "bold"),
            text_color=theme.COLOR_TEXT_PRIMARY
        )
        self.title_label.pack(pady=2)

        # Subtitle
        self.subtitle_label = ctk.CTkLabel(
            self.inner_frame,
            text="Supports Single PDF, Multiple PDFs, Folders, and ZIP files",
            font=(theme.FONT_FAMILY, 11),
            text_color=theme.COLOR_TEXT_MUTED
        )
        self.subtitle_label.pack(pady=(0, 15))

        # Button Group
        self.btn_frame = ctk.CTkFrame(self.inner_frame, fg_color="transparent")
        self.btn_frame.pack()

        self.btn_files = ctk.CTkButton(
            self.btn_frame,
            text="Select PDF Files",
            fg_color=theme.COLOR_PRIMARY,
            hover_color=theme.COLOR_PRIMARY_HOVER,
            font=(theme.FONT_FAMILY, 12, "bold"),
            corner_radius=6,
            height=34,
            command=self._select_files
        )
        self.btn_files.pack(side="left", padx=5)

        self.btn_folder = ctk.CTkButton(
            self.btn_frame,
            text="Select Folder / ZIP",
            fg_color=theme.COLOR_BG_HOVER,
            text_color=theme.COLOR_TEXT_PRIMARY,
            hover_color=theme.COLOR_BG_HOVER,
            border_color=theme.COLOR_BORDER,
            border_width=1,
            font=(theme.FONT_FAMILY, 12),
            corner_radius=6,
            height=34,
            command=self._select_folder
        )
        self.btn_folder.pack(side="left", padx=5)

        # Status Label
        self.status_label = ctk.CTkLabel(
            self.inner_frame,
            text="No files selected",
            font=(theme.FONT_FAMILY, 11, "italic"),
            text_color=theme.COLOR_TEXT_MUTED
        )
        self.status_label.pack(pady=(12, 0))

    def _select_files(self):
        paths = filedialog.askopenfilenames(
            title="Select Shipping Label PDFs",
            filetypes=[("PDF Files & ZIP", "*.pdf *.zip"), ("PDF Files", "*.pdf"), ("ZIP Archives", "*.zip"), ("All Files", "*.*")]
        )
        if paths:
            self.selected_paths = list(paths)
            self._update_status()
            if self.on_files_selected:
                self.on_files_selected(self.selected_paths)

    def _select_folder(self):
        folder_path = filedialog.askdirectory(title="Select Folder Containing PDFs")
        if folder_path:
            self.selected_paths = [folder_path]
            self._update_status()
            if self.on_files_selected:
                self.on_files_selected(self.selected_paths)

    def _update_status(self):
        count = len(self.selected_paths)
        if count == 0:
            self.status_label.configure(text="No files selected", text_color=theme.COLOR_TEXT_MUTED)
        elif count == 1:
            name = os.path.basename(self.selected_paths[0])
            self.status_label.configure(text=f"Selected: {name}", text_color=theme.COLOR_SUCCESS)
        else:
            self.status_label.configure(text=f"Selected {count} items/files", text_color=theme.COLOR_SUCCESS)

    def clear(self):
        self.selected_paths = []
        self._update_status()
