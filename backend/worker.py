import os
import shutil
import tempfile
import boto3
from pdf2image import convert_from_path
from supabase import create_client, Client

try:
    import pyvips
except Exception:
    pyvips = None

try:
    from ai_engine import extract_text_and_boxes, generate_template_ai_predictions
except ImportError:
    from backend.ai_engine import extract_text_and_boxes, generate_template_ai_predictions

SUPABASE_URL = os.getenv("SUPABASE_URL", "http://localhost:8000")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "dummy-key")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID", "dummy-account")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID", "dummy-access")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY", "dummy-secret")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME", "codexflow")


def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=os.getenv("R2_ENDPOINT_URL"),
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name="auto",
    )


def process_file(folio_id: str, file_key: str):
    try:
        s3 = get_s3_client()

        with tempfile.TemporaryDirectory() as temp_dir:
            file_name = os.path.basename(file_key)
            local_path = os.path.join(temp_dir, file_name)

            s3.download_file(R2_BUCKET_NAME, file_key, local_path)

            ext = file_name.split(".")[-1].lower() if "." in file_name else ""
            pages_to_process = []
            if ext == "pdf":
                try:
                    pages = convert_from_path(local_path)
                    for i, page in enumerate(pages):
                        page_path = os.path.join(temp_dir, f"page_{i}.jpg")
                        page.save(page_path, "JPEG")
                        pages_to_process.append(page_path)
                except Exception as pdf_err:
                    print(f"Notice converting PDF {file_key}: {pdf_err}")
                    pages_to_process.append(local_path)
            else:
                pages_to_process.append(local_path)

            all_ocr_data = []
            img_width, img_height = 1200, 1600

            for i, page_path in enumerate(pages_to_process):
                dzi_name = f"{folio_id}_{i}"
                dzi_path = os.path.join(temp_dir, dzi_name)

                # Generación opcional de pirámide DZI (no bloqueante si libvips no está disponible en Render)
                if pyvips is not None:
                    try:
                        img = pyvips.Image.new_from_file(page_path)
                        img.dzsave(dzi_path)

                        dzi_file_path = f"{dzi_path}.dzi"
                        if os.path.exists(dzi_file_path):
                            s3.upload_file(dzi_file_path, R2_BUCKET_NAME, f"dzi/{dzi_name}.dzi")

                        dzi_files_dir = f"{dzi_path}_files"
                        if os.path.exists(dzi_files_dir):
                            for root, dirs, files in os.walk(dzi_files_dir):
                                for f in files:
                                    local_f = os.path.join(root, f)
                                    rel_path = os.path.relpath(local_f, temp_dir)
                                    s3.upload_file(
                                        local_f,
                                        R2_BUCKET_NAME,
                                        f"dzi/{rel_path}".replace("\\", "/"),
                                    )
                    except Exception as vips_err:
                        print(f"Notice: DZI tile generation skipped for {page_path}: {vips_err}")

                # Extraer texto, regiones y dimensiones con OCR + Fallback PIL Vision
                ocr_out = extract_text_and_boxes(page_path)
                if isinstance(ocr_out, tuple) and len(ocr_out) == 3:
                    ocr_results, page_w, page_h = ocr_out
                    if i == 0:
                        img_width, img_height = page_w, page_h
                else:
                    ocr_results = ocr_out if isinstance(ocr_out, list) else []
                all_ocr_data.extend(ocr_results)

            # Obtener tenant_id, batch_id y los fields reales de la plantilla
            tenant_id = file_key.split("/")[0] if "/" in file_key else ""
            batch_id = None
            template_fields = []
            training_rows = []

            try:
                folio_res = (
                    supabase.table("folios")
                    .select("id, tenant_id, batch_id")
                    .eq("id", folio_id)
                    .execute()
                )
                if folio_res.data and len(folio_res.data) > 0:
                    folio_row = folio_res.data[0]
                    tenant_id = folio_row.get("tenant_id") or tenant_id
                    batch_id = folio_row.get("batch_id")

                if batch_id and tenant_id:
                    batch_res = (
                        supabase.table("batches")
                        .select("template_id")
                        .eq("id", batch_id)
                        .eq("tenant_id", tenant_id)
                        .execute()
                    )
                    if batch_res.data and len(batch_res.data) > 0:
                        template_id = batch_res.data[0].get("template_id")
                        if template_id:
                            tpl_res = (
                                supabase.table("templates")
                                .select("fields")
                                .eq("id", template_id)
                                .eq("tenant_id", tenant_id)
                                .execute()
                            )
                            if tpl_res.data and len(tpl_res.data) > 0:
                                template_fields = tpl_res.data[0].get("fields") or []

                if tenant_id:
                    td_res = (
                        supabase.table("training_data")
                        .select("*")
                        .eq("tenant_id", tenant_id)
                        .limit(100)
                        .execute()
                    )
                    if td_res.data:
                        training_rows = td_res.data
            except Exception as e:
                print(f"Error fetching template fields or training_data: {e}")

            ai_predictions = generate_template_ai_predictions(
                template_fields=template_fields,
                ocr_boxes=all_ocr_data,
                img_width=img_width,
                img_height=img_height,
                training_rows=training_rows,
                folio_id=folio_id,
            )

            # NUNCA sobrescribir r2_url con la ruta .dzi para preservar la visualización en el Visor
            update_q = supabase.table("folios").update({
                "status": "pending",
                "ai_predictions": ai_predictions,
            }).eq("id", folio_id)

            if tenant_id:
                update_q = update_q.eq("tenant_id", tenant_id)

            update_q.execute()
    except Exception as e:
        print(f"Error processing file {file_key} for folio {folio_id}: {e}")
