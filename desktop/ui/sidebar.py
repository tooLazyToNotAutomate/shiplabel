import customtkinter as ctk
import ui.theme as theme
from typing import Callable

class Sidebar(ctk.CTkFrame):
    """
    Left Navigation Sidebar for ShipLabel Studio.
    Dark navy theme with active state highlighting.
    """

    def __init__(self, master, on_navigate: Callable[[str], None], **kwargs):
        super().__init__(
            master,
            fg_color=theme.COLOR_BG_SIDEBAR,
            border_width=0,
            corner_radius=0,
            width=220,
            **kwargs
        )
        self.on_navigate = on_navigate
        self.nav_buttons = {}
        self.current_view = "dashboard"

        # App Brand Header
        self.brand_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.brand_frame.pack(fill="x", padx=16, pady=(20, 24))

        self.logo_icon = ctk.CTkLabel(
            self.brand_frame,
            text="SL",
            width=32,
            height=32,
            corner_radius=8,
            fg_color=theme.COLOR_PRIMARY,
            text_color=theme.COLOR_PRIMARY_TEXT,
            font=(theme.FONT_FAMILY, 13, "bold")
        )
        self.logo_icon.pack(side="left", padx=(0, 10))

        self.logo_text = ctk.CTkLabel(
            self.brand_frame,
            text="ShipLabel",
            font=(theme.FONT_FAMILY, 18, "bold"),
            text_color=theme.COLOR_PRIMARY_TEXT
        )
        self.logo_text.pack(side="left")

        # Nav Items
        nav_items = [
            ("dashboard", "Dashboard"),
            ("templates", "Templates"),
            ("process", "Process Labels"),
            ("batch", "Batch Processor"),
            ("settings", "Settings"),
            ("about", "About"),
        ]

        for key, label in nav_items:
            btn = ctk.CTkButton(
                self,
                text=label,
                anchor="w",
                font=(theme.FONT_FAMILY, 13, "bold" if key == "dashboard" else "normal"),
                fg_color=theme.COLOR_PRIMARY if key == "dashboard" else "transparent",
                text_color=theme.COLOR_PRIMARY_TEXT if key == "dashboard" else theme.COLOR_SIDEBAR_TEXT,
                hover_color=theme.COLOR_PRIMARY_HOVER if key == "dashboard" else theme.COLOR_SIDEBAR_HOVER,
                height=40,
                corner_radius=6,
                command=lambda k=key: self.select_view(k)
            )
            btn.pack(fill="x", padx=12, pady=3)
            self.nav_buttons[key] = btn

    def select_view(self, view_name: str):
        self.current_view = view_name
        for key, btn in self.nav_buttons.items():
            if key == view_name:
                btn.configure(
                    fg_color=theme.COLOR_PRIMARY,
                    text_color=theme.COLOR_PRIMARY_TEXT,
                    hover_color=theme.COLOR_PRIMARY_HOVER,
                    font=(theme.FONT_FAMILY, 13, "bold")
                )
            else:
                btn.configure(
                    fg_color="transparent",
                    text_color=theme.COLOR_SIDEBAR_TEXT,
                    hover_color=theme.COLOR_SIDEBAR_HOVER,
                    font=(theme.FONT_FAMILY, 13, "normal")
                )
        self.on_navigate(view_name)
