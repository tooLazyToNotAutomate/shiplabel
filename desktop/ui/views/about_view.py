import customtkinter as ctk
import ui.theme as theme

class AboutView(ctk.CTkFrame):
    """
    About view displaying version and license info.
    """
    def __init__(self, master, **kwargs):
        super().__init__(master, fg_color=theme.COLOR_BG_MAIN, **kwargs)

        card = ctk.CTkFrame(
            self,
            fg_color=theme.COLOR_BG_CARD,
            border_color=theme.COLOR_BORDER,
            border_width=1,
            corner_radius=8
        )
        card.pack(padx=24, pady=30, fill="x")

        title = ctk.CTkLabel(card, text="ShipLabel Studio", font=(theme.FONT_FAMILY, 24, "bold"), text_color=theme.COLOR_TEXT_PRIMARY)
        title.pack(anchor="w", padx=24, pady=(24, 4))

        sub = ctk.CTkLabel(card, text="Version 1.0.0 (Commercial Desktop Edition)", font=(theme.FONT_FAMILY, 12, "bold"), text_color=theme.COLOR_PRIMARY)
        sub.pack(anchor="w", padx=24, pady=(0, 16))

        desc = ctk.CTkLabel(
            card,
            text="ShipLabel is a professional offline Windows application built to automate shipping label processing for Flipkart, Meesho, Amazon, Shiprocket, Delhivery, and custom marketplaces.\n\nKey Capabilities:\n• Learn Template System for custom label crop areas\n• Vector PDF Engine (100% quality retention, zero rasterization)\n• Multithreaded Batch Processing for 1000+ PDFs\n• Thermal 3x5, Thermal 4x6, and A4 4-Up Grid layout engines\n• 100% Offline with zero cloud dependency",
            font=(theme.FONT_FAMILY, 12),
            text_color=theme.COLOR_TEXT_SECONDARY,
            justify="left",
            wraplength=600
        )
        desc.pack(anchor="w", padx=24, pady=(0, 24))
