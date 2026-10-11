import customtkinter as ctk
from core.template_manager import TemplateManager
from ui.sidebar import Sidebar
from ui.views.dashboard_view import DashboardView
from ui.views.templates_view import TemplatesView
from ui.views.process_view import ProcessView
from ui.views.batch_view import BatchView
from ui.views.settings_view import SettingsView
from ui.views.about_view import AboutView
import ui.theme as theme

class MainWindow(ctk.CTk):
    """
    Main Application Window for ShipLabel Studio.
    Light commercial appearance mode with responsive view container.
    """

    def __init__(self):
        super().__init__()

        # Force Light Mode per user specification
        ctk.set_appearance_mode("Light")
        ctk.set_default_color_theme("blue")

        self.title("ShipLabel Studio — E-Commerce Shipping Label Manager")
        self.geometry("1180x760")
        self.minsize(980, 640)
        self.configure(fg_color=theme.COLOR_BG_MAIN)

        # Core Services
        self.template_manager = TemplateManager()

        # Layout Split: Sidebar (Left) + Content View (Right)
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        # Sidebar
        self.sidebar = Sidebar(self, on_navigate=self.show_view)
        self.sidebar.grid(row=0, column=0, sticky="nsew")

        # Content Area Frame
        self.content_area = ctk.CTkFrame(self, fg_color=theme.COLOR_BG_MAIN, corner_radius=0)
        self.content_area.grid(row=0, column=1, sticky="nsew")
        self.content_area.grid_columnconfigure(0, weight=1)
        self.content_area.grid_rowconfigure(0, weight=1)

        # Initialize Views
        self.views = {
            "dashboard": DashboardView(self.content_area, navigate_callback=self.show_view),
            "templates": TemplatesView(self.content_area, template_manager=self.template_manager),
            "process": ProcessView(self.content_area, template_manager=self.template_manager),
            "batch": BatchView(self.content_area, template_manager=self.template_manager),
            "settings": SettingsView(self.content_area),
            "about": AboutView(self.content_area),
        }

        # Mount views into grid
        for view in self.views.values():
            view.grid(row=0, column=0, sticky="nsew")

        # Show initial view
        self.show_view("dashboard")

    def show_view(self, view_name: str):
        if view_name in self.views:
            # Refresh view dropdowns/templates if applicable
            v = self.views[view_name]
            if hasattr(v, "refresh_templates"):
                v.refresh_templates()
            elif hasattr(v, "refresh_templates_dropdown"):
                v.refresh_templates_dropdown()

            v.tkraise()
            self.sidebar.select_view(view_name)
