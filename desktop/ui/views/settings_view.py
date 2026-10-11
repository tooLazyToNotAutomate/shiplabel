import customtkinter as ctk
import ui.theme as theme

class SettingsView(ctk.CTkFrame):
    """
    Settings view for global defaults.
    """
    def __init__(self, master, **kwargs):
        super().__init__(master, fg_color=theme.COLOR_BG_MAIN, **kwargs)

        self.title_label = ctk.CTkLabel(
            self,
            text="Application Settings",
            font=(theme.FONT_FAMILY, 22, "bold"),
            text_color=theme.COLOR_TEXT_PRIMARY
        )
        self.title_label.pack(anchor="w", padx=24, pady=(20, 10))

        # Card
        card = ctk.CTkFrame(
            self,
            fg_color=theme.COLOR_BG_CARD,
            border_color=theme.COLOR_BORDER,
            border_width=1,
            corner_radius=8
        )
        card.pack(fill="x", padx=24, pady=10)

        grid = ctk.CTkFrame(card, fg_color="transparent")
        grid.pack(fill="x", padx=20, pady=20)

        ctk.CTkLabel(grid, text="Default Paper Size:", font=(theme.FONT_FAMILY, 12, "bold")).grid(row=0, column=0, padx=10, pady=10, sticky="w")
        combo_paper = ctk.CTkOptionMenu(grid, values=["A4", "Letter", "Legal"], width=160)
        combo_paper.grid(row=0, column=1, padx=10, pady=10, sticky="w")

        ctk.CTkLabel(grid, text="Default Thermal Size:", font=(theme.FONT_FAMILY, 12, "bold")).grid(row=1, column=0, padx=10, pady=10, sticky="w")
        combo_thermal = ctk.CTkOptionMenu(grid, values=["Thermal 3x5", "Thermal 4x6"], width=160)
        combo_thermal.grid(row=1, column=1, padx=10, pady=10, sticky="w")

        chk_open = ctk.CTkCheckBox(grid, text="Automatically open output folder after processing", font=(theme.FONT_FAMILY, 12))
        chk_open.select()
        chk_open.grid(row=2, column=0, columnspan=2, padx=10, pady=10, sticky="w")
