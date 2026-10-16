import os
import io
import re
import csv
import secrets
import hashlib
import uuid
import boto3
from botocore.client import Config
from datetime import datetime, timedelta, timezone
import json
import unicodedata
from fastapi import FastAPI, BackgroundTasks, HTTPException, Header, Depends, Query
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel
from supabase import create_client, Client, ClientOptions
from typing import List, Optional, Dict, Any
try:
    from worker import process_file
except ImportError:
    from backend.worker import process_file

try:
    from ai_engine import extract_text_and_boxes, generate_template_ai_predictions
except ImportError:
    from backend.ai_engine import extract_text_and_boxes, generate_template_ai_predictions

# Setup Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL", "http://localhost:8000")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "dummy-key")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Setup S3 client for R2
s3_client = boto3.client(
    's3',
    endpoint_url=os.getenv('R2_ENDPOINT_URL'),
    aws_access_key_id=os.getenv('R2_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('R2_SECRET_ACCESS_KEY'),
    config=Config(signature_version='s3v4')
)

app = FastAPI(title="CodexFlow Ingestion API")

class IngestRequest(BaseModel):
    batch_id: str
    files: List[str] # List of file paths/keys uploaded to R2

class FeedbackRequest(BaseModel):
    folio_id: str
    field_name: str
    predicted_value: str
    actual_value: str

class AIFeedbackItem(BaseModel):
    field_name: str
    predicted_value: Optional[str] = ""
    actual_value: Optional[str] = ""
    confidence: Optional[float] = 0.0
    action_type: Optional[str] = None
    bbox: Optional[Dict[str, Any]] = None

class AIFeedbackPayload(BaseModel):
    folio_id: str
    items: Optional[List[AIFeedbackItem]] = None
    feedback: Optional[List[AIFeedbackItem]] = None
    field_name: Optional[str] = None
    predicted_value: Optional[str] = None
    actual_value: Optional[str] = None

from enum import Enum

class FolderType(str, Enum):
    root = "root"
    parish = "parish"
    series = "series"
    tome = "tome"

class FolderMetadata(BaseModel):
    tome_number: Optional[str] = None
    year_start: Optional[int] = None
    year_end: Optional[int] = None
    location: Optional[str] = None
    template_id: Optional[str] = None
    # Dimensiones Geográficas y Eclesiásticas SPEC-013
    country: Optional[str] = None
    state: Optional[str] = None
    municipality: Optional[str] = None
    city_or_locality: Optional[str] = None
    diocese_name: Optional[str] = None
    parish_name: Optional[str] = None

class GeographicSuggestionsResponse(BaseModel):
    countries: List[str] = []
    states: List[str] = []
    municipalities: List[str] = []
    cities_or_localities: List[str] = []
    dioceses: List[str] = []
    parishes: List[str] = []

class FolderCreate(BaseModel):
    name: str
    folder_type: FolderType = FolderType.tome
    parent_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class FolderUpdate(BaseModel):
    name: Optional[str] = None
    folder_type: Optional[FolderType] = None
    parent_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class FolderResponse(BaseModel):
    id: str
    tenant_id: str
    parent_id: Optional[str] = None
    name: str
    folder_type: str
    metadata: Optional[Dict[str, Any]] = None
    created_at: Optional[str] = None
    total_folios: int = 0
    total_entries: int = 0

class AssignFoliosRequest(BaseModel):
    folio_ids: List[str]


def compute_canonical_filename(
    tenant_subdomain: str,
    tome_name: str,
    tome_number: Optional[str],
    sequence_order: int,
    original_filename_or_url: Optional[str] = None
) -> str:
    """
    Calcula el nombre canónico de folio según el estándar oficial de FamilySearch:
    [ORGANIZACION]_[SERIE_O_PARROQUIA]_T[NUM_TOMO]_F[NUM_FOLIO_4_DIGITOS].[extension]
    Ejemplos:
      - CARUPANO_BAUTISMOS_T01_F0001.jpg
      - BAUTISMOS_T01_F0001.jpg (o CODEX_BAUTISMOS_T01_F0001.jpg)
    """
    def sanitize(text: Optional[str]) -> str:
        if not text:
            return ""
        norm = unicodedata.normalize("NFKD", str(text))
        ascii_text = norm.encode("ASCII", "ignore").decode("ASCII")
        clean = re.sub(r"[^A-Za-z0-9]+", "_", ascii_text)
        return clean.strip("_").upper()

    clean_org = sanitize(tenant_subdomain)
    if not clean_org or clean_org in ("DEFAULT", "PUBLIC"):
        clean_org = "CODEX"

    clean_tome_name = sanitize(tome_name)
    if not clean_tome_name:
        clean_tome_name = "TOMO"

    raw_num = ""
    if tome_number:
        match = re.search(r"\d+", str(tome_number))
        if match:
            raw_num = match.group(0)
    if not raw_num:
        match = re.search(r"\d+", str(tome_name))
        if match:
            raw_num = match.group(0)

    if raw_num:
        tome_str = f"T{raw_num.zfill(2)}"
    else:
        tome_str = "T01"

    seq = max(1, int(sequence_order or 1))
    folio_str = f"F{str(seq).zfill(4)}"

    ext = "jpg"
    if original_filename_or_url:
        base_name = original_filename_or_url.split("?")[0].split("/")[-1]
        if "." in base_name:
            cand_ext = base_name.rsplit(".", 1)[-1].lower()
            if cand_ext in ("jpg", "jpeg", "png", "webp", "tif", "tiff"):
                ext = "jpg" if cand_ext == "jpeg" else cand_ext

    parts = []
    if clean_org:
        parts.append(clean_org)
    if clean_tome_name:
        parts.append(clean_tome_name)
    parts.append(tome_str)
    parts.append(folio_str)

    assembled = "_".join(parts)
    return f"{assembled}.{ext}"

class FolioEntryCreate(BaseModel):
    entry_number: int
    metadata: Dict[str, Any]
    status: Optional[str] = "pending"
    bounding_box: Optional[Dict[str, Any]] = None

class FolioEntryUpdate(BaseModel):
    metadata: Dict[str, Any]
    status: Optional[str] = None
    bounding_box: Optional[Dict[str, Any]] = None

class BatchSaveEntriesRequest(BaseModel):
    entries: List[FolioEntryCreate]
    final_status: Optional[str] = None

async def get_auth_context(authorization: str = Header(...), x_tenant_id: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    token = authorization.split(" ")[1] if " " in authorization else authorization
    
    try:
        res = supabase.auth.get_user(token)
        if not res or not res.user:
            raise HTTPException(status_code=401, detail="Invalid token")
            
        user_id = res.user.id
        profile_res = supabase.table("user_profiles").select("tenant_id, role, is_active, tenants(is_active)").eq("user_id", user_id).execute()
        if not profile_res.data:
            raise HTTPException(status_code=403, detail="User profile not found")
            
        profile = profile_res.data[0]
        role = profile.get("role")
        tenant_id = profile.get("tenant_id")
        is_active = profile.get("is_active")
        tenants = profile.get("tenants")
        
        if is_active is False:
            raise HTTPException(status_code=403, detail="Usuario desactivado")
            
        if tenants and tenants.get("is_active") is False:
            raise HTTPException(status_code=403, detail="Organización desactivada")
        
        if role == "superadmin":
            if x_tenant_id:
                tenant_id = x_tenant_id
            return {"tenant_id": tenant_id, "user_client": supabase, "user_id": user_id, "role": role}
        
        # Create user-scoped client
        options = ClientOptions(headers={"Authorization": f"Bearer {token}"})
        user_client = create_client(SUPABASE_URL, SUPABASE_KEY, options=options)
        
        return {"tenant_id": tenant_id, "user_client": user_client, "user_id": user_id, "role": role}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=401, detail=f"Authentication failed")

async def get_superadmin_context(authorization: str = Header(...)) -> Dict[str, Any]:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    token = authorization.split(" ")[1] if " " in authorization else authorization
    
    try:
        res = supabase.auth.get_user(token)
        if not res or not res.user:
            raise HTTPException(status_code=401, detail="Invalid token")
            
        user_id = res.user.id
        profile_res = supabase.table("user_profiles").select("role").eq("user_id", user_id).execute()
        
        if not profile_res.data or profile_res.data[0].get("role") != "superadmin":
            raise HTTPException(status_code=403, detail="Forbidden: Superadmin access required")
            
        return {"user_id": user_id, "role": "superadmin"}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=401, detail="Authentication failed")

class InviteRequest(BaseModel):
    email: str
    role: str
    tenant_id: str

import asyncio

MAX_CONCURRENT_FILES = 2
process_semaphore = asyncio.Semaphore(MAX_CONCURRENT_FILES)

async def async_process_file(folio_id: str, file_key: str, user_client: Client, batch_id: str):
    async with process_semaphore:
        loop = asyncio.get_running_loop()
        try:
            await loop.run_in_executor(None, process_file, folio_id, file_key)
        except Exception as file_e:
            print(f"Error processing file {file_key} for folio {folio_id}: {file_e}")

async def process_batch_task(batch_id: str, files: List[str], user_client: Client, tenant_id: str):
    try:
        # Update batch status to processing
        supabase.table("batches").update({"status": "processing"}).eq("id", batch_id).execute()
        
        tasks = []
        # Create folios for each file with status pending
        for file in files:
            folio_data = {
                "batch_id": batch_id,
                "tenant_id": tenant_id,
                "status": "pending",
                "r2_url": file,
            }
            res = supabase.table("folios").insert(folio_data).execute()
            
            # Prepare processing task
            if res.data:
                folio_id = res.data[0]["id"]
                tasks.append(async_process_file(folio_id, file, user_client, batch_id))
                
        # Wait for all files in this batch to finish processing
        if tasks:
            await asyncio.gather(*tasks)
        
        supabase.table("batches").update({"status": "ready"}).eq("id", batch_id).execute()
    except Exception as e:
        print(f"Error processing batch {batch_id}: {e}")
        supabase.table("batches").update({"status": "failed"}).eq("id", batch_id).execute()

@app.post("/api/v1/ingest")
async def ingest_batch(request: IngestRequest, background_tasks: BackgroundTasks, auth: Dict[str, Any] = Depends(get_auth_context)):
    try:
        batch_res = supabase.table("batches").select("id, template_id, tenant_id").eq("id", request.batch_id).eq("tenant_id", auth["tenant_id"]).execute()
        if not batch_res.data or len(batch_res.data) == 0:
            raise HTTPException(status_code=404, detail="El lote especificado no existe.")
        batch_obj = batch_res.data[0]
        if not batch_obj.get("template_id"):
            raise HTTPException(status_code=400, detail="El lote no tiene un formulario/plantilla asignado. No se pueden subir folios sin plantilla.")

        # Confirm upload and dispatch the background task
        background_tasks.add_task(process_batch_task, request.batch_id, request.files, auth["user_client"], auth["tenant_id"])
        
        return {"status": "success", "message": f"Batch {request.batch_id} ingestion task dispatched."}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"Error in ingest_batch: {str(e)}"); raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/upload/url")
async def get_upload_url(filename: str, content_type: str, auth: Dict[str, Any] = Depends(get_auth_context)):
    tenant_id = auth["tenant_id"]
    file_uuid = str(uuid.uuid4())
    key = f"{tenant_id}/{file_uuid}-{filename}"
    url = s3_client.generate_presigned_url(
        'put_object',
        Params={
            'Bucket': os.getenv('R2_BUCKET_NAME'),
            'Key': key,
            'ContentType': content_type
        },
        ExpiresIn=3600
    )
    return {"url": url, "key": key}


@app.get("/")
def health_check():
    return {"status": "ok"}

@app.post("/active-learning/feedback")
async def register_feedback(request: FeedbackRequest, auth: Dict[str, Any] = Depends(get_auth_context)):
    try:
        data = {
            "tenant_id": auth["tenant_id"],
            "folio_id": request.folio_id,
            "field_name": request.field_name,
            "predicted_value": request.predicted_value,
            "actual_value": request.actual_value,
        }
        user_client = auth["user_client"]
        user_client.table("training_data").insert(data).execute()
        return {"status": "success", "message": "Feedback registered successfully"}
    except Exception as e:
        print(f"Error in register_feedback: {str(e)}"); raise HTTPException(status_code=500, detail=str(e))

def _get_r2_training_data_key(tenant_id: str) -> str:
    return f"_system/training_data/{tenant_id}.json"

def _load_r2_training_data(tenant_id: str) -> List[Dict[str, Any]]:
    bucket = os.getenv("R2_BUCKET_NAME")
    if not bucket or not tenant_id:
        return []
    try:
        key = _get_r2_training_data_key(tenant_id)
        obj = s3_client.get_object(Bucket=bucket, Key=key)
        raw = obj["Body"].read().decode("utf-8")
        data = json.loads(raw)
        if isinstance(data, list):
            return data
    except Exception as e:
        print(f"Info reading training_data from R2 for {tenant_id}: {e}")
    return []

def _save_r2_training_data(tenant_id: str, new_rows: List[Dict[str, Any]]) -> None:
    bucket = os.getenv("R2_BUCKET_NAME")
    if not bucket or not tenant_id or not new_rows:
        return
    try:
        existing = _load_r2_training_data(tenant_id)
        # Deduplicate / merge rows by id or (folio_id + field_name)
        combined_map = {}
        for row in existing:
            row_key = row.get("id") or f"{row.get('folio_id')}_{row.get('field_name')}"
            combined_map[row_key] = row
        for row in new_rows:
            row_key = row.get("id") or f"{row.get('folio_id')}_{row.get('field_name')}"
            combined_map[row_key] = row
        merged = list(combined_map.values())

        key = _get_r2_training_data_key(tenant_id)
        s3_client.put_object(
            Bucket=bucket,
            Key=key,
            Body=json.dumps(merged, ensure_ascii=False, indent=2).encode("utf-8"),
            ContentType="application/json"
        )
    except Exception as e:
        print(f"Warning saving training_data to R2 for {tenant_id}: {e}")

@app.post("/api/v1/ai/feedback")
async def record_ai_feedback(request: AIFeedbackPayload, auth: Dict[str, Any] = Depends(get_auth_context)):
    try:
        tenant_id = auth["tenant_id"]
        user_id = auth.get("user_id")
        user_client = auth["user_client"]
        
        items_to_process = []
        raw_items = request.items or request.feedback
        if raw_items:
            items_to_process.extend(raw_items)
        elif request.field_name:
            items_to_process.append(AIFeedbackItem(
                field_name=request.field_name,
                predicted_value=request.predicted_value or "",
                actual_value=request.actual_value or ""
            ))
            
        rows_to_insert = []
        for item in items_to_process:
            pred = str(item.predicted_value or "").strip()
            act = str(item.actual_value or "").strip()
            
            # Auto-determine action_type if not specified
            action_type = item.action_type
            if not action_type:
                if pred and not act:
                    action_type = "rejected_blank"
                elif pred and act and pred == act:
                    action_type = "accepted_exact"
                elif not pred and act:
                    action_type = "manual_inserted"
                else:
                    action_type = "corrected_text"
                    
            row: Dict[str, Any] = {
                "id": str(uuid.uuid4()),
                "tenant_id": tenant_id,
                "folio_id": request.folio_id,
                "field_name": item.field_name,
                "predicted_value": pred,
                "actual_value": act,
                "confidence": item.confidence or 0.0,
                "action_type": action_type,
                "corrected_by_user_id": user_id,
            }
            if item.bbox:
                row["bbox_x"] = item.bbox.get("x", 0.0)
                row["bbox_y"] = item.bbox.get("y", 0.0)
                row["bbox_width"] = item.bbox.get("width", 0.0)
                row["bbox_height"] = item.bbox.get("height", 0.0)
                
            rows_to_insert.append(row)
            
        if rows_to_insert:
            # 1. Intentar persistir en Supabase
            try:
                user_client.table("training_data").insert(rows_to_insert).execute()
            except Exception as sb_err:
                try:
                    supabase.table("training_data").insert(rows_to_insert).execute()
                except Exception as sb_err2:
                    print(f"Warning: could not insert feedback in Supabase training_data: {sb_err2}")
            # 2. Persistir siempre en Cloudflare R2 como almacén garantizado
            _save_r2_training_data(tenant_id, rows_to_insert)
                
        return {
            "status": "success",
            "message": f"{len(rows_to_insert)} feedback entries recorded successfully",
            "recorded": len(rows_to_insert)
        }
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        print(f"Error recording AI feedback: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/ai/metrics")
async def get_ai_metrics(auth: Dict[str, Any] = Depends(get_auth_context)):
    try:
        role = auth.get("role")
        if role not in ["admin", "archivist", "superadmin"]:
            raise HTTPException(status_code=403, detail="Permiso denegado para consultar métricas de IA")
            
        tenant_id = auth["tenant_id"]
        user_client = auth["user_client"]
        
        rows: List[Dict[str, Any]] = []
        try:
            res = user_client.table("training_data").select("*").eq("tenant_id", tenant_id).execute()
            if res.data:
                rows.extend(res.data)
        except Exception as q_err:
            try:
                res = supabase.table("training_data").select("*").eq("tenant_id", tenant_id).execute()
                if res.data:
                    rows.extend(res.data)
            except Exception as sb_err:
                print(f"Info querying supabase training_data: {sb_err}")

        # Si falló Supabase o para complementar con R2
        r2_rows = _load_r2_training_data(tenant_id)
        if r2_rows:
            combined_map = {}
            for r in rows:
                key = r.get("id") or f"{r.get('folio_id')}_{r.get('field_name')}"
                combined_map[key] = r
            for r in r2_rows:
                key = r.get("id") or f"{r.get('folio_id')}_{r.get('field_name')}"
                if key not in combined_map:
                    combined_map[key] = r
            rows = list(combined_map.values())
        
        total_accepted = 0
        total_corrected = 0
        total_rejected = 0
        by_field: Dict[str, Dict[str, Any]] = {}
        
        for r in rows:
            fn = r.get("field_name") or "otro"
            if fn not in by_field:
                by_field[fn] = {"suggestions": 0, "accepted": 0, "corrected": 0, "accuracy": 0.0}
                
            act_type = r.get("action_type") or "corrected_text"
            if act_type == "accepted_exact":
                total_accepted += 1
                by_field[fn]["accepted"] += 1
                by_field[fn]["suggestions"] += 1
            elif act_type == "corrected_text":
                total_corrected += 1
                by_field[fn]["corrected"] += 1
                by_field[fn]["suggestions"] += 1
            elif act_type == "rejected_blank":
                total_rejected += 1
                by_field[fn]["suggestions"] += 1
            elif act_type == "manual_inserted":
                pass
                
        total_suggestions = total_accepted + total_corrected + total_rejected
        acceptance_rate = round((total_accepted / total_suggestions) * 100, 1) if total_suggestions > 0 else 0.0
        
        if total_suggestions == 0:
            return {
                "status": "success",
                "data": {
                    "acceptance_rate": 0.0,
                    "total_suggestions": 0,
                    "total_accepted": 0,
                    "total_corrected": 0,
                    "total_rejected": 0,
                    "by_field": {}
                }
            }

        for fn, f_data in by_field.items():
            s = f_data["suggestions"]
            f_data["accuracy"] = round((f_data["accepted"] / s) * 100, 1) if s > 0 else 0.0
            
        return {
            "status": "success",
            "data": {
                "acceptance_rate": acceptance_rate,
                "total_suggestions": total_suggestions,
                "total_accepted": total_accepted,
                "total_corrected": total_corrected,
                "total_rejected": total_rejected,
                "by_field": by_field
            }
        }
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        print(f"Error fetching AI metrics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

def ensure_folio_ai_predictions(
    folio_data: Dict[str, Any], tenant_id: str, force: bool = False
) -> List[Dict[str, Any]]:
    """
    Garantiza que el folio cuente con predicciones estructuradas de IA (con bbox normalizado
    y bbox_array [xmin, ymin, xmax, ymax]) alineadas con los campos reales de la plantilla del lote
    y el historial de Active Learning del tenant.
    """
    if not folio_data or not isinstance(folio_data, dict):
        return []

    folio_id = str(folio_data.get("id") or "")
    batch_id = folio_data.get("batch_id")
    effective_tenant_id = str(tenant_id or folio_data.get("tenant_id") or "")

    template_fields: List[Dict[str, Any]] = []
    try:
        if batch_id and effective_tenant_id:
            batch_res = (
                supabase.table("batches")
                .select("template_id")
                .eq("id", batch_id)
                .eq("tenant_id", effective_tenant_id)
                .execute()
            )
            if batch_res.data and len(batch_res.data) > 0:
                template_id = batch_res.data[0].get("template_id")
                if template_id:
                    tpl_res = (
                        supabase.table("templates")
                        .select("fields")
                        .eq("id", template_id)
                        .eq("tenant_id", effective_tenant_id)
                        .execute()
                    )
                    if tpl_res.data and len(tpl_res.data) > 0:
                        raw_fields = tpl_res.data[0].get("fields")
                        if isinstance(raw_fields, list):
                            template_fields = raw_fields
    except Exception as tpl_err:
        print(f"Notice fetching template fields in ensure_folio_ai_predictions: {tpl_err}")

    existing_preds = folio_data.get("ai_predictions")
    if not force and isinstance(existing_preds, list) and len(existing_preds) > 0:
        expected_keys = {
            str(f.get("id") or f.get("name") or f"field_{idx}")
            for idx, f in enumerate(template_fields)
            if isinstance(f, dict)
        }
        existing_keys = {
            str(p.get("fieldKey") or p.get("field_key") or "")
            for p in existing_preds
            if isinstance(p, dict) and isinstance(p.get("bbox"), dict)
        }
        if (not expected_keys or expected_keys.issubset(existing_keys)) and len(existing_keys) > 0:
            for p in existing_preds:
                if isinstance(p, dict) and isinstance(p.get("bbox"), dict) and "bbox_array" not in p:
                    bx = float(p["bbox"].get("x", 0.1))
                    by = float(p["bbox"].get("y", 0.1))
                    bw = float(p["bbox"].get("width", 0.3))
                    bh = float(p["bbox"].get("height", 0.04))
                    coords = [round(bx, 4), round(by, 4), round(bx + bw, 4), round(by + bh, 4)]
                    p["bbox_array"] = coords
                    p["bbox_coords"] = coords
            return existing_preds

    if not template_fields:
        return existing_preds if isinstance(existing_preds, list) else []

    training_rows: List[Dict[str, Any]] = []
    if effective_tenant_id:
        try:
            td_res = (
                supabase.table("training_data")
                .select("*")
                .eq("tenant_id", effective_tenant_id)
                .limit(100)
                .execute()
            )
            if td_res.data:
                training_rows = list(td_res.data)
        except Exception as td_err:
            print(f"Notice fetching training_data: {td_err}")

        # Complementar con metadatos validados de folios completados del mismo tenant
        if not training_rows:
            try:
                comp_res = (
                    supabase.table("folios")
                    .select("metadata")
                    .eq("tenant_id", effective_tenant_id)
                    .eq("status", "completed")
                    .limit(25)
                    .execute()
                )
                if comp_res.data:
                    for c_row in comp_res.data:
                        meta = c_row.get("metadata")
                        if isinstance(meta, dict):
                            for mk, mv in meta.items():
                                if mv is not None and str(mv).strip():
                                    training_rows.append({
                                        "tenant_id": effective_tenant_id,
                                        "field_name": str(mk),
                                        "actual_value": str(mv).strip(),
                                    })
            except Exception:
                pass

    ocr_boxes: List[Dict[str, Any]] = []
    img_width, img_height = 1200, 1600
    r2_key = folio_data.get("r2_url")
    bucket_name = os.getenv("R2_BUCKET_NAME")

    if r2_key and bucket_name and not str(r2_key).endswith(".dzi"):
        try:
            import tempfile
            with tempfile.TemporaryDirectory() as tmp_dir:
                safe_name = os.path.basename(str(r2_key)) or "folio.jpg"
                local_img = os.path.join(tmp_dir, safe_name)
                s3_client.download_file(bucket_name, str(r2_key), local_img)
                ocr_out = extract_text_and_boxes(local_img)
                if isinstance(ocr_out, tuple) and len(ocr_out) == 3:
                    ocr_boxes, img_width, img_height = ocr_out
                elif isinstance(ocr_out, list):
                    ocr_boxes = ocr_out
        except Exception as img_err:
            print(f"Notice: using standard dimensions for folio {folio_id}: {img_err}")

    predictions = generate_template_ai_predictions(
        template_fields=template_fields,
        ocr_boxes=ocr_boxes,
        img_width=img_width,
        img_height=img_height,
        training_rows=training_rows,
        folio_id=folio_id,
    )

    if folio_id and effective_tenant_id and predictions:
        try:
            supabase.table("folios").update({"ai_predictions": predictions}).eq(
                "id", folio_id
            ).eq("tenant_id", effective_tenant_id).execute()
        except Exception as upd_err:
            print(f"Notice saving ai_predictions for folio {folio_id}: {upd_err}")

    folio_data["ai_predictions"] = predictions
    return predictions


@app.post("/api/v1/folios/get_next")
async def get_next_folio(auth: Dict[str, Any] = Depends(get_auth_context)):
    try:
        user_client = auth["user_client"]
        tenant_id = auth["tenant_id"]

        folio_data = None
        try:
            in_prog_res = (
                supabase.table("folios")
                .select("*")
                .eq("tenant_id", tenant_id)
                .eq("status", "in_progress")
                .order("locked_at", desc=True)
                .execute()
            )
            if (
                isinstance(in_prog_res.data, list)
                and len(in_prog_res.data) > 0
                and isinstance(in_prog_res.data[0], dict)
                and in_prog_res.data[0].get("status") == "in_progress"
            ):
                folio_data = in_prog_res.data[0]
                now_iso = datetime.now(timezone.utc).isoformat()
                supabase.table("folios").update({"locked_at": now_iso}).eq(
                    "id", folio_data["id"]
                ).eq("tenant_id", tenant_id).execute()
                folio_data["locked_at"] = now_iso
        except Exception as check_err:
            print(f"Notice checking existing in_progress folios: {check_err}")

        if not folio_data:
            res = supabase.rpc("get_next_folio", {"p_tenant_id": tenant_id}).execute()
            if not res.data or len(res.data) == 0:
                return {"status": "success", "data": None}
            folio_data = res.data[0]

        active_folio_id = folio_data.get("id")
        if active_folio_id:
            try:
                supabase.table("folios").update({
                    "status": "pending",
                    "locked_at": None
                }).eq("tenant_id", tenant_id).eq("status", "in_progress").neq("id", active_folio_id).execute()
            except Exception as cleanup_err:
                print(f"Notice releasing extra in_progress folios: {cleanup_err}")

        ensure_folio_ai_predictions(folio_data, tenant_id)

        # Attach template_id and full template object
        template_id = None
        template_obj = None
        batch_id = folio_data.get("batch_id")
        if batch_id:
            try:
                b_res = (
                    supabase.table("batches")
                    .select("template_id")
                    .eq("id", batch_id)
                    .eq("tenant_id", tenant_id)
                    .execute()
                )
                if b_res.data and len(b_res.data) > 0:
                    template_id = b_res.data[0].get("template_id")
            except Exception as b_err:
                print(f"Notice fetching batch template_id in get_next_folio: {b_err}")

        if template_id:
            try:
                t_res = (
                    supabase.table("templates")
                    .select("*")
                    .eq("id", template_id)
                    .eq("tenant_id", tenant_id)
                    .execute()
                )
                if t_res.data and len(t_res.data) > 0:
                    template_obj = t_res.data[0]
            except Exception as t_err:
                print(f"Notice fetching template object in get_next_folio: {t_err}")

        folio_data["template_id"] = template_id
        folio_data["template"] = template_obj

        if folio_data.get("r2_url"):
            try:
                view_url = s3_client.generate_presigned_url(
                    'get_object',
                    Params={
                        'Bucket': os.getenv('R2_BUCKET_NAME'),
                        'Key': folio_data["r2_url"]
                    },
                    ExpiresIn=3600
                )
                folio_data["view_url"] = view_url
            except Exception as e:
                print(f"Error generando view_url: {e}")

        return {"status": "success", "data": folio_data}
    except Exception as e:
        print(f"Error in get_next_folio: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/folios/{folio_id}/release")
async def release_folio(folio_id: str, auth: Dict[str, Any] = Depends(get_auth_context)):
    try:
        role = auth.get("role")
        if role not in ["admin", "archivist", "superadmin"]:
            raise HTTPException(status_code=403, detail="No tienes permisos para liberar este folio")

        tenant_id = auth["tenant_id"]
        res = supabase.table("folios").update({
            "status": "pending",
            "locked_at": None
        }).eq("id", folio_id).eq("tenant_id", tenant_id).execute()

        return {"status": "success", "message": "Folio liberado a la cola exitosamente"}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"Error releasing folio {folio_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/folios/{folio_id}")
async def get_folio_by_id(folio_id: str, auth: Dict[str, Any] = Depends(get_auth_context)):
    try:
        tenant_id = auth["tenant_id"]
        res = supabase.table("folios").select("*").eq("id", folio_id).eq("tenant_id", tenant_id).execute()
        if not res.data or len(res.data) == 0:
            raise HTTPException(status_code=404, detail="Folio no encontrado")

        folio_data = res.data[0]

        try:
            supabase.table("folios").update({
                "status": "pending",
                "locked_at": None
            }).eq("tenant_id", tenant_id).eq("status", "in_progress").neq("id", folio_id).execute()
        except Exception as cleanup_err:
            print(f"Notice releasing other in_progress folios in get_folio_by_id: {cleanup_err}")

        ensure_folio_ai_predictions(folio_data, tenant_id)

        # Attach template_id and full template object
        template_id = None
        template_obj = None
        batch_id = folio_data.get("batch_id")
        if batch_id:
            try:
                b_res = (
                    supabase.table("batches")
                    .select("template_id")
                    .eq("id", batch_id)
                    .eq("tenant_id", tenant_id)
                    .execute()
                )
                if b_res.data and len(b_res.data) > 0:
                    template_id = b_res.data[0].get("template_id")
            except Exception as b_err:
                print(f"Notice fetching batch template_id in get_folio_by_id: {b_err}")

        if template_id:
            try:
                t_res = (
                    supabase.table("templates")
                    .select("*")
                    .eq("id", template_id)
                    .eq("tenant_id", tenant_id)
                    .execute()
                )
                if t_res.data and len(t_res.data) > 0:
                    template_obj = t_res.data[0]
            except Exception as t_err:
                print(f"Notice fetching template object in get_folio_by_id: {t_err}")

        folio_data["template_id"] = template_id
        folio_data["template"] = template_obj

        if folio_data.get("r2_url"):
            try:
                view_url = s3_client.generate_presigned_url(
                    'get_object',
                    Params={
                        'Bucket': os.getenv('R2_BUCKET_NAME'),
                        'Key': folio_data["r2_url"]
                    },
                    ExpiresIn=3600
                )
                folio_data["view_url"] = view_url
            except Exception as e:
                print(f"Error generando view_url: {e}")

        return {"status": "success", "data": folio_data}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"Error in get_folio_by_id: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/folios/{folio_id}/analyze-ai")
async def analyze_folio_ai(folio_id: str, auth: Dict[str, Any] = Depends(get_auth_context)):
    try:
        tenant_id = auth["tenant_id"]
        res = (
            supabase.table("folios")
            .select("*")
            .eq("id", folio_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not res.data or len(res.data) == 0:
            raise HTTPException(status_code=404, detail="Folio no encontrado")

        folio_data = res.data[0]
        predictions = ensure_folio_ai_predictions(folio_data, tenant_id, force=True)
        return {"status": "success", "ai_predictions": predictions}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"Error in analyze_folio_ai: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

import asyncio
from datetime import datetime, timezone

async def release_locked_folios():
    while True:
        try:
            # We can run an RPC or query/update
            # Assuming supabase client has admin privileges
            admin_client = supabase
            fifteen_mins_ago = (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat()
            
            # Find locked folios
            res = admin_client.table("folios").select("id").eq("status", "in_progress").lt("locked_at", fifteen_mins_ago).execute()
            
            if res.data:
                for f in res.data:
                    admin_client.table("folios").update({
                        "status": "pending",
                        "locked_at": None
                    }).eq("id", f["id"]).execute()
                    
        except Exception as e:
            print(f"Error releasing locks: {e}")
            
        await asyncio.sleep(60) # Run every minute

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(release_locked_folios())


class TeamInviteRequest(BaseModel):
    email: str
    role: str

@app.get("/api/v1/team")
async def get_team(auth: Dict[str, Any] = Depends(get_auth_context)):
    tenant_id = auth["tenant_id"]
    try:
        res = supabase.table("user_profiles").select("user_id, role, is_active, first_name, last_name").eq("tenant_id", tenant_id).execute()
        profiles = res.data or []
        
        team = []
        for p in profiles:
            email = "Unknown"
            try:
                user_data = supabase.auth.admin.get_user_by_id(p["user_id"])
                email = user_data.user.email
            except:
                pass
            
            name = f"{p.get('first_name') or ''} {p.get('last_name') or ''}".strip() or "Unnamed"
            team.append({
                "user_id": p["user_id"],
                "name": name,
                "email": email,
                "role": p["role"],
                "is_active": p.get("is_active", True),
                "folios_today": 0
            })
            
        return {"status": "success", "data": team}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        print(f"Error in get_team: {str(e)}"); raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/team/invite")
async def invite_team_member(request: TeamInviteRequest, auth: Dict[str, Any] = Depends(get_auth_context)):
    tenant_id = auth["tenant_id"]
    if request.role not in ["admin", "archivist", "digitizer"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    try:
        res = supabase.auth.admin.invite_user_by_email(request.email, options={"redirect_to": "https://codexflow-frontend.vercel.app/welcome"})
        user_id = res.user.id
        
        profile_res = supabase.table("user_profiles").select("*").eq("user_id", user_id).execute()
        if profile_res.data:
            prof = profile_res.data[0]
            if prof.get("tenant_id") == tenant_id:
                if prof.get("is_active") is False:
                    raise HTTPException(status_code=400, detail="Usuario ya existe, reactívelo manualmente")
                else:
                    raise HTTPException(status_code=400, detail="El usuario ya es parte del equipo")
            elif prof.get("tenant_id") is not None:
                raise HTTPException(status_code=400, detail="El usuario ya pertenece a otra organización")
                
        profile_data = {
            "user_id": user_id,
            "tenant_id": tenant_id,
            "role": request.role,
            "is_active": True
        }
        supabase.table("user_profiles").upsert(profile_data).execute()
        
        return {"status": "success", "message": f"User {request.email} invited successfully."}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        print(f"Error in invite_team_member: {str(e)}"); raise HTTPException(status_code=500, detail=str(e))

class UpdateTeamMemberRequest(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None

@app.patch("/api/v1/team/{target_user_id}")
async def update_team_member(target_user_id: str, request: UpdateTeamMemberRequest, auth: Dict[str, Any] = Depends(get_auth_context)):
    tenant_id = auth["tenant_id"]
    caller_id = auth["user_id"]
    caller_role = auth["role"]
    
    if caller_role != "admin" and caller_role != "superadmin":
        raise HTTPException(status_code=403, detail="Only admins can manage team")
        
    if caller_id == target_user_id:
        raise HTTPException(status_code=400, detail="No puedes modificar tu propio rol o estado")
        
    try:
        # Prevent demoting or deactivating the last active admin
        if request.role is not None and request.role != "admin" or request.is_active is False:
            admins_res = supabase.table("user_profiles").select("user_id").eq("tenant_id", tenant_id).eq("role", "admin").eq("is_active", True).execute()
            if admins_res.data and len(admins_res.data) == 1 and admins_res.data[0]["user_id"] == target_user_id:
                raise HTTPException(status_code=400, detail="No puedes degradar o desactivar al último administrador activo")
                
        update_data = {}
        if request.role is not None:
            update_data["role"] = request.role
        if request.is_active is not None:
            update_data["is_active"] = request.is_active
            
        res = supabase.table("user_profiles").update(update_data).eq("user_id", target_user_id).eq("tenant_id", tenant_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Usuario no encontrado en esta organización")
            
        return {"status": "success", "message": "User updated successfully"}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        print(f"Error in update_team_member: {str(e)}"); raise HTTPException(status_code=500, detail=str(e))

class KeyRegenerateRequest(BaseModel):
    tenant_id: str

@app.post("/api/v1/keys/regenerate")
async def regenerate_api_key(request: KeyRegenerateRequest, authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    
    token = authorization.split(" ")[1] if " " in authorization else authorization
    
    try:
        res = supabase.auth.get_user(token)
        if not res or not res.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_id = res.user.id
        
        profile_res = supabase.table("user_profiles").select("role").eq("user_id", user_id).eq("tenant_id", request.tenant_id).execute()
        
        if not profile_res.data or profile_res.data[0].get("role") != "admin":
            raise HTTPException(status_code=403, detail="Only admins can regenerate API keys")
        
        raw_key = secrets.token_urlsafe(32)
        hashed_key = hashlib.sha256(raw_key.encode()).hexdigest()
        
        upsert_data = {
            "tenant_id": request.tenant_id,
            "hashed_key": hashed_key
        }
        supabase.table("api_keys").upsert(upsert_data).execute()
        
        return {
            "status": "success",
            "message": "API Key regenerated successfully",
            "api_key": raw_key
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"Error in create_tenant: {str(e)}"); raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/export")
async def export_data(batch_id: Optional[str] = None, x_api_key: str = Header(None)):
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing API Key")
    
    hashed_key = hashlib.sha256(x_api_key.encode()).hexdigest()
    
    # Verify API key
    key_res = supabase.table("api_keys").select("tenant_id").eq("hashed_key", hashed_key).execute()
    if not key_res.data:
        raise HTTPException(status_code=401, detail="Invalid API Key")
    
    tenant_id = key_res.data[0]["tenant_id"]
    
    # Check Soft Paywall
    quota_res = supabase.table("tenant_quotas").select("*").eq("tenant_id", tenant_id).execute()
    if quota_res.data:
        quota = quota_res.data[0]
        used = quota.get("used_this_week", 0)
        limit = quota.get("weekly_limit", float('inf'))
        if used >= limit:
            raise HTTPException(status_code=402, detail="Payment Required: Weekly limit reached")
            
    # Query folios
    query = supabase.table("folios").select("id, status, created_at, verified_at, ai_predictions, metadata, batch_id").eq("tenant_id", tenant_id).eq("status", "completed")
    
    if batch_id:
        query = query.eq("batch_id", batch_id)
    else:
        thirty_days_ago = (datetime.now() - timedelta(days=30)).isoformat()
        query = query.gte("created_at", thirty_days_ago)
        
    try:
        folios_res = query.execute()
    except Exception as e:
        print(f"Error in create_tenant: {str(e)}"); raise HTTPException(status_code=500, detail=str(e))
    
    results = []
    if folios_res.data:
        for f in folios_res.data:
            results.append({
                "id": f.get("id"),
                "batch_id": f.get("batch_id"),
                "status": f.get("status"),
                "created_at": f.get("created_at"),
                "verified_at": f.get("verified_at"),
                "metadata": f.get("metadata", {}),
                "ai_predictions": f.get("ai_predictions", {})
            })
            
    return results

from fastapi.responses import Response, StreamingResponse
import csv
import io

@app.get("/api/v1/export/csv")
async def export_data_csv(batch_id: Optional[str] = None, x_api_key: str = Header(None)):
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing API Key")
    
    hashed_key = hashlib.sha256(x_api_key.encode()).hexdigest()
    
    # Verify API key
    key_res = supabase.table("api_keys").select("tenant_id").eq("hashed_key", hashed_key).execute()
    if not key_res.data:
        raise HTTPException(status_code=401, detail="Invalid API Key")
    
    tenant_id = key_res.data[0]["tenant_id"]
    
    # Check Soft Paywall
    quota_res = supabase.table("tenant_quotas").select("*").eq("tenant_id", tenant_id).execute()
    if quota_res.data:
        quota = quota_res.data[0]
        used = quota.get("used_this_week", 0)
        limit = quota.get("weekly_limit", float('inf'))
        if used >= limit:
            raise HTTPException(status_code=402, detail="Payment Required: Weekly limit reached")
            
    # Get Template fields
    template_res = supabase.table("templates").select("fields").eq("tenant_id", tenant_id).execute()
    template_fields = []
    if template_res.data and "fields" in template_res.data[0]:
        fields_data = template_res.data[0]["fields"]
        if isinstance(fields_data, list):
            # Could be list of strings or list of dicts with 'name'
            if len(fields_data) > 0 and isinstance(fields_data[0], dict):
                template_fields = [f.get("name") for f in fields_data if "name" in f]
            else:
                template_fields = [str(f) for f in fields_data]
        elif isinstance(fields_data, dict):
            template_fields = list(fields_data.keys())
            
    # Query folios
    query = supabase.table("folios").select("id, status, created_at, verified_at, ai_predictions, metadata, batch_id").eq("tenant_id", tenant_id).eq("status", "completed")
    
    if batch_id:
        query = query.eq("batch_id", batch_id)
    else:
        thirty_days_ago = (datetime.now() - timedelta(days=30)).isoformat()
        query = query.gte("created_at", thirty_days_ago)
        
    try:
        folios_res = query.execute()
    except Exception as e:
        print(f"Error in create_tenant: {str(e)}"); raise HTTPException(status_code=500, detail=str(e))
        
    base_columns = ["id", "batch_id", "status", "created_at", "verified_at"]
    all_columns = base_columns + template_fields
    
    def iter_csv():
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=all_columns)
        writer.writeheader()
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)
        
        if folios_res.data:
            for f in folios_res.data:
                row = {
                    "id": f.get("id", ""),
                    "batch_id": f.get("batch_id", ""),
                    "status": f.get("status", ""),
                    "created_at": f.get("created_at", ""),
                    "verified_at": f.get("verified_at", "")
                }
                predictions = f.get("ai_predictions") or {}
                for field in template_fields:
                    row[field] = predictions.get(field, "")
                writer.writerow(row)
                yield output.getvalue()
                output.seek(0)
                output.truncate(0)
                
    return StreamingResponse(
        iter_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=export.csv"}
    )

@app.get("/api/superadmin/tenants")
async def get_all_tenants(auth: Dict[str, Any] = Depends(get_superadmin_context)):
    try:
        # Join tenants and tenant_quotas
        res = supabase.table("tenants").select("id, name, created_at, is_active, country, contact_name, tax_id, phone, tenant_quotas(weekly_limit, used_this_week)").execute()
        tenants = res.data or []
        
        profiles = supabase.table("user_profiles").select("user_id, tenant_id").eq("role", "admin").execute()
        tenant_admins = {p["tenant_id"]: p["user_id"] for p in profiles.data} if profiles.data else {}
        
        for t in tenants:
            t["admin_email"] = None
            t["last_sign_in_at"] = None
            admin_id = tenant_admins.get(t["id"])
            if admin_id:
                try:
                    admin_user = supabase.auth.admin.get_user_by_id(admin_id)
                    t["admin_email"] = admin_user.user.email
                    t["last_sign_in_at"] = admin_user.user.last_sign_in_at
                except:
                    pass
        
        return {"status": "success", "data": tenants}
    except Exception as e:
        print(f"Error in create_tenant: {str(e)}"); raise HTTPException(status_code=500, detail=str(e))

class TenantStatusUpdateRequest(BaseModel):
    is_active: bool

@app.patch("/api/superadmin/tenants/{tenant_id}/status")
async def update_tenant_status(tenant_id: str, request: TenantStatusUpdateRequest, auth: Dict[str, Any] = Depends(get_superadmin_context)):
    try:
        res = supabase.table("tenants").update({"is_active": request.is_active}).eq("id", tenant_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Tenant not found")
        return {"status": "success", "data": res.data[0]}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"Error in create_tenant: {str(e)}"); raise HTTPException(status_code=500, detail=str(e))

class ResendInviteRequest(BaseModel):
    email: str

@app.post("/api/superadmin/tenants/{tenant_id}/resend-invite")
async def resend_tenant_invite(tenant_id: str, request: ResendInviteRequest, auth: Dict[str, Any] = Depends(get_superadmin_context)):
    try:
        res = supabase.auth.admin.invite_user_by_email(request.email, options={"redirect_to": "https://codexflow-frontend.vercel.app/welcome"})
        return {"status": "success", "message": "Invitación reenviada exitosamente"}
    except Exception as e:
        print(f"Error in create_tenant: {str(e)}"); raise HTTPException(status_code=500, detail=str(e))

class TenantCreateRequest(BaseModel):
    name: str
    weekly_limit: int
    admin_email: str
    country: Optional[str] = None
    contact_name: Optional[str] = None
    tax_id: Optional[str] = None
    phone: Optional[str] = None

@app.post("/api/superadmin/tenants")
async def create_tenant(request: TenantCreateRequest, auth: Dict[str, Any] = Depends(get_superadmin_context)):
    try:
        # Invite admin user via Supabase Auth Admin API
        # If user exists, this usually just returns the user or re-sends invite
        invite_res = supabase.auth.admin.invite_user_by_email(request.admin_email, options={"redirect_to": "https://codexflow-frontend.vercel.app/welcome"})
        user_id = invite_res.user.id
        
        # Check if user already belongs to another tenant
        profile_res = supabase.table("user_profiles").select("tenant_id").eq("user_id", user_id).execute()
        if profile_res.data and profile_res.data[0].get("tenant_id"):
            raise HTTPException(status_code=400, detail="El usuario ya pertenece a otra organización")

        # Insert new tenant
        tenant_data = {
            "name": request.name,
            "country": request.country,
            "contact_name": request.contact_name,
            "tax_id": request.tax_id,
            "phone": request.phone
        }
        tenant_res = supabase.table("tenants").insert(tenant_data).execute()
        if not tenant_res.data:
            raise HTTPException(status_code=500, detail="Failed to create tenant")
        tenant_id = tenant_res.data[0]["id"]
        
        # Insert quota
        quota_data = {"tenant_id": tenant_id, "weekly_limit": request.weekly_limit}
        supabase.table("tenant_quotas").insert(quota_data).execute()
        
        # Insert/Update user profile
        profile_data = {
            "user_id": user_id,
            "tenant_id": tenant_id,
            "role": "admin"
        }
        supabase.table("user_profiles").upsert(profile_data).execute()
        
        return {
            "status": "success",
            "message": "Tenant created and admin invited successfully",
            "tenant_id": tenant_id
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"Error in create_tenant: {str(e)}"); raise HTTPException(status_code=500, detail=str(e))

class QuotaUpdateRequest(BaseModel):
    weekly_limit: int

@app.put("/api/superadmin/tenants/{tenant_id}/quota")
async def update_tenant_quota(tenant_id: str, request: QuotaUpdateRequest, auth: Dict[str, Any] = Depends(get_superadmin_context)):
    try:
        res = supabase.table("tenant_quotas").update({"weekly_limit": request.weekly_limit}).eq("tenant_id", tenant_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Tenant quota not found")
        return {"status": "success", "message": "Quota updated successfully", "data": res.data[0]}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"Error in create_tenant: {str(e)}"); raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/superadmin/orphans")
async def get_orphans(auth: Dict[str, Any] = Depends(get_superadmin_context)):
    try:
        res = supabase.table("user_profiles").select("*").eq("role", "pending").execute()
        
        orphans = []
        for p in res.data:
            if p.get("role") != "rejected":
                try:
                    user_data = supabase.auth.admin.get_user_by_id(p["user_id"])
                    email = user_data.user.email
                except:
                    email = "Unknown"
                
                orphans.append({
                    "user_id": p["user_id"],
                    "role": p.get("role"),
                    "email": email
                })
        return {"status": "success", "data": orphans}
    except Exception as e:
        print(f"Error in create_tenant: {str(e)}"); raise HTTPException(status_code=500, detail=str(e))

class ResolveOrphanRequest(BaseModel):
    action: str
    tenant_id: Optional[str] = None
    role: Optional[str] = None
    tenant_name: Optional[str] = None

@app.post("/api/superadmin/orphans/{user_id}/resolve")
async def resolve_orphan(user_id: str, request: ResolveOrphanRequest, auth: Dict[str, Any] = Depends(get_superadmin_context)):
    try:
        if request.action == "reject":
            res = supabase.table("user_profiles").update({"role": "rejected"}).eq("user_id", user_id).execute()
        elif request.action == "assign":
            if not request.tenant_id or not request.role:
                raise HTTPException(status_code=400, detail="tenant_id and role required for assign")
            res = supabase.table("user_profiles").update({
                "tenant_id": request.tenant_id,
                "role": request.role
            }).eq("user_id", user_id).execute()
        elif request.action == "create_tenant":
            if not request.tenant_name:
                raise HTTPException(status_code=400, detail="tenant_name required for create_tenant")
            tenant_res = supabase.table("tenants").insert({"name": request.tenant_name}).execute()
            if not tenant_res.data:
                raise HTTPException(status_code=500, detail="Failed to create tenant")
            new_tenant_id = tenant_res.data[0]["id"]
            quota_data = {"tenant_id": new_tenant_id, "weekly_limit": 500}
            supabase.table("tenant_quotas").insert(quota_data).execute()
            res = supabase.table("user_profiles").update({
                "tenant_id": new_tenant_id,
                "role": "admin"
            }).eq("user_id", user_id).execute()
        else:
            raise HTTPException(status_code=400, detail="Invalid action")
            
        if not res.data:
            raise HTTPException(status_code=404, detail="User profile not found")
            
        return {"status": "success", "message": "Orphan resolved", "data": res.data[0]}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"Error in create_tenant: {str(e)}"); raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/auth/me")
async def auth_me(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
        
    token = authorization.split(" ")[1] if " " in authorization else authorization
    
    try:
        res = supabase.auth.get_user(token)
        if not res or not res.user:
            raise HTTPException(status_code=401, detail="Invalid token")
            
        user_id = res.user.id
        email = res.user.email
        
        profile_res = supabase.table("user_profiles").select("role, tenant_id, has_completed_onboarding, tenants(name, is_active)").eq("user_id", user_id).execute()
        if not profile_res.data:
            role = "pending"
            tenant_name = None
            has_completed = False
        else:
            profile = profile_res.data[0]
            role = profile.get("role")
            has_completed = profile.get("has_completed_onboarding", False)
            tenants = profile.get("tenants")
            if tenants and tenants.get("is_active") is False:
                raise HTTPException(status_code=403, detail="Organización desactivada")
            tenant_name = tenants.get("name") if tenants else None
            
        if role == "pending":
            superadmin_email = os.getenv("SUPERADMIN_EMAIL")
            if superadmin_email and email == superadmin_email:
                supabase.table("user_profiles").upsert({
                    "user_id": user_id,
                    "role": "superadmin",
                    "tenant_id": None
                }).execute()
                import logging
                logging.info(f"AUDIT: Usuario {email} auto-reparado y elevado a Super Admin")
                return {"role": "superadmin", "redirect_url": "/superadmin"}
            else:
                return {"role": "pending", "redirect_url": "/pending"}
                
        if role == "superadmin":
            return {"role": "superadmin", "redirect_url": "/superadmin"}
            
        if role in ["admin", "digitizer", "archivist"] and tenant_name:
            if not has_completed:
                return {"role": role, "tenant_name": tenant_name, "has_completed_onboarding": has_completed, "redirect_url": "/welcome"}
            return {"role": role, "tenant_name": tenant_name, "has_completed_onboarding": has_completed, "redirect_url": f"/{tenant_name}/dashboard"}
            
        return {"role": role, "redirect_url": "/pending"}
        
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"Error in create_tenant: {str(e)}"); raise HTTPException(status_code=500, detail=str(e))


class CompleteOnboardingRequest(BaseModel):
    first_name: str
    last_name: str
    job_title: Optional[str] = None
    password: str

@app.post("/api/auth/complete-onboarding")
async def complete_onboarding(request: CompleteOnboardingRequest, authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
        
    token = authorization.split(" ")[1] if " " in authorization else authorization
    
    try:
        res = supabase.auth.get_user(token)
        if not res or not res.user:
            raise HTTPException(status_code=401, detail="Invalid token")
            
        user_id = res.user.id
        
        profile_res = supabase.table("user_profiles").select("has_completed_onboarding").eq("user_id", user_id).execute()
        if profile_res.data and profile_res.data[0].get("has_completed_onboarding"):
            raise HTTPException(status_code=409, detail="User has already completed onboarding")
        
        # Step 1: Update user_profiles
        profile_update = {
            "first_name": request.first_name,
            "last_name": request.last_name,
            "job_title": request.job_title,
            "has_completed_onboarding": True
        }
        
        update_res = supabase.table("user_profiles").update(profile_update).eq("user_id", user_id).execute()
        
        if not update_res.data:
            raise HTTPException(status_code=404, detail="User profile not found")
            
        # Step 2: Update password via Supabase Auth Admin API
        try:
            supabase.auth.admin.update_user_by_id(user_id, {"password": request.password})
        except Exception as auth_e:
            # Revert profile update
            revert_update = {
                "has_completed_onboarding": False
            }
            supabase.table("user_profiles").update(revert_update).eq("user_id", user_id).execute()
            raise HTTPException(status_code=500, detail="Failed to update password. Onboarding reverted.")
            
        return {"status": "success", "message": "Onboarding completed successfully"}
        
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"Error in complete_onboarding: {str(e)}"); raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/tenant/metrics")
async def get_tenant_metrics(auth: Dict[str, Any] = Depends(get_auth_context)):
    tenant_id = auth["tenant_id"]
    try:
        user_client = auth["user_client"]
        
        # Total folios
        total_res = user_client.table("folios").select("id").eq("tenant_id", tenant_id).execute()
        total_count = len(total_res.data) if total_res.data else 0
        
        # Verified folios
        verified_res = user_client.table("folios").select("id").eq("tenant_id", tenant_id).eq("status", "completed").execute()
        verified_count = len(verified_res.data) if verified_res.data else 0
        
        # Quota
        quota_res = supabase.table("tenant_quotas").select("*").eq("tenant_id", tenant_id).execute()
        if quota_res.data:
            quota_data = quota_res.data[0]
            used_this_week = quota_data.get("used_this_week", 0)
            weekly_limit = quota_data.get("weekly_limit", 1000)
        else:
            used_this_week = 0
            weekly_limit = 1000
            
        # Productivity (last 7 days by created_at)
        productivity = []
        seven_days_ago = (datetime.now() - timedelta(days=7)).isoformat()
        
        folios_res = user_client.table("folios").select("created_at").eq("tenant_id", tenant_id).gte("created_at", seven_days_ago).execute()
        
        date_counts = {}
        for i in range(7):
            d = (datetime.now() - timedelta(days=6-i)).strftime("%Y-%m-%d")
            date_counts[d] = 0
            
        if folios_res.data:
            for f in folios_res.data:
                ca = f.get("created_at")
                if ca:
                    d_str = ca.split("T")[0]
                    if d_str in date_counts:
                        date_counts[d_str] += 1
                        
        for d, count in date_counts.items():
            productivity.append({"date": d, "folios": count})
            
        return {
            "productivity": productivity,
            "uploadedCount": total_count,
            "verifiedCount": verified_count,
            "quota": {
                "used_this_week": used_this_week,
                "weekly_limit": weekly_limit
            }
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"Error in tenant metrics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

class TemplateCreateRequest(BaseModel):
    name: str
    fields: list = []

class TemplateUpdateRequest(BaseModel):
    name: Optional[str] = None
    fields: Optional[list] = None

@app.get("/api/v1/templates")
async def get_templates(auth: Dict[str, Any] = Depends(get_auth_context)):
    try:
        user_client = auth["user_client"]
        res = user_client.table("templates").select("*").eq("tenant_id", auth["tenant_id"]).execute()
        return {"status": "success", "data": res.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/templates")
async def create_template(request: TemplateCreateRequest, auth: Dict[str, Any] = Depends(get_auth_context)):
    try:
        if len(request.fields) > 40:
            raise HTTPException(status_code=400, detail="Maximum 40 fields allowed")
        user_client = auth["user_client"]
        data = {
            "tenant_id": auth["tenant_id"],
            "name": request.name,
            "fields": request.fields
        }
        res = user_client.table("templates").insert(data).execute()
        return {"status": "success", "data": res.data[0]}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/v1/templates/{template_id}")
async def update_template(template_id: str, request: TemplateUpdateRequest, auth: Dict[str, Any] = Depends(get_auth_context)):
    try:
        if request.fields is not None and len(request.fields) > 40:
            raise HTTPException(status_code=400, detail="Maximum 40 fields allowed")
        
        user_client = auth["user_client"]
        update_data = {}
        if request.name is not None:
            update_data["name"] = request.name
        if request.fields is not None:
            update_data["fields"] = request.fields
            
        res = user_client.table("templates").update(update_data).eq("id", template_id).eq("tenant_id", auth["tenant_id"]).execute()
        
        if not res.data:
            raise HTTPException(status_code=404, detail="Template not found")
        return {"status": "success", "data": res.data[0]}
    except Exception as e:
        if "Cannot edit template fields or name because it is already used in batches" in str(e):
            raise HTTPException(status_code=409, detail="Template is in use and cannot be edited")
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/v1/templates/{template_id}")
async def delete_template(template_id: str, auth: Dict[str, Any] = Depends(get_auth_context)):
    try:
        user_client = auth["user_client"]
        # Check if in use
        batches_res = user_client.table("batches").select("id").eq("template_id", template_id).execute()
        if batches_res.data and len(batches_res.data) > 0:
             raise HTTPException(status_code=409, detail="Template is in use and cannot be deleted")
        
        res = user_client.table("templates").delete().eq("id", template_id).eq("tenant_id", auth["tenant_id"]).execute()
        if not res.data:
             raise HTTPException(status_code=404, detail="Template not found")
        return {"status": "success", "message": "Template deleted"}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/templates/{template_id}/duplicate")
async def duplicate_template(template_id: str, auth: Dict[str, Any] = Depends(get_auth_context)):
    try:
        user_client = auth["user_client"]
        res = user_client.table("templates").select("*").eq("id", template_id).eq("tenant_id", auth["tenant_id"]).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Template not found")
            
        tpl = res.data[0]
        data = {
            "tenant_id": auth["tenant_id"],
            "name": tpl["name"] + " (Copy)",
            "fields": tpl.get("fields", [])
        }
        dup_res = user_client.table("templates").insert(data).execute()
        return {"status": "success", "data": dup_res.data[0]}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

class FolioSaveRequest(BaseModel):
    folio_id: str
    metadata: dict
    status: str # "completed" or "revision"
    feedback: Optional[List[Dict[str, Any]]] = None

@app.post("/api/v1/folios/save")
async def save_folio(request: FolioSaveRequest, auth: Dict[str, Any] = Depends(get_auth_context)):
    try:
        user_client = auth["user_client"]
        tenant_id = auth["tenant_id"]
        user_id = auth.get("user_id")
        
        # Verify folio exists and belongs to tenant
        folio_res = (
            supabase.table("folios")
            .select("*, batches(template_id)")
            .eq("id", request.folio_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not folio_res.data:
            raise HTTPException(status_code=404, detail="Folio not found")
            
        folio = folio_res.data[0]
        template_id = None
        batches_rel = folio.get("batches")
        if isinstance(batches_rel, dict):
            template_id = batches_rel.get("template_id")
        elif isinstance(batches_rel, list) and len(batches_rel) > 0 and isinstance(batches_rel[0], dict):
            template_id = batches_rel[0].get("template_id")
            
        if not template_id and folio.get("batch_id"):
            batch_res = (
                supabase.table("batches")
                .select("template_id")
                .eq("id", folio["batch_id"])
                .eq("tenant_id", tenant_id)
                .execute()
            )
            if batch_res.data and len(batch_res.data) > 0:
                template_id = batch_res.data[0].get("template_id")
                
        fields = []
        if template_id:
            tpl_res = (
                supabase.table("templates")
                .select("fields")
                .eq("id", template_id)
                .eq("tenant_id", tenant_id)
                .execute()
            )
            if tpl_res.data and len(tpl_res.data) > 0:
                fields = tpl_res.data[0].get("fields") or []
        
        if request.status == "completed":
            # Validate required fields
            for f in fields:
                if isinstance(f, dict) and f.get("required"):
                    val = (
                        request.metadata.get(f.get("id"))
                        if f.get("id") in request.metadata
                        else request.metadata.get(f.get("name"))
                        if f.get("name") in request.metadata
                        else request.metadata.get(f.get("label"))
                    )
                    if val is None or str(val).strip() == "":
                        raise HTTPException(
                            status_code=400,
                            detail=f"El campo '{f.get('label') or f.get('name') or f.get('id')}' es obligatorio"
                        )
        
        # Update folio
        update_data = {
            "metadata": request.metadata,
            "status": request.status,
            "locked_at": None
        }
        if request.status == "completed":
            update_data["verified_at"] = datetime.now(timezone.utc).isoformat()
            
        res = (
            supabase.table("folios")
            .update(update_data)
            .eq("id", request.folio_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        
        # Record feedback asynchronously/safely without blocking error
        if request.feedback and len(request.feedback) > 0:
            try:
                feedback_rows = []
                for fb in request.feedback:
                    feedback_rows.append({
                        "id": str(uuid.uuid4()),
                        "tenant_id": tenant_id,
                        "folio_id": request.folio_id,
                        "field_name": fb.get("field_name") or fb.get("fieldKey") or "unknown",
                        "predicted_value": fb.get("predicted_value") or fb.get("suggestedText") or "",
                        "actual_value": fb.get("actual_value") or fb.get("currentValue") or "",
                        "confidence": fb.get("confidence") or 0.0,
                        "action_type": fb.get("action_type") or "corrected_text",
                        "corrected_by_user_id": user_id
                    })
                if feedback_rows:
                    try:
                        user_client.table("training_data").insert(feedback_rows).execute()
                    except Exception:
                        try:
                            supabase.table("training_data").insert(feedback_rows).execute()
                        except Exception as sb_err:
                            print(f"Warning: could not insert active learning feedback to supabase: {sb_err}")
                    _save_r2_training_data(tenant_id, feedback_rows)
            except Exception as fb_err:
                print(f"Warning: could not insert active learning feedback: {fb_err}")

        saved_row = res.data[0] if (res and res.data) else {"id": request.folio_id, **update_data}
        return {"status": "success", "data": saved_row}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/folios/revision")
async def get_revision_folios(auth: Dict[str, Any] = Depends(get_auth_context)):
    try:
        tenant_id = auth["tenant_id"]
        user_client = auth["user_client"]
        
        try:
            res = user_client.table("folios").select(
                "*, batches(id, template_id, uploaded_by, templates(name))"
            ).eq("tenant_id", tenant_id).eq("status", "revision").order("created_at", desc=True).execute()
        except Exception:
            res = supabase.table("folios").select(
                "*, batches(id, template_id, uploaded_by, templates(name))"
            ).eq("tenant_id", tenant_id).eq("status", "revision").order("created_at", desc=True).execute()
            
        folios = res.data or []
        
        if auth.get("role") == "archivist":
            user_id = auth.get("user_id")
            folios = [
                f for f in folios
                if f.get("batches") and f["batches"].get("uploaded_by") == user_id
            ]
            
        return {"status": "success", "data": folios}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        print(f"Error in get_revision_folios: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/batches")
async def get_batches(auth: Dict[str, Any] = Depends(get_auth_context)):
    try:
        tenant_id = auth["tenant_id"]
        user_client = auth["user_client"]
        
        try:
            query = user_client.table("batches").select(
                "id, template_id, status, created_at, templates(name)"
            ).eq("tenant_id", tenant_id)
        except Exception:
            query = supabase.table("batches").select(
                "id, template_id, status, created_at, templates(name)"
            ).eq("tenant_id", tenant_id)
            
        if auth.get("role") == "archivist":
            query = query.eq("uploaded_by", auth["user_id"])
            
        res = query.order("created_at", desc=True).execute()
        return {"status": "success", "data": res.data or []}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        print(f"Error in get_batches: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

class UpdateRecordMetadataRequest(BaseModel):
    metadata: Dict[str, Any]

class RecordTemplateField(BaseModel):
    id: Optional[str] = None
    key: Optional[str] = None
    name: Optional[str] = None
    label: Optional[str] = None
    type: Optional[str] = None
    required: Optional[bool] = False

class RecordItem(BaseModel):
    id: str
    batch_id: Optional[str] = None
    batch_name: Optional[str] = None
    status: Optional[str] = None
    r2_url: Optional[str] = None
    file_name: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    verified_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    view_url: Optional[str] = None

@app.get("/api/v1/records")
async def get_records(
    batch_id: Optional[str] = None,
    search: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    auth: Dict[str, Any] = Depends(get_auth_context)
):
    if auth.get("role") == "digitizer":
        raise HTTPException(status_code=403, detail="Permiso denegado: rol no autorizado para consultar registros")
    try:
        tenant_id = auth["tenant_id"]
        user_client = auth["user_client"]
        
        query = supabase.table("folios").select("*, batches(id, template_id, uploaded_by)", count="exact").eq("tenant_id", tenant_id).in_("status", ["completed", "in_progress"])
        
        if batch_id:
            query = query.eq("batch_id", batch_id)
        if start_date:
            query = query.gte("verified_at", start_date)
        if end_date:
            query = query.lte("verified_at", end_date)
            
        template_fields = None
        if batch_id:
            try:
                batch_res = supabase.table("batches").select("template_id, templates(fields)").eq("id", batch_id).eq("tenant_id", tenant_id).execute()
                if batch_res.data and len(batch_res.data) > 0:
                    tpl_data = batch_res.data[0].get("templates")
                    if tpl_data and "fields" in tpl_data:
                        template_fields = tpl_data["fields"]
                    elif batch_res.data[0].get("template_id"):
                        tpl_id = batch_res.data[0]["template_id"]
                        tpl_res = supabase.table("templates").select("fields").eq("id", tpl_id).eq("tenant_id", tenant_id).execute()
                        if tpl_res.data and len(tpl_res.data) > 0:
                            template_fields = tpl_res.data[0].get("fields", [])
            except Exception as t_err:
                print(f"Error fetching template fields for batch {batch_id}: {t_err}")

        if search and search.strip():
            search_term = search.strip().lower()
            res = query.order("verified_at", desc=True).execute()
            raw_folios = res.data or []
            
            def match_folio(f: Dict[str, Any]) -> bool:
                r2 = f.get("r2_url") or ""
                if search_term in r2.lower():
                    return True
                meta = f.get("metadata") or {}
                if isinstance(meta, dict):
                    for v in meta.values():
                        if v is not None and search_term in str(v).lower():
                            return True
                return False

            filtered_folios = [f for f in raw_folios if match_folio(f)]
            count = len(filtered_folios)
            offset = max(0, (page - 1) * page_size)
            paged_folios = filtered_folios[offset:offset + page_size]
        else:
            offset = max(0, (page - 1) * page_size)
            query = query.order("verified_at", desc=True).range(offset, offset + page_size - 1)
            res = query.execute()
            paged_folios = res.data or []
            count = res.count if res.count is not None else len(paged_folios)

        processed_folios = []
        bucket_name = os.getenv("R2_BUCKET_NAME")
        for f in paged_folios:
            folio_dict = dict(f)
            batch_rel = folio_dict.get("batches")
            if isinstance(batch_rel, dict) and batch_rel.get("id"):
                folio_dict["batch_name"] = f"Lote {str(batch_rel.get('id'))[:8]}"
            else:
                folio_dict["batch_name"] = None
                
            r2_url = folio_dict.get("r2_url")
            if r2_url:
                folio_dict["file_name"] = r2_url.split("/")[-1]
                try:
                    folio_dict["view_url"] = s3_client.generate_presigned_url(
                        'get_object',
                        Params={'Bucket': bucket_name, 'Key': r2_url},
                        ExpiresIn=3600
                    )
                except Exception as s3_err:
                    print(f"Error generating view_url for {r2_url}: {s3_err}")
                    folio_dict["view_url"] = None
            else:
                folio_dict["file_name"] = None
                folio_dict["view_url"] = None
                
            processed_folios.append(folio_dict)

        total_pages = max(1, (count + page_size - 1) // page_size) if count > 0 else 1

        return {
            "status": "success",
            "data": processed_folios,
            "total_records": count,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "template_fields": template_fields
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"Error in get_records: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/v1/records/{folio_id}")
async def update_record_metadata(
    folio_id: str,
    request: UpdateRecordMetadataRequest,
    auth: Dict[str, Any] = Depends(get_auth_context)
):
    try:
        caller_id = auth["user_id"]
        role = auth["role"]
        tenant_id = auth["tenant_id"]
        user_client = auth["user_client"]

        if role == "digitizer":
            raise HTTPException(status_code=403, detail="Permiso denegado: rol no autorizado para editar")

        folio_res = user_client.table("folios").select("*, batches(uploaded_by)").eq("id", folio_id).eq("tenant_id", tenant_id).execute()
        if not folio_res.data:
            raise HTTPException(status_code=404, detail="Folio no encontrado")

        folio = folio_res.data[0]
        batch_rel = folio.get("batches") or {}
        batch_uploader = batch_rel.get("uploaded_by")

        if role == "archivist" and batch_uploader != caller_id:
            raise HTTPException(status_code=403, detail="Permiso denegado: solo puedes editar registros de lotes que subiste")

        if folio.get("status") == "in_progress":
            raise HTTPException(status_code=409, detail="El documento está siendo indexado en este momento")

        now_iso = datetime.now(timezone.utc).isoformat()
        update_data = {
            "metadata": request.metadata,
            "updated_at": now_iso
        }

        try:
            res = user_client.table("folios").update({**update_data, "last_modified_by": caller_id}).eq("id", folio_id).execute()
        except Exception:
            res = user_client.table("folios").update(update_data).eq("id", folio_id).execute()

        if not res.data:
            raise HTTPException(status_code=500, detail="Error al actualizar metadatos del folio")

        return {"status": "success", "data": res.data[0]}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"Error in update_record_metadata: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/v1/records/{folio_id}")
async def delete_record(
    folio_id: str,
    auth: Dict[str, Any] = Depends(get_auth_context)
):
    try:
        role = auth.get("role")
        if role == "digitizer":
            raise HTTPException(
                status_code=403,
                detail="Permiso denegado: rol no autorizado para eliminar registros"
            )

        caller_id = auth["user_id"]
        tenant_id = auth["tenant_id"]

        folio_res = (
            supabase.table("folios")
            .select("id, tenant_id, batches(uploaded_by)")
            .eq("id", folio_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )

        if not folio_res.data:
            raise HTTPException(status_code=404, detail="Registro no encontrado")

        folio = folio_res.data[0]

        if role == "archivist":
            batch_rel = folio.get("batches") or {}
            uploaded_by = batch_rel.get("uploaded_by") if isinstance(batch_rel, dict) else None
            if uploaded_by != caller_id:
                raise HTTPException(
                    status_code=403,
                    detail="Permiso denegado: solo puedes eliminar registros de lotes que subiste"
                )

        # Eliminar datos asociados en training_data
        supabase.table("training_data").delete().eq("folio_id", folio_id).eq("tenant_id", tenant_id).execute()

        # Eliminar el folio
        res = supabase.table("folios").delete().eq("id", folio_id).eq("tenant_id", tenant_id).execute()

        return {
            "status": "success",
            "message": "Registro eliminado exitosamente",
            "id": folio_id
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"Error deleting record {folio_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

def format_export_datetime(dt_str: Optional[str]) -> str:
    if not dt_str:
        return ""
    try:
        clean_str = dt_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(clean_str)
        return dt.strftime("%Y-%m-%d %H:%M")
    except Exception:
        if len(dt_str) >= 16 and "T" in dt_str:
            return dt_str[:16].replace("T", " ")
        return dt_str

def clean_column_name(key: str) -> str:
    if not key:
        return ""
    return key.replace("_", " ").replace("-", " ").strip().title()

def extract_dynamic_columns(folios: list, template_fields: Optional[list]) -> tuple[list[str], list[str]]:
    if template_fields:
        field_keys = []
        field_labels = []
        for f in template_fields:
            f_id = f.get("id") or f.get("key") or f.get("name") or ""
            f_label = f.get("label") or f.get("name") or f_id
            field_keys.append(f_id)
            field_labels.append(f_label)
        return field_keys, field_labels
    else:
        unique_keys = set()
        for folio in folios:
            meta = folio.get("metadata") or {}
            if isinstance(meta, dict):
                for k in meta.keys():
                    unique_keys.add(k)
        keys = sorted(list(unique_keys))
        labels = [clean_column_name(k) for k in keys]
        return keys, labels

@app.get("/api/v1/records/export")
async def export_records(
    batch_id: Optional[str] = None,
    search: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    format: str = Query("xlsx", regex="^(xlsx|csv)$"),
    auth: Dict[str, Any] = Depends(get_auth_context)
):
    if auth.get("role") == "digitizer":
        raise HTTPException(status_code=403, detail="Permiso denegado: rol no autorizado para exportar registros")

    if format not in ["xlsx", "csv"]:
        raise HTTPException(status_code=400, detail="Formato de exportación no soportado. Use 'xlsx' o 'csv'.")

    try:
        tenant_id = auth["tenant_id"]
        user_client = auth["user_client"]

        query = supabase.table("folios").select("*, batches(id, template_id, uploaded_by)").eq("tenant_id", tenant_id).in_("status", ["completed", "in_progress"])
        if batch_id:
            query = query.eq("batch_id", batch_id)
        if start_date:
            query = query.gte("verified_at", start_date)
        if end_date:
            query = query.lte("verified_at", end_date)

        res = query.order("verified_at", desc=True).execute()
        raw_folios = res.data or []

        if search and search.strip():
            search_term = search.strip().lower()
            def match_folio(f: Dict[str, Any]) -> bool:
                r2 = f.get("r2_url") or ""
                if search_term in r2.lower():
                    return True
                meta = f.get("metadata") or {}
                if isinstance(meta, dict):
                    for v in meta.values():
                        if v is not None and search_term in str(v).lower():
                            return True
                return False
            folios = [f for f in raw_folios if match_folio(f)]
        else:
            folios = raw_folios

        template_fields = None
        if batch_id:
            try:
                batch_res = supabase.table("batches").select("template_id, templates(fields)").eq("id", batch_id).eq("tenant_id", tenant_id).execute()
                if batch_res.data and len(batch_res.data) > 0:
                    tpl_data = batch_res.data[0].get("templates")
                    if tpl_data and "fields" in tpl_data:
                        template_fields = tpl_data["fields"]
                    elif batch_res.data[0].get("template_id"):
                        tpl_id = batch_res.data[0]["template_id"]
                        tpl_res = supabase.table("templates").select("fields").eq("id", tpl_id).eq("tenant_id", tenant_id).execute()
                        if tpl_res.data and len(tpl_res.data) > 0:
                            template_fields = tpl_res.data[0].get("fields", [])
            except Exception as t_err:
                print(f"Error fetching template fields for export: {t_err}")

        # Extract dynamic columns & labels
        meta_keys, meta_labels = extract_dynamic_columns(folios, template_fields if batch_id else None)
        base_headers = ["ID Folio", "Archivo", "Lote", "Fecha Verificación", "Estado"]
        headers = base_headers + meta_labels

        # Build data rows
        data_rows = []
        for folio in folios:
            r2_url = folio.get("r2_url") or ""
            file_name = r2_url.split("/")[-1] if r2_url else ""
            batch_info = folio.get("batches") or {}
            batch_rel_id = batch_info.get("id") or folio.get("batch_id")
            batch_name = f"Lote {str(batch_rel_id)[:8]}" if batch_rel_id else ""
            verified_formatted = format_export_datetime(folio.get("verified_at"))
            status = folio.get("status", "")

            row = [
                folio.get("id", ""),
                file_name,
                batch_name,
                verified_formatted,
                status
            ]

            meta = folio.get("metadata") or {}
            for k in meta_keys:
                val = meta.get(k)
                if val is None and template_fields:
                    # Fallback check by label if key wasn't matched
                    for f in template_fields:
                        if (f.get("id") == k or f.get("key") == k or f.get("name") == k):
                            label = f.get("label")
                            if label and label in meta:
                                val = meta.get(label)
                            break
                row.append(str(val) if val is not None else "")

            data_rows.append(row)

        timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

        # CSV format
        if format == "csv":
            def iter_csv():
                output = io.StringIO()
                output.write("\ufeffsep=;\r\n")
                writer = csv.writer(output, delimiter=";", lineterminator="\r\n")
                writer.writerow(headers)
                for r in data_rows:
                    writer.writerow(r)
                yield output.getvalue()

            filename = f"registros_export_{timestamp_str}.csv"
            return StreamingResponse(
                iter_csv(),
                media_type="text/csv; charset=utf-8",
                headers={"Content-Disposition": f'attachment; filename="{filename}"'}
            )

        # XLSX format
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Registros CodexFlow"

        ws.append(headers)

        header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        thin_side = Side(style="thin", color="E2E8F0")
        cell_border = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)

        ws.row_dimensions[1].height = 28
        for cell in ws[1]:
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = header_alignment
            cell.border = cell_border

        data_font = Font(name="Calibri", size=10)
        data_alignment = Alignment(vertical="center")
        for r in data_rows:
            ws.append(r)
            row_idx = ws.max_row
            ws.row_dimensions[row_idx].height = 20
            for cell in ws[row_idx]:
                cell.font = data_font
                cell.alignment = data_alignment
                cell.border = cell_border

        # Auto-adjust column widths
        for col in ws.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            for cell in col:
                val_str = str(cell.value or "")
                if len(val_str) > max_len:
                    max_len = len(val_str)
            ws.column_dimensions[col_letter].width = max(14, min(50, max_len + 3))

        bio = io.BytesIO()
        wb.save(bio)
        bio.seek(0)

        filename = f"registros_export_{timestamp_str}.xlsx"
        return Response(
            content=bio.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"Error in export_records: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


class DigitizerMetricsData(BaseModel):
    user_id: str
    tenant_id: str
    full_name: Optional[str] = None
    folios_today: int
    folios_last_7_days: int
    folios_total_verified: int
    last_activity_at: Optional[str] = None
    recent_folios: Optional[List[Dict[str, Any]]] = None

class DigitizerMetricsResponse(BaseModel):
    status: str
    data: DigitizerMetricsData

@app.get("/api/v1/digitizer/metrics", response_model=DigitizerMetricsResponse)
async def get_digitizer_metrics(auth: Dict[str, Any] = Depends(get_auth_context)):
    tenant_id = auth["tenant_id"]
    user_id = auth["user_id"]

    try:
        # Get full name from user_profiles if available
        full_name = None
        try:
            prof_res = supabase.table("user_profiles").select("first_name, last_name").eq("user_id", user_id).execute()
            if prof_res.data and len(prof_res.data) > 0:
                fn = prof_res.data[0].get("first_name") or ""
                ln = prof_res.data[0].get("last_name") or ""
                combined = f"{fn} {ln}".strip()
                if combined:
                    full_name = combined
        except Exception as p_err:
            print(f"Error fetching profile in digitizer metrics: {p_err}")

        # Timestamps for UTC intervals
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        seven_days_ago = now - timedelta(days=7)

        # Query folios for this tenant
        user_client = auth["user_client"]
        res = user_client.table("folios").select(
            "id, status, verified_at, updated_at, created_at, metadata, r2_url, batches(id, template_id, templates(name))"
        ).eq("tenant_id", tenant_id).eq("status", "completed").order("verified_at", desc=True).execute()

        folios = res.data or []

        # Filter by user if folio has verified_by, transcribed_by, or metadata._verified_by
        user_folios = []
        for f in folios:
            if f.get("verified_by") == user_id or f.get("transcribed_by") == user_id or f.get("assigned_to") == user_id:
                user_folios.append(f)
            elif isinstance(f.get("metadata"), dict) and f.get("metadata", {}).get("_verified_by") == user_id:
                user_folios.append(f)
            else:
                user_folios.append(f)

        folios_total_verified = len(user_folios)
        folios_today = 0
        folios_last_7_days = 0
        last_activity_at = None

        if user_folios:
            first_ts = user_folios[0].get("verified_at") or user_folios[0].get("updated_at") or user_folios[0].get("created_at")
            last_activity_at = first_ts

        for f in user_folios:
            v_at_str = f.get("verified_at") or f.get("updated_at") or f.get("created_at")
            if v_at_str:
                try:
                    clean_str = v_at_str.replace("Z", "+00:00")
                    dt = datetime.fromisoformat(clean_str)
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    if dt >= today_start:
                        folios_today += 1
                    if dt >= seven_days_ago:
                        folios_last_7_days += 1
                except Exception:
                    pass

        # Prepare recent folios list for table view (latest 10)
        recent = []
        for f in user_folios[:10]:
            r2 = f.get("r2_url") or ""
            filename = r2.split("/")[-1] if r2 else f"Folio #{f.get('id', '')[:8]}"
            batch_data = f.get("batches") or {}
            template_info = batch_data.get("templates") or {}
            template_name = template_info.get("name") if isinstance(template_info, dict) else "General"
            
            recent.append({
                "id": f.get("id"),
                "filename": filename,
                "template_name": template_name,
                "status": f.get("status"),
                "verified_at": f.get("verified_at") or f.get("updated_at") or f.get("created_at")
            })

        return DigitizerMetricsResponse(
            status="success",
            data=DigitizerMetricsData(
                user_id=user_id,
                tenant_id=tenant_id,
                full_name=full_name,
                folios_today=folios_today,
                folios_last_7_days=folios_last_7_days,
                folios_total_verified=folios_total_verified,
                last_activity_at=last_activity_at,
                recent_folios=recent
            )
        )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"Error in get_digitizer_metrics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

import smtplib
import urllib.request
from email.message import EmailMessage

DEMO_REQUESTS_R2_KEY = "_system/demo_requests/requests.json"
_demo_requests_memory: List[Dict[str, Any]] = []


def _load_r2_demo_requests() -> List[Dict[str, Any]]:
    bucket = os.getenv("R2_BUCKET_NAME")
    if not bucket:
        return list(_demo_requests_memory)
    try:
        obj = s3_client.get_object(Bucket=bucket, Key=DEMO_REQUESTS_R2_KEY)
        raw = obj["Body"].read().decode("utf-8")
        data = json.loads(raw)
        if isinstance(data, list):
            return data
    except Exception as e:
        print(f"Info reading demo_requests from R2: {e}")
    return list(_demo_requests_memory)


def _save_r2_demo_requests(records: List[Dict[str, Any]]) -> None:
    global _demo_requests_memory
    _demo_requests_memory = list(records)
    bucket = os.getenv("R2_BUCKET_NAME")
    if not bucket:
        return
    try:
        s3_client.put_object(
            Bucket=bucket,
            Key=DEMO_REQUESTS_R2_KEY,
            Body=json.dumps(records, ensure_ascii=False, indent=2).encode("utf-8"),
            ContentType="application/json"
        )
    except Exception as e:
        print(f"Warning saving demo_requests to R2: {e}")


def _resolve_superadmin_email() -> str:
    env_email = os.getenv("SUPERADMIN_EMAIL", "").strip()
    if env_email:
        return env_email
    try:
        prof_res = supabase.table("user_profiles").select("user_id").eq("role", "superadmin").limit(1).execute()
        if prof_res.data and len(prof_res.data) > 0:
            su_id = prof_res.data[0]["user_id"]
            u_res = supabase.auth.admin.get_user_by_id(su_id)
            if u_res and u_res.user and u_res.user.email:
                return u_res.user.email
    except Exception:
        pass
    return ""


def _send_demo_email_notification(record: Dict[str, Any], recipient_email: str) -> None:
    if not recipient_email:
        return
    subject = f"[CodexFlow] Nueva Solicitud de Demo: {record.get('organization', '')}"
    html_body = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #0f172a; margin-top: 0;">Nueva Solicitud de Demostración — CodexFlow</h2>
        <p style="color: #475569; font-size: 14px;">Se ha recibido una nueva solicitud desde la portada pública:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #334155;">Institución / Organización:</td><td style="padding: 8px; border-bottom: 1px solid #f1f5f9; color: #0f172a;">{record.get('organization') or ''}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #334155;">Nombre del Contacto:</td><td style="padding: 8px; border-bottom: 1px solid #f1f5f9; color: #0f172a;">{record.get('full_name') or ''}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #334155;">Correo Electrónico:</td><td style="padding: 8px; border-bottom: 1px solid #f1f5f9; color: #0f172a;">{record.get('email') or ''}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #334155;">Teléfono / WhatsApp:</td><td style="padding: 8px; border-bottom: 1px solid #f1f5f9; color: #0f172a;">{record.get('phone') or 'No especificado'}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #334155;">Fondo Documental:</td><td style="padding: 8px; border-bottom: 1px solid #f1f5f9; color: #0f172a;">{record.get('message') or 'No especificado'}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold; color: #334155;">Fecha UTC:</td><td style="padding: 8px; color: #64748b;">{record.get('created_at') or ''}</td></tr>
        </table>
        <p style="font-size: 13px; color: #64748b;">Puedes gestionar esta solicitud y crear la ONG con un clic desde el Panel Global de SuperAdmin (<code>/superadmin</code>).</p>
    </div>
    """

    resend_api_key = os.getenv("RESEND_API_KEY", "").strip()
    if resend_api_key:
        try:
            sender = os.getenv("RESEND_FROM_EMAIL", "CodexFlow <onboarding@resend.dev>")
            req_body = json.dumps({
                "from": sender,
                "to": [recipient_email],
                "subject": subject,
                "html": html_body
            }).encode("utf-8")
            req = urllib.request.Request(
                "https://api.resend.com/emails",
                data=req_body,
                headers={
                    "Authorization": f"Bearer {resend_api_key}",
                    "Content-Type": "application/json"
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                resp.read()
            return
        except Exception as e:
            print(f"Warning sending email via Resend: {e}")

    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
    if smtp_user and smtp_password:
        try:
            smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
            smtp_port = int(os.getenv("SMTP_PORT", "587"))
            msg = EmailMessage()
            msg["Subject"] = subject
            msg["From"] = smtp_user
            msg["To"] = recipient_email
            msg.set_content(
                f"Nueva Solicitud de Demo en CodexFlow\n"
                f"Institución: {record.get('organization')}\n"
                f"Contacto: {record.get('full_name')}\n"
                f"Correo: {record.get('email')}\n"
                f"Teléfono: {record.get('phone') or 'No especificado'}\n"
                f"Fondo Documental: {record.get('message') or 'No especificado'}\n"
            )
            msg.add_alternative(html_body, subtype="html")
            with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                server.starttls()
                server.login(smtp_user, smtp_password)
                server.send_message(msg)
        except Exception as e:
            print(f"Warning sending email via SMTP: {e}")


class DemoRequestCreate(BaseModel):
    full_name: str
    organization: str
    email: str
    phone: Optional[str] = None
    message: Optional[str] = None
    status: Optional[str] = "pending"


class DemoRequestStatusUpdate(BaseModel):
    status: str


@app.post("/api/v1/demo-requests")
async def create_demo_request(payload: DemoRequestCreate, background_tasks: BackgroundTasks):
    record: Dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "full_name": payload.full_name.strip(),
        "organization": payload.organization.strip(),
        "email": payload.email.strip(),
        "phone": payload.phone.strip() if payload.phone else None,
        "message": payload.message.strip() if payload.message else None,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    # 1. Guardar en Supabase si la tabla existe
    try:
        res = supabase.table("demo_requests").insert(record).execute()
        if res and res.data and len(res.data) > 0 and res.data[0].get("id"):
            record["id"] = str(res.data[0]["id"])
    except Exception as supa_err:
        print(f"Notice: Supabase demo_requests table unavailable, relying on R2 backup: {supa_err}")

    # 2. Guardar siempre en Cloudflare R2 (_system/demo_requests/requests.json)
    try:
        existing = _load_r2_demo_requests()
        filtered = [r for r in existing if r.get("id") != record["id"]]
        filtered.insert(0, record)
        _save_r2_demo_requests(filtered)
    except Exception as r2_err:
        print(f"Warning saving demo request to R2: {r2_err}")

    superadmin_email = _resolve_superadmin_email()
    if superadmin_email and (
        (os.getenv("SMTP_USER") and os.getenv("SMTP_PASSWORD"))
        or os.getenv("RESEND_API_KEY")
    ):
        background_tasks.add_task(_send_demo_email_notification, record, superadmin_email)

    return {
        "status": "success",
        "data": record,
        "notify_email": superadmin_email
    }


@app.get("/api/superadmin/demo-requests")
async def get_superadmin_demo_requests(auth: Dict[str, Any] = Depends(get_superadmin_context)):
    merged_by_id: Dict[str, Dict[str, Any]] = {}

    # 1. Leer desde R2
    try:
        r2_records = _load_r2_demo_requests()
        for r in r2_records:
            if isinstance(r, dict) and r.get("id"):
                merged_by_id[str(r["id"])] = r
    except Exception as e:
        print(f"Warning loading R2 demo_requests: {e}")

    # 2. Leer desde Supabase si la tabla existe
    try:
        res = supabase.table("demo_requests").select("*").order("created_at", desc=True).execute()
        if res and res.data:
            for r in res.data:
                rid = str(r.get("id") or "")
                if rid:
                    if rid in merged_by_id:
                        merged_by_id[rid] = {**r, **merged_by_id[rid]}
                    else:
                        merged_by_id[rid] = r
    except Exception as e:
        print(f"Info: Supabase demo_requests table not queried: {e}")

    records = list(merged_by_id.values())
    records.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)
    return {"status": "success", "data": records}


@app.patch("/api/superadmin/demo-requests/{request_id}")
async def update_superadmin_demo_request(
    request_id: str,
    payload: Optional[DemoRequestStatusUpdate] = None,
    status: Optional[str] = Query(None),
    auth: Dict[str, Any] = Depends(get_superadmin_context)
):
    new_status = (payload.status if payload and payload.status else status) or "contacted"
    if new_status not in ("pending", "contacted", "approved", "archived"):
        raise HTTPException(status_code=400, detail="Estado inválido")

    # 1. Actualizar en Supabase si la tabla existe
    try:
        supabase.table("demo_requests").update({"status": new_status}).eq("id", request_id).execute()
    except Exception as e:
        print(f"Info updating demo_requests in Supabase: {e}")

    # 2. Actualizar en R2
    try:
        existing = _load_r2_demo_requests()
        updated = False
        for item in existing:
            if str(item.get("id")) == request_id:
                item["status"] = new_status
                updated = True
        if updated:
            _save_r2_demo_requests(existing)
    except Exception as e:
        print(f"Warning updating demo_requests in R2: {e}")

    return {"status": "success"}


@app.delete("/api/superadmin/demo-requests/{request_id}")
async def delete_superadmin_demo_request(
    request_id: str,
    auth: Dict[str, Any] = Depends(get_superadmin_context)
):
    # 1. Eliminar de Supabase si existe
    try:
        supabase.table("demo_requests").delete().eq("id", request_id).execute()
    except Exception as e:
        print(f"Info deleting demo_request from Supabase: {e}")

    # 2. Eliminar de R2
    try:
        existing = _load_r2_demo_requests()
        filtered = [r for r in existing if str(r.get("id")) != request_id]
        _save_r2_demo_requests(filtered)
    except Exception as e:
        print(f"Warning deleting demo_request from R2: {e}")

    return {"status": "success"}


# ==========================================
# SPEC-012: FASE 2 - GESTIÓN DE CARPETAS Y TOMOS
# ==========================================

@app.post("/api/v1/folders")
async def create_folder(
    folder_in: FolderCreate,
    x_tenant_id: Optional[str] = Header(None),
    auth: Dict[str, Any] = Depends(get_auth_context)
):
    role = auth.get("role")
    if role not in ("admin", "archivist", "superadmin"):
        raise HTTPException(
            status_code=403,
            detail="Permiso denegado: solo administradores o archivistas pueden crear carpetas"
        )
    
    tenant_id = auth.get("tenant_id") or x_tenant_id
    if not tenant_id and folder_in.metadata and isinstance(folder_in.metadata, dict):
        tenant_id = folder_in.metadata.get("tenant_id")
        
    client = auth.get("user_client") or supabase

    # Si aún no tenemos tenant_id y viene parent_id, intentar resolver del padre
    if not tenant_id and folder_in.parent_id:
        try:
            parent_lookup = client.table("document_folders").select("tenant_id").eq("id", folder_in.parent_id).execute()
            if parent_lookup.data and parent_lookup.data[0].get("tenant_id"):
                tenant_id = parent_lookup.data[0].get("tenant_id")
        except Exception:
            pass

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Se requiere especificar la organización (tenant_id)"
        )

    try:
        # Si viene parent_id, verificar que exista y pertenezca al mismo tenant_id
        if folder_in.parent_id:
            parent_check = client.table("document_folders").select("id").eq("id", folder_in.parent_id).eq("tenant_id", tenant_id).execute()
            if not parent_check.data:
                raise HTTPException(
                    status_code=404,
                    detail="La carpeta padre especificada no existe o no pertenece a la organización"
                )
                
        folder_data = {
            "tenant_id": tenant_id,
            "parent_id": folder_in.parent_id,
            "name": folder_in.name,
            "folder_type": folder_in.folder_type.value if hasattr(folder_in.folder_type, "value") else str(folder_in.folder_type),
            "metadata": folder_in.metadata or {},
            "created_by": auth.get("user_id")
        }
        
        res = client.table("document_folders").insert(folder_data).execute()
        if not res.data:
            raise HTTPException(status_code=400, detail="Error al crear la carpeta en la base de datos")
            
        return {"status": "success", "data": res.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating folder: {e}")
        raise HTTPException(status_code=400, detail=f"Error al crear carpeta: {e}")


@app.patch("/api/v1/folders/{folder_id}")
async def update_folder(
    folder_id: str,
    folder_in: FolderUpdate,
    x_tenant_id: Optional[str] = Header(None),
    auth: Dict[str, Any] = Depends(get_auth_context)
):
    role = auth.get("role")
    if role not in ("admin", "archivist", "superadmin"):
        raise HTTPException(
            status_code=403,
            detail="Permiso denegado: solo administradores o archivistas pueden modificar carpetas"
        )
        
    tenant_id = auth.get("tenant_id") or x_tenant_id
    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Se requiere tenant_id para identificar la organización"
        )
    client = auth.get("user_client") or supabase
    
    # Verificar existencia
    existing = client.table("document_folders").select("id").eq("id", folder_id).eq("tenant_id", tenant_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Carpeta no encontrada")
        
    update_data = {}
    if folder_in.name is not None:
        update_data["name"] = folder_in.name

    if folder_in.folder_type is not None:
        update_data["folder_type"] = (
            folder_in.folder_type.value
            if hasattr(folder_in.folder_type, "value")
            else str(folder_in.folder_type)
        )

    if folder_in.parent_id is not None:
        if folder_in.parent_id == "":
            update_data["parent_id"] = None
        elif folder_in.parent_id == folder_id:
            raise HTTPException(
                status_code=400,
                detail="Una carpeta no puede ser padre de sí misma"
            )
        else:
            # Validar que la carpeta padre pertenezca al tenant_id
            parent_check = client.table("document_folders").select("id").eq("id", folder_in.parent_id).eq("tenant_id", tenant_id).execute()
            if not parent_check.data:
                raise HTTPException(
                    status_code=404,
                    detail="La carpeta contenedora especificada no existe en la organización"
                )
            update_data["parent_id"] = folder_in.parent_id

    if folder_in.metadata is not None:
        update_data["metadata"] = folder_in.metadata
        
    if not update_data:
        return {"status": "success", "data": existing.data[0]}
        
    res = client.table("document_folders").update(update_data).eq("id", folder_id).eq("tenant_id", tenant_id).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Error al actualizar la carpeta")
        
    return {"status": "success", "data": res.data[0]}



@app.delete("/api/v1/folders/{folder_id}")
async def delete_folder(
    folder_id: str,
    reassign_to_unclassified: bool = Query(True, description="Si es True, devuelve los folios a la bandeja sin clasificar y mueve subcarpetas al padre"),
    x_tenant_id: Optional[str] = Header(None),
    auth: Dict[str, Any] = Depends(get_auth_context)
):
    role = auth.get("role")
    if role not in ("admin", "archivist", "superadmin"):
        raise HTTPException(
            status_code=403,
            detail="Permiso denegado: solo administradores o archivistas pueden eliminar carpetas"
        )
        
    tenant_id = auth.get("tenant_id") or x_tenant_id
    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Se requiere tenant_id para identificar la organización"
        )
    client = auth.get("user_client") or supabase
    
    # Verificar existencia y datos de la carpeta
    existing = client.table("document_folders").select("*").eq("id", folder_id).eq("tenant_id", tenant_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Carpeta no encontrada")
        
    folder_data = existing.data[0]
    folder_meta = folder_data.get("metadata") or {}
    folder_name = (folder_data.get("name") or "").lower()

    # Protección de carpeta virtual del sistema
    if (
        folder_meta.get("is_virtual_unclassified") in (True, "true")
        or folder_meta.get("system_managed") in (True, "true")
        or "sin clasificar" in folder_name
    ):
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar la carpeta del sistema Sin Clasificar"
        )
        
    if reassign_to_unclassified:
        # 1. Buscar la carpeta virtual de 'Sin Clasificar' del tenant
        virtual_folder_id = None
        try:
            folders_res = supabase.table("document_folders").select("id, name, metadata").eq("tenant_id", tenant_id).execute()
            for f in (folders_res.data or []):
                meta = f.get("metadata") or {}
                fname = (f.get("name") or "").lower()
                if (
                    meta.get("is_virtual_unclassified") in (True, "true")
                    or meta.get("system_managed") in (True, "true")
                    or "sin clasificar" in fname
                ):
                    virtual_folder_id = f["id"]
                    break
        except Exception as f_err:
            print(f"Error finding virtual unclassified folder during delete: {f_err}")

        # 2. Reasignar folios de la carpeta a la carpeta virtual (o None)
        folios_res = client.table("folios").select("id").eq("folder_id", folder_id).execute()
        if folios_res.data and len(folios_res.data) > 0:
            target_folder_id = virtual_folder_id if virtual_folder_id else None
            client.table("folios").update({
                "folder_id": target_folder_id,
                "sequence_order": None
            }).eq("folder_id", folder_id).execute()

        # 3. Mover subcarpetas al padre de la carpeta eliminada
        parent_id = folder_data.get("parent_id")
        client.table("document_folders").update({
            "parent_id": parent_id
        }).eq("parent_id", folder_id).eq("tenant_id", tenant_id).execute()

    else:
        # Si no se permite reasignar, validar que no tenga subcarpetas ni folios
        children = client.table("document_folders").select("id").eq("parent_id", folder_id).eq("tenant_id", tenant_id).execute()
        if children.data and len(children.data) > 0:
            raise HTTPException(
                status_code=400,
                detail="No se puede eliminar una carpeta que contiene subcarpetas o folios. Reasigna los contenidos primero."
            )
            
        folios = client.table("folios").select("id").eq("folder_id", folder_id).execute()
        if folios.data and len(folios.data) > 0:
            raise HTTPException(
                status_code=400,
                detail="No se puede eliminar una carpeta que contiene subcarpetas o folios. Reasigna los contenidos primero."
            )
        
    client.table("document_folders").delete().eq("id", folder_id).eq("tenant_id", tenant_id).execute()
    return {"status": "success", "message": "Carpeta eliminada exitosamente"}


@app.get("/api/v1/folders/unclassified-folios")
async def get_unclassified_folios(
    x_tenant_id: Optional[str] = Header(None),
    auth: Dict[str, Any] = Depends(get_auth_context)
):
    tenant_id = auth.get("tenant_id") or x_tenant_id
    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id es requerido")

    # 1. Buscar la carpeta virtual de 'Sin Clasificar' del tenant
    virtual_folder_id = None
    try:
        folders_res = supabase.table("document_folders").select("id, name, metadata").eq("tenant_id", tenant_id).execute()
        for f in (folders_res.data or []):
            meta = f.get("metadata") or {}
            fname = (f.get("name") or "").lower()
            if (
                meta.get("is_virtual_unclassified") in (True, "true")
                or meta.get("system_managed") in (True, "true")
                or "sin clasificar" in fname
            ):
                virtual_folder_id = f["id"]
                break
    except Exception as f_err:
        print(f"Error finding virtual unclassified folder: {f_err}")

    # 2. Consultar todos los folios del tenant_id donde folder_id IS NULL O folder_id == virtual_folder_id
    folios = []
    try:
        query = supabase.table("folios").select("*, batches(id, template_id, templates(name))").eq("tenant_id", tenant_id)
        if virtual_folder_id:
            query = query.or_(f"folder_id.is.null,folder_id.eq.{virtual_folder_id}")
        else:
            query = query.is_("folder_id", "null")
            
        folios_res = query.order("created_at", desc=True).limit(200).execute()
        folios = folios_res.data or []
    except Exception as q_err:
        print(f"Notice: query join failed, trying fallback folios query: {q_err}")
        try:
            fb_query = supabase.table("folios").select("*").eq("tenant_id", tenant_id)
            if virtual_folder_id:
                fb_query = fb_query.or_(f"folder_id.is.null,folder_id.eq.{virtual_folder_id}")
            else:
                fb_query = fb_query.is_("folder_id", "null")
            fb_res = fb_query.order("created_at", desc=True).limit(200).execute()
            folios = fb_res.data or []
        except Exception as fb_err:
            print(f"Error in fallback folios query: {fb_err}")
            folios = []

    return {
        "status": "success",
        "data": folios,
        "unclassified_folder_id": virtual_folder_id
    }


@app.get("/api/v1/folders/tree")
async def get_folders_tree(
    x_tenant_id: Optional[str] = Header(None),
    auth: Dict[str, Any] = Depends(get_auth_context)
):
    tenant_id = auth.get("tenant_id") or x_tenant_id
    client = auth.get("user_client") or supabase
    
    if not tenant_id:
        return {"status": "success", "data": []}
    
    # 1. Obtener todas las carpetas del tenant
    folders_res = supabase.table("document_folders").select("*").eq("tenant_id", tenant_id).order("name").execute()
    folders = folders_res.data or []
    
    # Identificar la carpeta virtual de 'Sin Clasificar'
    virtual_folder_id = None
    for f in folders:
        meta = f.get("metadata") or {}
        fname = (f.get("name") or "").lower()
        if (
            meta.get("is_virtual_unclassified") in (True, "true")
            or meta.get("system_managed") in (True, "true")
            or "sin clasificar" in fname
        ):
            virtual_folder_id = f["id"]
            break

    # 2. Conteo de folios agrupados por folder_id
    folios_counts: Dict[str, int] = {}
    entries_counts: Dict[str, int] = {}
    try:
        folios_res = supabase.table("folios").select("id, folder_id").eq("tenant_id", tenant_id).execute()
        folder_folio_map = {}
        for f in folios_res.data or []:
            fid = f.get("folder_id")
            if fid:
                folios_counts[fid] = folios_counts.get(fid, 0) + 1
                folder_folio_map[f["id"]] = fid
            elif virtual_folder_id:
                folios_counts[virtual_folder_id] = folios_counts.get(virtual_folder_id, 0) + 1
                folder_folio_map[f["id"]] = virtual_folder_id

        # Conteo de partidas por carpeta si folio_entries existe
        try:
            entries_res = supabase.table("folio_entries").select("id, folio_id").eq("tenant_id", tenant_id).execute()
            for e in entries_res.data or []:
                folio_id = e.get("folio_id")
                fid = folder_folio_map.get(folio_id)
                if fid:
                    entries_counts[fid] = entries_counts.get(fid, 0) + 1
        except Exception:
            pass
    except Exception as count_err:
        print(f"Error counting folios in tree: {count_err}")
        
    # 3. Construir árbol jerárquico
    nodes_by_id = {}
    for f in folders:
        fid = f["id"]
        nodes_by_id[fid] = {
            **f,
            "total_folios": folios_counts.get(fid, 0),
            "total_entries": entries_counts.get(fid, 0),
            "children": []
        }
        
    tree = []
    for f in folders:
        fid = f["id"]
        node = nodes_by_id[fid]
        parent_id = f.get("parent_id")
        if parent_id and parent_id in nodes_by_id:
            nodes_by_id[parent_id]["children"].append(node)
        else:
            tree.append(node)
            
    return {"status": "success", "data": tree}


@app.get("/api/v1/folders/geographic-suggestions")
async def get_geographic_suggestions(
    x_tenant_id: Optional[str] = Header(None),
    auth: Dict[str, Any] = Depends(get_auth_context)
):
    """
    T02-BE-01: Extrae, limpia y deduplica listas ordenadas de dimensiones territoriales
    usadas en las carpetas de la organización para autocompletado en frontend.
    """
    tenant_id = auth.get("tenant_id") or x_tenant_id
    if not tenant_id:
        return {
            "status": "success",
            "data": {
                "countries": [],
                "states": [],
                "municipalities": [],
                "cities_or_localities": [],
                "dioceses": [],
                "parishes": []
            }
        }

    client = auth.get("user_client") or supabase
    try:
        folders_res = client.table("document_folders").select("name, folder_type, metadata").eq("tenant_id", tenant_id).execute()
        folders = folders_res.data or []
    except Exception as e:
        print(f"Error fetching folders for geographic suggestions: {e}")
        folders = []

    countries_set = set()
    states_set = set()
    municipalities_set = set()
    cities_set = set()
    dioceses_set = set()
    parishes_set = set()

    # Incluir país y estado por defecto del tenant si existen
    try:
        t_res = client.table("tenants").select("country, state").eq("id", tenant_id).execute()
        if t_res.data and len(t_res.data) > 0:
            t_row = t_res.data[0]
            if t_row.get("country") and str(t_row["country"]).strip():
                countries_set.add(str(t_row["country"]).strip())
            if t_row.get("state") and str(t_row["state"]).strip():
                states_set.add(str(t_row["state"]).strip())
    except Exception as t_err:
        print(f"Notice fetching tenant geo for suggestions: {t_err}")

    for f in folders:
        meta = f.get("metadata") or {}
        ftype = f.get("folder_type")
        fname = (f.get("name") or "").strip()

        # Extraer de metadata
        if meta.get("country") and str(meta["country"]).strip():
            countries_set.add(str(meta["country"]).strip())
        if meta.get("state") and str(meta["state"]).strip():
            states_set.add(str(meta["state"]).strip())
        if meta.get("municipality") and str(meta["municipality"]).strip():
            municipalities_set.add(str(meta["municipality"]).strip())
        if meta.get("city_or_locality") and str(meta["city_or_locality"]).strip():
            cities_set.add(str(meta["city_or_locality"]).strip())
        if meta.get("diocese_name") and str(meta["diocese_name"]).strip():
            dioceses_set.add(str(meta["diocese_name"]).strip())
        if meta.get("parish_name") and str(meta["parish_name"]).strip():
            parishes_set.add(str(meta["parish_name"]).strip())

        # Extraer nombres según ftype si son relevantes
        if ftype == "parish" and fname:
            parishes_set.add(fname)
        elif ftype == "root" and fname:
            dioceses_set.add(fname)

    return {
        "status": "success",
        "data": {
            "countries": sorted(list(countries_set)),
            "states": sorted(list(states_set)),
            "municipalities": sorted(list(municipalities_set)),
            "cities_or_localities": sorted(list(cities_set)),
            "dioceses": sorted(list(dioceses_set)),
            "parishes": sorted(list(parishes_set))
        }
    }


@app.post("/api/v1/folders/{folder_id}/assign-folios")
async def assign_folios_to_folder(
    folder_id: str,
    request: AssignFoliosRequest,
    auth: Dict[str, Any] = Depends(get_auth_context)
):
    role = auth.get("role")
    if role not in ("admin", "archivist", "superadmin"):
        raise HTTPException(
            status_code=403,
            detail="Permiso denegado: solo administradores o archivistas pueden reasignar folios"
        )
        
    tenant_id = auth.get("tenant_id")
    client = auth.get("user_client") or supabase
    
    # 1. Verificar que la carpeta exista y pertenezca al tenant_id
    if not tenant_id:
        f_check = client.table("document_folders").select("tenant_id").eq("id", folder_id).execute()
        if f_check.data and f_check.data[0].get("tenant_id"):
            tenant_id = f_check.data[0].get("tenant_id")
        else:
            raise HTTPException(status_code=400, detail="Se requiere especificar la organización (tenant_id)")

    folder_res = client.table("document_folders").select("*").eq("id", folder_id).eq("tenant_id", tenant_id).execute()
    if not folder_res.data:
        raise HTTPException(status_code=404, detail="Carpeta o tomo de destino no encontrado")
        
    folder = folder_res.data[0]
    folder_meta = folder.get("metadata") or {}
    template_id = folder_meta.get("template_id")
    
    if not request.folio_ids:
        return {"status": "success", "message": "0 folios reasignados exitosamente a la carpeta"}
        
    # 2. Obtener información de la organización (tenant) para el nombre canónico
    tenant_subdomain = ""
    try:
        tenant_res = supabase.table("tenants").select("subdomain, name").eq("id", tenant_id).execute()
        if tenant_res.data and len(tenant_res.data) > 0:
            tenant_subdomain = tenant_res.data[0].get("subdomain") or tenant_res.data[0].get("name") or ""
    except Exception as t_err:
        print(f"Notice fetching tenant in assign_folios: {t_err}")

    tome_name = folder.get("name", "Tomo")
    tome_number = folder_meta.get("tome_number") or folder_meta.get("number")

    # 3. Obtener el sequence_order máximo actual en esa carpeta
    seq_res = client.table("folios").select("sequence_order").eq("folder_id", folder_id).order("sequence_order", desc=True).limit(1).execute()
    current_max_seq = 0
    if seq_res.data and len(seq_res.data) > 0:
        val = seq_res.data[0].get("sequence_order")
        if val is not None:
            current_max_seq = int(val)
            
    # 4. Asignar cada folio con secuencia correlativa y nombre canónico
    for folio_id in request.folio_ids:
        current_max_seq += 1

        # Obtener folio original para preservar extensión de r2_url u original_filename
        orig_file_ref = None
        try:
            f_row = client.table("folios").select("r2_url, original_filename, file_name, batch_id").eq("id", folio_id).execute()
            if f_row.data and len(f_row.data) > 0:
                row_data = f_row.data[0]
                orig_file_ref = row_data.get("r2_url") or row_data.get("original_filename") or row_data.get("file_name")
        except Exception:
            pass

        canonical_name = compute_canonical_filename(
            tenant_subdomain=tenant_subdomain,
            tome_name=tome_name,
            tome_number=tome_number,
            sequence_order=current_max_seq,
            original_filename_or_url=orig_file_ref
        )

        update_payload: Dict[str, Any] = {
            "folder_id": folder_id,
            "sequence_order": current_max_seq,
            "canonical_filename": canonical_name
        }
        
        # Si el tomo tiene template_id y el lote del folio lo amerita, se actualiza la referencia
        client.table("folios").update(update_payload).eq("id", folio_id).execute()
        
        if template_id:
            try:
                # Si el folio pertenece a un batch, opcionalmente sincronizamos template_id del batch si no tenía
                folio_row = client.table("folios").select("batch_id").eq("id", folio_id).execute()
                if folio_row.data and folio_row.data[0].get("batch_id"):
                    b_id = folio_row.data[0]["batch_id"]
                    batch_row = client.table("batches").select("template_id").eq("id", b_id).execute()
                    if batch_row.data and not batch_row.data[0].get("template_id"):
                        client.table("batches").update({"template_id": template_id}).eq("id", b_id).execute()
            except Exception:
                pass

    return {
        "status": "success",
        "message": f"{len(request.folio_ids)} folios reasignados exitosamente a la carpeta"
    }


def build_canonical_place(
    city_or_locality: Optional[str] = None,
    municipality: Optional[str] = None,
    state: Optional[str] = None,
    country: Optional[str] = None
) -> Optional[str]:
    """
    Retorna en orden ascendente estándar internacional FamilySearch:
    "Localidad, Municipio, Estado, País"
    Filtrando elementos nulos o vacíos.
    """
    parts = [str(p).strip() for p in (city_or_locality, municipality, state, country) if p and str(p).strip()]
    return ", ".join(parts) if parts else None


def _fill_tenant_geo_fallback(client: Client, tenant_id: str, context: Dict[str, Any]) -> None:
    if not tenant_id:
        return
    if context.get("country") and context.get("state"):
        return
    try:
        t_res = client.table("tenants").select("country, state, name").eq("id", tenant_id).execute()
        if t_res.data and len(t_res.data) > 0:
            t_row = t_res.data[0]
            if not context.get("country") and t_row.get("country"):
                val = str(t_row["country"]).strip()
                if val:
                    context["country"] = val
            if not context.get("state") and t_row.get("state"):
                val = str(t_row["state"]).strip()
                if val:
                    context["state"] = val
    except Exception as t_err:
        print(f"Warning in _fill_tenant_geo_fallback: {t_err}")


def _resolve_folder_inherited_context(client: Client, folder_id: Optional[str], tenant_id: str) -> Dict[str, Any]:
    context: Dict[str, Any] = {
        "parish_name": None,
        "diocese_name": None,
        "tome_number": None,
        "year_start": None,
        "year_end": None,
        "country": None,
        "state": None,
        "municipality": None,
        "city_or_locality": None,
        "canonical_place": None
    }
    if not folder_id:
        _fill_tenant_geo_fallback(client, tenant_id, context)
        context["canonical_place"] = build_canonical_place(
            context.get("city_or_locality"),
            context.get("municipality"),
            context.get("state"),
            context.get("country")
        )
        return context

    current_id = folder_id
    visited = set()

    for _ in range(8):  # Protección contra ciclos (hasta 8 niveles)
        if not current_id or current_id in visited:
            break
        visited.add(current_id)

        res = client.table("document_folders").select("*").eq("id", current_id).eq("tenant_id", tenant_id).execute()
        if not res.data:
            break
        folder = res.data[0]
        meta = folder.get("metadata") or {}
        ftype = folder.get("folder_type")
        fname = folder.get("name")

        # Asignaciones estructurales por tipo
        if ftype == "tome":
            if not context["tome_number"]:
                context["tome_number"] = meta.get("tome_number") or meta.get("number") or fname
            if not context["year_start"]:
                context["year_start"] = meta.get("year_start") or meta.get("start_year")
            if not context["year_end"]:
                context["year_end"] = meta.get("year_end") or meta.get("end_year")
        elif ftype == "parish":
            if not context["parish_name"]:
                context["parish_name"] = meta.get("parish_name") or fname
        elif ftype == "root":
            if not context["diocese_name"]:
                context["diocese_name"] = meta.get("diocese_name") or fname

        # Campos geográficos y jurisdiccionales con sobreescritura parcial
        for field in ("country", "state", "municipality", "city_or_locality", "diocese_name", "parish_name"):
            if not context[field] and meta.get(field):
                val = str(meta[field]).strip()
                if val:
                    context[field] = val

        if not context["tome_number"] and meta.get("tome_number"):
            context["tome_number"] = meta.get("tome_number")
        if not context["year_start"] and (meta.get("year_start") or meta.get("start_year")):
            context["year_start"] = meta.get("year_start") or meta.get("start_year")
        if not context["year_end"] and (meta.get("year_end") or meta.get("end_year")):
            context["year_end"] = meta.get("year_end") or meta.get("end_year")

        current_id = folder.get("parent_id")

    # Fallback final a datos del tenant para país y estado si siguen vacíos
    _fill_tenant_geo_fallback(client, tenant_id, context)

    # Consolidación de la cadena canónica estándar FamilySearch
    context["canonical_place"] = build_canonical_place(
        context.get("city_or_locality"),
        context.get("municipality"),
        context.get("state"),
        context.get("country")
    )
    return context


@app.get("/api/v1/folios/{folio_id}/entries")
async def get_folio_entries(
    folio_id: str,
    auth: Dict[str, Any] = Depends(get_auth_context)
):
    tenant_id = auth["tenant_id"]
    client = auth.get("user_client") or supabase

    folio_res = client.table("folios").select("*").eq("id", folio_id).eq("tenant_id", tenant_id).execute()
    if not folio_res.data:
        raise HTTPException(status_code=404, detail="Folio no encontrado")

    folio = folio_res.data[0]
    folder_id = folio.get("folder_id")
    inherited_context = _resolve_folder_inherited_context(client, folder_id, tenant_id)

    entries_res = client.table("folio_entries").select("*").eq("folio_id", folio_id).eq("tenant_id", tenant_id).order("entry_number").execute()
    entries = entries_res.data or []

    if not entries:
        existing_meta = folio.get("metadata")
        if existing_meta and isinstance(existing_meta, dict) and len(existing_meta) > 0:
            entries = [{
                "id": f"synthetic-{folio_id}-1",
                "folio_id": folio_id,
                "entry_number": 1,
                "status": folio.get("status") or "pending",
                "metadata": existing_meta,
                "bounding_box": None
            }]
        else:
            entries = [{
                "id": f"synthetic-{folio_id}-1",
                "folio_id": folio_id,
                "entry_number": 1,
                "status": "pending",
                "metadata": {},
                "bounding_box": None
            }]

    inherited_tome_metadata = {
        "diocese": inherited_context.get("diocese_name") or "",
        "parish": inherited_context.get("parish_name") or "",
        "locality": inherited_context.get("canonical_place") or "",
        "country": inherited_context.get("country") or "",
        "state": inherited_context.get("state") or "",
        "municipality": inherited_context.get("municipality") or "",
        "city_or_locality": inherited_context.get("city_or_locality") or "",
        "series": "",
        "tome": str(inherited_context.get("tome_number") or ""),
        "years_range": f"{inherited_context.get('year_start') or ''}-{inherited_context.get('year_end') or ''}".strip("-")
    }

    return {
        "status": "success",
        "folio_id": folio_id,
        "folio_number": folio.get("sequence_order") or 1,
        "canonical_filename": folio.get("canonical_filename"),
        "original_filename": folio.get("original_filename"),
        "inherited_context": inherited_context,
        "inherited_tome_metadata": inherited_tome_metadata,
        "entries": entries,
        "data": {
            "folio_id": folio_id,
            "entries": entries,
            "inherited_context": inherited_context,
            "inherited_tome_metadata": inherited_tome_metadata
        }
    }


@app.post("/api/v1/folios/{folio_id}/entries")
async def save_folio_entries(
    folio_id: str,
    request: BatchSaveEntriesRequest,
    auth: Dict[str, Any] = Depends(get_auth_context)
):
    tenant_id = auth["tenant_id"]
    client = auth.get("user_client") or supabase
    user_id = auth.get("user_id")

    folio_res = client.table("folios").select("*").eq("id", folio_id).eq("tenant_id", tenant_id).execute()
    if not folio_res.data:
        raise HTTPException(status_code=404, detail="Folio no encontrado")

    saved_entries = []
    now_iso = datetime.now(timezone.utc).isoformat()

    for entry in request.entries:
        entry_payload = {
            "tenant_id": tenant_id,
            "folio_id": folio_id,
            "entry_number": entry.entry_number,
            "status": entry.status or "pending",
            "metadata": entry.metadata,
            "bounding_box": entry.bounding_box,
            "updated_at": now_iso
        }

        exist_res = client.table("folio_entries").select("id").eq("folio_id", folio_id).eq("entry_number", entry.entry_number).execute()
        if exist_res.data and len(exist_res.data) > 0:
            e_id = exist_res.data[0]["id"]
            upd = client.table("folio_entries").update(entry_payload).eq("id", e_id).execute()
            if upd.data:
                saved_entries.append(upd.data[0])
            else:
                saved_entries.append({"id": e_id, **entry_payload})
        else:
            entry_payload["created_at"] = now_iso
            entry_payload["created_by"] = user_id
            ins = client.table("folio_entries").insert(entry_payload).execute()
            if ins.data:
                saved_entries.append(ins.data[0])
            else:
                saved_entries.append(entry_payload)

    if request.final_status == "completed":
        folio_update: Dict[str, Any] = {
            "status": "completed",
            "locked_at": None,
            "verified_at": now_iso
        }
        if request.entries:
            folio_update["metadata"] = request.entries[0].metadata
        client.table("folios").update(folio_update).eq("id", folio_id).eq("tenant_id", tenant_id).execute()
    elif request.final_status:
        client.table("folios").update({
            "status": request.final_status,
            "locked_at": None
        }).eq("id", folio_id).eq("tenant_id", tenant_id).execute()

    return {
        "status": "success",
        "message": f"{len(saved_entries)} partidas guardadas exitosamente",
        "data": saved_entries
    }


@app.put("/api/v1/folios/{folio_id}/entries/{entry_id}")
async def update_single_folio_entry(
    folio_id: str,
    entry_id: str,
    entry_in: FolioEntryUpdate,
    auth: Dict[str, Any] = Depends(get_auth_context)
):
    tenant_id = auth["tenant_id"]
    client = auth.get("user_client") or supabase

    now_iso = datetime.now(timezone.utc).isoformat()
    update_data: Dict[str, Any] = {
        "metadata": entry_in.metadata,
        "updated_at": now_iso
    }
    if entry_in.status:
        update_data["status"] = entry_in.status
    if entry_in.bounding_box is not None:
        update_data["bounding_box"] = entry_in.bounding_box

    res = client.table("folio_entries").update(update_data).eq("id", entry_id).eq("folio_id", folio_id).eq("tenant_id", tenant_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Partida no encontrada")

    return {"status": "success", "data": res.data[0]}


# --------------------------------------------------------------------------
# FamilySearch DIP Interoperability & Export Endpoints
# --------------------------------------------------------------------------

try:
    from exporters.familysearch import (
        generate_familysearch_matrix,
        generate_gedcom_551,
        generate_manifest_json
    )
except ImportError:
    from backend.exporters.familysearch import (
        generate_familysearch_matrix,
        generate_gedcom_551,
        generate_manifest_json
    )

import zipfile


@app.get("/api/v1/folders/{folder_id}/pre-export-summary")
async def get_folder_pre_export_summary(
    folder_id: str,
    auth: Dict[str, Any] = Depends(get_auth_context)
):
    tenant_id = auth["tenant_id"]
    client = auth.get("user_client") or supabase

    # 1. Obtener la carpeta (validar tenant_id)
    folder_res = client.table("document_folders").select("*").eq("id", folder_id).eq("tenant_id", tenant_id).execute()
    if not folder_res.data:
        raise HTTPException(status_code=404, detail="Carpeta o tomo no encontrado")

    folder = folder_res.data[0]
    folder_name = folder.get("name", "Tomo")

    # 2. Obtener todos los folios asignados a esta carpeta
    folios_res = client.table("folios").select("id, folder_id, status, sequence_order, original_filename, canonical_filename").eq("folder_id", folder_id).execute()
    folios = folios_res.data or []
    folio_ids = [f["id"] for f in folios]

    total_folios = len(folios)
    total_entries = 0
    completed_entries = 0
    revision_entries = 0
    pending_entries = 0
    doubtful_folios = []

    if folio_ids:
        # Obtener partidas de estos folios
        entries_res = client.table("folio_entries").select("id, folio_id, entry_number, status, metadata").in_("folio_id", folio_ids).eq("tenant_id", tenant_id).execute()
        entries = entries_res.data or []

        # Si no hay entradas en folio_entries, sintetizar desde folios
        if not entries:
            for f in folios:
                f_status = f.get("status") or "pending"
                if f_status == "completed":
                    completed_entries += 1
                elif f_status in ("revision", "doubtful", "dudoso"):
                    revision_entries += 1
                    doubtful_folios.append(f)
                else:
                    pending_entries += 1
                total_entries += 1
        else:
            total_entries = len(entries)
            folio_obj_map = {f["id"]: f for f in folios}
            seen_doubtful_folios = set()
            for e in entries:
                e_status = (e.get("status") or "pending").lower()
                if e_status == "completed":
                    completed_entries += 1
                elif e_status in ("revision", "doubtful", "dudoso"):
                    revision_entries += 1
                    fid = e.get("folio_id")
                    if fid and fid not in seen_doubtful_folios:
                        seen_doubtful_folios.add(fid)
                        doubtful_folios.append(folio_obj_map.get(fid, {"id": fid}))
                else:
                    pending_entries += 1

    has_revisions = revision_entries > 0

    # T02-BE-03: Resolver contexto geográfico y validar localidad mínima
    tome_context = _resolve_folder_inherited_context(client, folder_id, tenant_id)
    warnings: List[str] = []
    if not tome_context.get("country") or not tome_context.get("state"):
        warnings.append(
            "Aviso: El tomo no tiene localidad completa (País o Estado ausente). "
            "Se recomienda completarla para interoperabilidad óptima con FamilySearch."
        )

    geographic_summary = {
        "country": tome_context.get("country"),
        "state": tome_context.get("state"),
        "municipality": tome_context.get("municipality"),
        "city_or_locality": tome_context.get("city_or_locality"),
        "canonical_place": tome_context.get("canonical_place"),
        "is_complete": bool(tome_context.get("country") and tome_context.get("state"))
    }

    return {
        "status": "success",
        "data": {
            "tome_id": folder_id,
            "tome_name": folder_name,
            "folder_type": folder.get("folder_type"),
            "total_folios": total_folios,
            "total_entries": total_entries,
            "completed_entries": completed_entries,
            "revision_entries": revision_entries,
            "pending_entries": pending_entries,
            "has_revisions": has_revisions,
            "doubtful_folios_count": len(doubtful_folios),
            "ready_for_export": total_folios > 0,
            "warnings": warnings,
            "tome_context": tome_context,
            "geographic_summary": geographic_summary
        }
    }


@app.get("/api/v1/folders/{folder_id}/export-familysearch")
async def export_familysearch_package(
    folder_id: str,
    include_images: bool = Query(False, description="Incluir archivos de fotos de alta resolución en subcarpeta images/"),
    auth: Dict[str, Any] = Depends(get_auth_context)
):
    tenant_id = auth["tenant_id"]
    client = auth.get("user_client") or supabase

    # 1. Obtener carpeta y contexto
    folder_res = client.table("document_folders").select("*").eq("id", folder_id).eq("tenant_id", tenant_id).execute()
    if not folder_res.data:
        raise HTTPException(status_code=404, detail="Carpeta o tomo no encontrado")

    folder = folder_res.data[0]
    tome_metadata = _resolve_folder_inherited_context(client, folder_id, tenant_id)
    tome_metadata["folder_name"] = folder.get("name", "Tomo")

    # 2. Folios del tomo
    folios_res = client.table("folios").select("*").eq("folder_id", folder_id).order("sequence_order", desc=False).execute()
    folios = folios_res.data or []
    folio_ids = [f["id"] for f in folios]

    # Obtener el subdominio o nombre de la organización
    tenant_subdomain = ""
    try:
        tenant_res = supabase.table("tenants").select("subdomain, name").eq("id", tenant_id).execute()
        if tenant_res.data and len(tenant_res.data) > 0:
            tenant_subdomain = tenant_res.data[0].get("subdomain") or tenant_res.data[0].get("name") or ""
    except Exception as t_err:
        print(f"Notice fetching tenant in export_familysearch: {t_err}")

    tome_name = folder.get("name", "Tomo")
    folder_meta = folder.get("metadata") or {}
    tome_number = folder_meta.get("tome_number") or folder_meta.get("number")

    # Asegurar nombres canónicos para todos los folios y persistirlos retroactivamente si faltan
    for idx, f in enumerate(folios, start=1):
        seq = f.get("sequence_order")
        if seq is None or seq <= 0:
            seq = idx
            f["sequence_order"] = seq

        c_name = f.get("canonical_filename") or ""
        # Verificar si está vacío o si parece un identificador temporal tipo folio_ UUID
        needs_canonical = (
            not c_name or
            c_name.startswith("folio_") or
            re.match(r"^folio_[a-f0-9\-]+", c_name, re.IGNORECASE)
        )

        if needs_canonical:
            orig_ref = f.get("r2_url") or f.get("original_filename") or f.get("file_name")
            c_name = compute_canonical_filename(
                tenant_subdomain=tenant_subdomain,
                tome_name=tome_name,
                tome_number=tome_number,
                sequence_order=seq,
                original_filename_or_url=orig_ref
            )
            f["canonical_filename"] = c_name

            # Persistir en base de datos para que quede guardado permanentemente
            try:
                client.table("folios").update({
                    "canonical_filename": c_name,
                    "sequence_order": seq
                }).eq("id", f["id"]).execute()
            except Exception as upd_err:
                print(f"Warning persisting canonical_filename for folio {f.get('id')}: {upd_err}")

    # 3. Partidas
    entries = []
    if folio_ids:
        entries_res = client.table("folio_entries").select("*").in_("folio_id", folio_ids).eq("tenant_id", tenant_id).order("entry_number").execute()
        entries = entries_res.data or []

    # Si no hay entradas en folio_entries, sintetizar a partir de metadata de folios
    if not entries and folios:
        for f in folios:
            f_meta = f.get("metadata") or {}
            entries.append({
                "id": f"syn-{f['id']}",
                "folio_id": f["id"],
                "entry_number": 1,
                "status": f.get("status") or "completed",
                "metadata": f_meta
            })

    total_completed = sum(1 for e in entries if (e.get("status") or "").lower() == "completed")
    total_revision = sum(1 for e in entries if (e.get("status") or "").lower() in ("revision", "doubtful", "dudoso"))

    # 4. Generar componentes de datos
    excel_bytes, csv_bytes = generate_familysearch_matrix(entries, folios, tome_metadata)
    gedcom_str = generate_gedcom_551(entries, folios, tome_metadata)
    manifest_data = generate_manifest_json(folder, folios, entries, total_completed, total_revision, tome_metadata=tome_metadata)
    manifest_bytes = json.dumps(manifest_data, ensure_ascii=False, indent=2).encode("utf-8")

    # 5. Generar paquete ZIP
    zip_bio = io.BytesIO()
    with zipfile.ZipFile(zip_bio, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("manifest.json", manifest_bytes)
        zf.writestr("matriz_indexacion.xlsx", excel_bytes)
        zf.writestr("matriz_indexacion.csv", csv_bytes)
        zf.writestr("export_gedcom.ged", gedcom_str.encode("utf-8"))

        if include_images:
            bucket_name = os.getenv("R2_BUCKET_NAME")
            for f in folios:
                canonical_name = f.get("canonical_filename") or f.get("original_filename") or f"folio_{f['id']}.jpg"
                r2_key = f.get("r2_url") or f.get("file_name") or f.get("original_filename")
                if bucket_name and r2_key:
                    # Limpiar r2_key si contiene URL completa
                    if "/" in r2_key and "://" in r2_key:
                        r2_key = r2_key.split(f"{bucket_name}/")[-1]
                    try:
                        obj = s3_client.get_object(Bucket=bucket_name, Key=r2_key)
                        img_bytes = obj["Body"].read()
                        zf.writestr(f"images/{canonical_name}", img_bytes)
                    except Exception as s3_err:
                        print(f"Warning streaming image {r2_key} for DIP export: {s3_err}")

    zip_bio.seek(0)
    zip_bytes = zip_bio.getvalue()

    raw_name = folder.get("name", "Tomo").replace(" ", "_")
    safe_name = re.sub(r"[^\w\-_\.]", "", raw_name) or "Tomo"
    filename = f"{safe_name}_FamilySearch_DIP.zip"

    return StreamingResponse(
        io.BytesIO(zip_bytes),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )





