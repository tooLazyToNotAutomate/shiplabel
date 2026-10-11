import os
import zipfile
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Callable, Dict, Optional, Any
from core.pdf_engine import PDFEngine
from core.output_engine import OutputEngine
from core.template_manager import Template

class BatchItem:
    def __init__(self, input_path: str, filename: str):
        self.input_path = input_path
        self.filename = filename
        self.status: str = "Pending"  # Pending, Processing, Completed, Error
        self.error_message: Optional[str] = None
        self.cropped_pdf_path: Optional[str] = None

class BatchProcessor:
    """
    Multithreaded batch processor for PDF shipping labels.
    Handles single files, folders, and ZIP archives.
    """

    def __init__(self, max_workers: int = 4):
        self.max_workers = max_workers
        self.is_cancelled: bool = False

    def collect_pdf_files(self, source_paths: List[str]) -> List[BatchItem]:
        """
        Scans files, directories, and ZIP archives to collect all PDF paths.
        """
        items: List[BatchItem] = []

        for src in source_paths:
            if os.path.isfile(src):
                if src.lower().endswith(".pdf"):
                    items.append(BatchItem(input_path=src, filename=os.path.basename(src)))
                elif src.lower().endswith(".zip"):
                    # Extract ZIP into temp folder
                    temp_dir = tempfile.mkdtemp(prefix="shiplabel_zip_")
                    try:
                        with zipfile.ZipFile(src, 'r') as zip_ref:
                            zip_ref.extractall(temp_dir)
                        for root, _, files in os.walk(temp_dir):
                            for f in files:
                                if f.lower().endswith(".pdf"):
                                    full_p = os.path.join(root, f)
                                    items.append(BatchItem(input_path=full_p, filename=f))
                    except Exception as e:
                        print(f"Error reading ZIP {src}: {e}")
            elif os.path.isdir(src):
                for root, _, files in os.walk(src):
                    for f in files:
                        if f.lower().endswith(".pdf"):
                            full_p = os.path.join(root, f)
                            items.append(BatchItem(input_path=full_p, filename=f))

        return items

    def process_batch(self,
                      items: List[BatchItem],
                      template: Template,
                      output_dir: str,
                      output_mode: str = "Thermal 3x5",
                      grid_rows: int = 2,
                      grid_cols: int = 2,
                      paper_name: str = "A4",
                      draw_cut_marks: bool = True,
                      merge_output: bool = True,
                      progress_callback: Optional[Callable[[int, int, str, str], None]] = None) -> Dict[str, Any]:
        """
        Processes a list of BatchItem objects using ThreadPoolExecutor.
        """
        self.is_cancelled = False
        os.makedirs(output_dir, exist_ok=True)
        temp_crop_dir = tempfile.mkdtemp(prefix="shiplabel_crop_")

        start_time = time.time()
        completed_count = 0
        total_items = len(items)

        if total_items == 0:
            return {"success": False, "message": "No PDF files found to process.", "processed_count": 0}

        def _crop_single(item: BatchItem) -> BatchItem:
            if self.is_cancelled:
                item.status = "Cancelled"
                return item

            item.status = "Processing"
            target_crop_path = os.path.join(temp_crop_dir, f"crop_{uuid_str()}_{item.filename}")
            
            success = PDFEngine.crop_pdf(item.input_path, target_crop_path, template.crop_rect)
            if success:
                item.status = "Completed"
                item.cropped_pdf_path = target_crop_path
            else:
                item.status = "Error"
                item.error_message = "Failed to crop PDF layout."
            return item

        # Run crop operations in parallel
        cropped_paths: List[str] = []
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_map = {executor.submit(_crop_single, item): item for item in items}
            for future in as_completed(future_map):
                if self.is_cancelled:
                    break
                res_item = future.result()
                completed_count += 1

                if res_item.status == "Completed" and res_item.cropped_pdf_path:
                    cropped_paths.append(res_item.cropped_pdf_path)

                if progress_callback:
                    progress_callback(completed_count, total_items, res_item.filename, res_item.status)

        if self.is_cancelled:
            return {"success": False, "message": "Batch processing was cancelled by user.", "processed_count": completed_count}

        if not cropped_paths:
            return {"success": False, "message": "No files were successfully cropped.", "processed_count": 0}

        # Format and Export final output
        final_output_path = os.path.join(output_dir, f"ShipLabel_Output_{int(time.time())}.pdf")

        if output_mode.startswith("Thermal"):
            export_ok = OutputEngine.export_thermal(cropped_paths, final_output_path, label_size=output_mode)
        else: # Grid / A4
            export_ok = OutputEngine.export_grid(
                cropped_pdf_paths=cropped_paths,
                output_path=final_output_path,
                rows=grid_rows,
                cols=grid_cols,
                paper_name=paper_name,
                draw_cut_marks=draw_cut_marks
            )

        elapsed = time.time() - start_time

        return {
            "success": export_ok,
            "output_path": final_output_path if export_ok else None,
            "processed_count": len(cropped_paths),
            "total_count": total_items,
            "elapsed_seconds": round(elapsed, 2)
        }

    def cancel(self):
        self.is_cancelled = True

def uuid_str():
    import uuid
    return str(uuid.uuid4())[:8]
