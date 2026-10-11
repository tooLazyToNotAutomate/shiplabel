import customtkinter as ctk
import ui.theme as theme
from typing import Callable, Optional

class DashboardView(ctk.CTkFrame):
    """
    Main Dashboard View for ShipLabel.
    """

    def __init__(self, master, navigate_callback: Optional[Callable[[str], None]] = None, **kwargs):
        super().__init__(master, fg_color=theme.COLOR_BG_MAIN, **kwargs)
        self.navigate_callback = navigate_callback

        # Header Title
        self.header_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.header_frame.pack(fill="x", padx=24, pady=(20, 10))

        self.title_label = ctk.CTkLabel(
            self.header_frame,
            text="Dashboard",
            font=(theme.FONT_FAMILY, 22, "bold"),
            text_color=theme.COLOR_TEXT_PRIMARY
        )
        self.title_label.pack(side="left")

        # Welcome Card
        self.welcome_card = ctk.CTkFrame(
            self,
            fg_color=theme.COLOR_BG_CARD,
            border_color=theme.COLOR_BORDER,
            border_width=1,
            corner_radius=8
        )
        self.welcome_card.pack(fill="x", padx=24, pady=10)

        welcome_text = ctk.CTkLabel(
            self.welcome_card,
            text="Welcome to ShipLabel Studio",
            font=(theme.FONT_FAMILY, 16, "bold"),
            text_color=theme.COLOR_TEXT_PRIMARY
        )
        welcome_text.pack(anchor="w", padx=20, pady=(16, 4))

        subtitle_text = ctk.CTkLabel(
            self.welcome_card,
            text="Automate shipping label cropping and grid layout formatting for Flipkart, Meesho, Amazon, Shiprocket, and more. 100% Offline.",
            font=(theme.FONT_FAMILY, 12),
            text_color=theme.COLOR_TEXT_SECONDARY
        )
        subtitle_text.pack(anchor="w", padx=20, pady=(0, 16))

        # Quick Actions Grid
        self.actions_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.actions_frame.pack(fill="x", padx=24, pady=15)

        self.actions_frame.grid_columnconfigure((0, 1, 2), weight=1, uniform="dash_card")

        # Card 1: Process Labels
        self.card_process = self._create_action_card(
            self.actions_frame, 0,
            icon="🏷️",
            title="Process Labels",
            desc="Crop single or multiple PDF shipping labels and export to Thermal or A4 sheets.",
            btn_text="Open Processor",
            command=lambda: self._nav("process")
        )

        # Card 2: Templates
        self.card_templates = self._create_action_card(
            self.actions_frame, 1,
            icon="📐",
            title="Template Manager",
            desc="Learn new crop templates for Flipkart, Meesho, Amazon, or custom layouts.",
            btn_text="Manage Templates",
            command=lambda: self._nav("templates")
        )

        # Card 3: Batch Processor
        self.card_batch = self._create_action_card(
            self.actions_frame, 2,
            icon="⚡",
            title="Batch Processor",
            desc="High-speed parallel processing for 1000+ PDFs with live progress tracking.",
            btn_text="Batch Mode",
            command=lambda: self._nav("batch")
        )

    def _create_action_card(self, parent, col, icon, title, desc, btn_text, command):
        card = ctk.CTkFrame(
            parent,
            fg_color=theme.COLOR_BG_CARD,
            border_color=theme.COLOR_BORDER,
            border_width=1,
            corner_radius=8
        )
        card.grid(row=0, column=col, padx=8, pady=8, sticky="nsew")

        ic_lbl = ctk.CTkLabel(card, text=icon, font=(theme.FONT_FAMILY, 28))
        ic_lbl.pack(anchor="w", padx=16, pady=(16, 4))

        t_lbl = ctk.CTkLabel(card, text=title, font=(theme.FONT_FAMILY, 14, "bold"), text_color=theme.COLOR_TEXT_PRIMARY)
        t_lbl.pack(anchor="w", padx=16, pady=2)

        d_lbl = ctk.CTkLabel(card, text=desc, font=(theme.FONT_FAMILY, 11), text_color=theme.COLOR_TEXT_MUTED, wraplength=220, justify="left")
        d_lbl.pack(anchor="w", padx=16, pady=(2, 12))

        btn = ctk.CTkButton(
            card,
            text=btn_text,
            fg_color=theme.COLOR_PRIMARY,
            hover_color=theme.COLOR_PRIMARY_HOVER,
            font=(theme.FONT_FAMILY, 12, "bold"),
            corner_radius=6,
            command=command
        )
        btn.pack(anchor="w", padx=16, pady=(0, 16))
        return card

    def _nav(self, target: str):
        if self.navigate_callback:
            self.navigate_callback(target)
