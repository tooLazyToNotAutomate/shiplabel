import os
import json
import uuid
from dataclasses import dataclass, asdict
from typing import List, Optional, Dict, Any

@dataclass
class Template:
    id: str
    name: str
    marketplace: str
    crop_rect: Dict[str, float]  # normalized 0.0 to 1.0: {"x0": ..., "y0": ..., "x1": ..., "y1": ...}
    page_width: float            # in PDF points (72 DPI points)
    page_height: float           # in PDF points
    orientation: str             # "portrait" or "landscape"
    label_size: str              # e.g., "3x5", "4x6", "A6"
    created_at: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Template":
        return cls(**data)


class TemplateManager:
    def __init__(self, storage_path: str = None):
        if storage_path is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            data_dir = os.path.join(base_dir, "data")
            os.makedirs(data_dir, exist_ok=True)
            storage_path = os.path.join(data_dir, "templates.json")
        
        self.storage_path = storage_path
        self.templates: Dict[str, Template] = {}
        self.load_templates()

    def load_templates(self):
        self.templates = {}
        if os.path.exists(self.storage_path):
            try:
                with open(self.storage_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for item in data:
                        tmpl = Template.from_dict(item)
                        self.templates[tmpl.id] = tmpl
            except Exception as e:
                print(f"Error loading templates from {self.storage_path}: {e}")
                self.templates = {}

    def save_templates(self):
        try:
            data = [tmpl.to_dict() for tmpl in self.templates.values()]
            with open(self.storage_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"Error saving templates to {self.storage_path}: {e}")

    def add_template(self, name: str, marketplace: str, crop_rect: Dict[str, float],
                     page_width: float, page_height: float, orientation: str,
                     label_size: str = "3x5") -> Template:
        import datetime
        tmpl_id = str(uuid.uuid4())
        created_at = datetime.datetime.now().isoformat()
        template = Template(
            id=tmpl_id,
            name=name,
            marketplace=marketplace,
            crop_rect=crop_rect,
            page_width=page_width,
            page_height=page_height,
            orientation=orientation,
            label_size=label_size,
            created_at=created_at
        )
        self.templates[tmpl_id] = template
        self.save_templates()
        return template

    def get_template(self, tmpl_id: str) -> Optional[Template]:
        return self.templates.get(tmpl_id)

    def get_all_templates(self) -> List[Template]:
        return list(self.templates.values())

    def delete_template(self, tmpl_id: str) -> bool:
        if tmpl_id in self.templates:
            del self.templates[tmpl_id]
            self.save_templates()
            return True
        return False

    def find_matching_template(self, page_width: float, page_height: float, 
                              marketplace_hint: str = None) -> Optional[Template]:
        """
        Attempts to match an incoming page based on dimensions and orientation.
        Returns the best matching Template or None.
        """
        orient = "portrait" if page_height >= page_width else "landscape"
        best_match = None
        best_diff = float("inf")

        for tmpl in self.templates.values():
            if marketplace_hint and tmpl.marketplace.lower() == marketplace_hint.lower():
                # Direct marketplace match priority
                return tmpl

            if tmpl.orientation == orient:
                w_diff = abs(tmpl.page_width - page_width)
                h_diff = abs(tmpl.page_height - page_height)
                total_diff = w_diff + h_diff
                # Tolerance within 10 points (~0.14 inch)
                if total_diff < 15 and total_diff < best_diff:
                    best_diff = total_diff
                    best_match = tmpl

        return best_match
