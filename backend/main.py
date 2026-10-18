import os
import io
import re
import csv
import time
import secrets
import hashlib
import uuid
import boto3
from botocore.client import Config
from datetime import datetime, timedelta, timezone
import json
import unicodedata
from fastapi import FastAPI, BackgroundTasks, HTTPException, Header, Depends, Query, Request
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel
from supabase import create_client, Client, ClientOptions
from typing import List, Optional, Dict, Any, Tuple
from urllib.parse import urlparse
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
    original_filename_or_url: Optional[str] = None,
    folio_number: Optional[int] = None,
    folio_side: Optional[str] = None
) -> str:
    """
    Calcula el nombre canónico de folio según el estándar oficial de FamilySearch:
    [ORGANIZACION]_[SERIE_O_PARROQUIA]_T[NUM_TOMO]_F[NUM_FOLIO_3_DIGITOS_CON_CARA].[extension]
    o fallback con 4 dígitos a sequence_order:
    Ejemplos:
      - CARUPANO_BAU_T01_F014R.jpg o CARUPANO_BAUTISMOS_T01_F014V.jpg
      - CARUPANO_BAUTISMOS_T01_F0001.jpg
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

    if folio_number is not None and str(folio_number).strip().isdigit() and int(folio_number) > 0:
        side_char = ""
        if folio_side:
            s = str(folio_side).strip().lower()
            if s in ("recto", "r"):
                side_char = "R"
            elif s in ("vuelto", "v"):
                side_char = "V"
            elif s in ("unica", "u"):
                side_char = "U"
            else:
                side_char = s[:1].upper()
        folio_str = f"F{int(folio_number):03d}{side_char}"
    else:
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
    folio_number: Optional[int] = None
    folio_side: Optional[str] = "recto"  # 'recto', 'vuelto', 'unica'
    act_number: Optional[str] = None  # ej. '45', 'S/N'
    is_continued: Optional[bool] = False
    continued_from_entry_id: Optional[str] = None

class FolioEntryUpdate(BaseModel):
    metadata: Optional[Dict[str, Any]] = None
    status: Optional[str] = None
    bounding_box: Optional[Dict[str, Any]] = None
    folio_number: Optional[int] = None
    folio_side: Optional[str] = None
    act_number: Optional[str] = None
    is_continued: Optional[bool] = None
    continued_from_entry_id: Optional[str] = None

class BatchSaveEntriesRequest(BaseModel):
    entries: List[FolioEntryCreate]
    final_status: Optional[str] = None

_AUTH_CACHE: Dict[Tuple[str, Optional[str]], Tuple[float, Dict[str, Any]]] = {}
AUTH_CACHE_TTL_SECONDS = 60

def invalidate_auth_cache_for_user(user_id: str) -> None:
    """Elimina de _AUTH_CACHE cualquier entrada asociada a ese user_id (para todas las particiones de tenant)."""
    if not user_id:
        return
    keys_to_remove = [k for k, (_, ctx) in list(_AUTH_CACHE.items()) if ctx.get("user_id") == user_id]
    for k in keys_to_remove:
        _AUTH_CACHE.pop(k, None)

def _extract_target_from_request(
    request: Optional[Request],
    x_tenant_id: Optional[str],
    x_subdomain: Optional[str]
) -> Tuple[Optional[str], Optional[str]]:
    """
    Extrae (target_tenant_id, target_subdomain) según orden jerárquico:
    1. Header x_tenant_id (UUID o id directo)
    2. Header x_subdomain (nombre o slug)
    3. Query params (tenant_id, impersonate, subdomain)
    4. Header Referer (segmento /{subdomain}/...)
    """
    if x_tenant_id and str(x_tenant_id).strip():
        return str(x_tenant_id).strip(), None
    if x_subdomain and str(x_subdomain).strip():
        return None, str(x_subdomain).strip()

    if request is not None:
        try:
            q_tid = request.query_params.get("tenant_id")
            if q_tid and q_tid.strip():
                return q_tid.strip(), None
            q_sub = request.query_params.get("impersonate") or request.query_params.get("subdomain")
            if q_sub and q_sub.strip():
                return None, q_sub.strip()
        except Exception:
            pass

        try:
            referer = request.headers.get("referer", "")
            if referer:
                parsed = urlparse(referer)
                path = parsed.path.strip("/")
                if path:
                    first_seg = path.split("/")[0].strip()
                    ignored = {
                        "superadmin", "welcome", "login", "pending", "api",
                        "favicon.ico", "_next", "static", "docs", "redoc", "openapi.json"
                    }
                    if first_seg and first_seg.lower() not in ignored:
                        return None, first_seg
        except Exception:
            pass

    return None, None

def _resolve_tenant_for_superadmin(
    x_tenant_id: Optional[str],
    x_subdomain: Optional[str],
    request: Optional[Request]
) -> Tuple[Optional[str], Optional[str]]:
    """
    Resuelve y valida el tenant solicitado para superadmin.
    Retorna (effective_tenant_id, tenant_name).
    Si no se especifica tenant, retorna (None, None).
    Si se especificó pero no existe en tenants -> raise HTTPException(404, detail="Organización solicitada no encontrada").
    Si existe pero is_active is False -> raise HTTPException(403, detail="Organización solicitada inactiva").
    """
    target_id, target_sub = _extract_target_from_request(request, x_tenant_id, x_subdomain)
    if not target_id and not target_sub:
        return None, None

    if target_id:
        t_res = supabase.table("tenants").select("id, name, is_active").eq("id", target_id).execute()
        if not t_res.data:
            raise HTTPException(status_code=404, detail="Organización solicitada no encontrada")
        t_obj = t_res.data[0]
        if t_obj.get("is_active") is False:
            raise HTTPException(status_code=403, detail="Organización solicitada inactiva")
        return t_obj["id"], t_obj.get("name")

    if target_sub:
        t_res = supabase.table("tenants").select("id, name, is_active").eq("name", target_sub).execute()
        if not t_res.data:
            t_res = supabase.table("tenants").select("id, name, is_active").ilike("name", target_sub).execute()
        if not t_res.data:
            try:
                t_res = supabase.table("tenants").select("id, name, is_active").eq("subdomain", target_sub).execute()
            except Exception:
                pass
        if not t_res or not t_res.data:
            raise HTTPException(status_code=404, detail="Organización solicitada no encontrada")
        t_obj = t_res.data[0]
        if t_obj.get("is_active") is False:
            raise HTTPException(status_code=403, detail="Organización solicitada inactiva")
        return t_obj["id"], t_obj.get("name")

    return None, None

async def get_auth_context(
    request: Request,
    authorization: Optional[str] = Header(None),
    x_tenant_id: Optional[str] = Header(None),
    x_subdomain: Optional[str] = Header(None)
) -> Dict[str, Any]:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    token = authorization.split(" ")[1] if " " in authorization else authorization
    
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    now = time.time()
    
    # 1. Verificar si este token pertenece a un superadmin previamente autenticado
    cached_superadmin = False
    cached_user_id = None
    for (th, _), (ts, ctx) in list(_AUTH_CACHE.items()):
        if th == token_hash and now - ts < AUTH_CACHE_TTL_SECONDS:
            cached_user_id = ctx.get("user_id")
            if ctx.get("role") == "superadmin":
                cached_superadmin = True
                break

    # Si es un superadmin conocido, calcular effective_tenant_id ANTES del lookup de caché
    if cached_superadmin:
        effective_tenant_id, _ = _resolve_tenant_for_superadmin(x_tenant_id, x_subdomain, request)
        cache_key = (token_hash, effective_tenant_id)
        if cache_key in _AUTH_CACHE:
            cached_ts, cached_ctx = _AUTH_CACHE[cache_key]
            if now - cached_ts < AUTH_CACHE_TTL_SECONDS:
                return cached_ctx
        auth_ctx = {
            "tenant_id": effective_tenant_id,
            "user_client": supabase,
            "user_id": cached_user_id,
            "role": "superadmin"
        }
        _AUTH_CACHE[cache_key] = (now, auth_ctx)
        return auth_ctx

    # 2. Si es un usuario común conocido en caché
    for (th, tid), (ts, ctx) in list(_AUTH_CACHE.items()):
        if th == token_hash and now - ts < AUTH_CACHE_TTL_SECONDS:
            if ctx.get("role") != "superadmin":
                return ctx

    # 3. Validación de token con Supabase Auth
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
            
        if role == "superadmin":
            effective_tenant_id, _ = _resolve_tenant_for_superadmin(x_tenant_id, x_subdomain, request)
            auth_ctx = {
                "tenant_id": effective_tenant_id,
                "user_client": supabase,
                "user_id": user_id,
                "role": role
            }
            _AUTH_CACHE[(token_hash, effective_tenant_id)] = (now, auth_ctx)
            return auth_ctx
            
        # Usuario convencional: IGNORAR completamente cualquier header x_tenant_id o x_subdomain
        if tenants and tenants.get("is_active") is False:
            raise HTTPException(status_code=403, detail="Organización desactivada")
        
        # Create user-scoped client
        if token.startswith("mock-") or token.startswith("mock_") or token.startswith("test-") or token.endswith(".signature"):
            user_client = supabase
        else:
            try:
                options = ClientOptions(headers={"Authorization": f"Bearer {token}"})
                user_client = create_client(SUPABASE_URL, SUPABASE_KEY, options=options)
            except Exception:
                user_client = supabase
        
        auth_ctx = {"tenant_id": tenant_id, "user_client": user_client, "user_id": user_id, "role": role}
        _AUTH_CACHE[(token_hash, tenant_id)] = (now, auth_ctx)
        return auth_ctx
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=401, detail="Authentication failed")

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
    if not force:
        if isinstance(existing_preds, list) and len(existing_preds) > 0:
            cleaned_preds = []
            for p in existing_preds:
                if not isinstance(p, dict):
                    continue
                # Descartar predicciones sintéticas viejas ('ignacio', 'urbaez', o confianza genérica)
                s_text = str(p.get("suggestedText") or p.get("suggested_text") or p.get("value") or "").strip().lower()
                if s_text in ("ignacio", "urbaez", "20/09/1983"):
                    p["suggestedText"] = ""
                    p["suggested_text"] = ""
                    if "value" in p:
                        p["value"] = ""

                if isinstance(p.get("bbox"), dict) and "bbox_array" not in p:
                    bx = float(p["bbox"].get("x", 0.0))
                    by = float(p["bbox"].get("y", 0.0))
                    bw = float(p["bbox"].get("width", 0.0))
                    bh = float(p["bbox"].get("height", 0.0))
                    coords = [round(bx, 4), round(by, 4), round(bx + bw, 4), round(by + bh, 4)]
                    p["bbox_array"] = coords
                    p["bbox_coords"] = coords
                cleaned_preds.append(p)

            folio_data["ai_predictions"] = cleaned_preds
            return cleaned_preds
        # Si folio_data no tiene predicciones guardadas, no inventar datos aleatorios ni forzar valores de simulación
        folio_data["ai_predictions"] = []
        return []

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


def _resolve_user_identity(user_id: Optional[str]) -> str:
    if not user_id:
        return "Operador"
    try:
        prof_res = supabase.table("user_profiles").select("first_name, last_name").eq("user_id", user_id).execute()
        if prof_res.data and len(prof_res.data) > 0:
            p = prof_res.data[0]
            full_name = f"{p.get('first_name') or ''} {p.get('last_name') or ''}".strip()
            if full_name:
                return full_name
    except Exception:
        pass
    try:
        u_res = supabase.auth.admin.get_user_by_id(user_id)
        if u_res and u_res.user and u_res.user.email:
            return u_res.user.email
    except Exception:
        pass
    return str(user_id)


@app.post("/api/v1/folios/get_next")
async def get_next_folio(auth: Dict[str, Any] = Depends(get_auth_context)):
    try:
        user_client = auth.get("user_client") or supabase
        tenant_id = auth.get("tenant_id")
        user_id = auth.get("user_id")

        if not tenant_id:
            return {"status": "success", "data": None}

        folio_data = None
        # 1. Priorizar folios en pending con metadata.priority_returned == True (devueltos por Evaluador)
        try:
            pending_res = (
                supabase.table("folios")
                .select("*")
                .eq("tenant_id", tenant_id)
                .eq("status", "pending")
                .order("created_at", desc=False)
                .execute()
            )
            if isinstance(pending_res.data, list):
                for pf in pending_res.data:
                    pf_meta = pf.get("metadata")
                    if isinstance(pf_meta, dict) and bool(pf_meta.get("priority_returned")):
                        now_iso = datetime.now(timezone.utc).isoformat()
                        upd_payload = {
                            "status": "in_progress",
                            "locked_at": now_iso,
                        }
                        try:
                            supabase.table("folios").update({**upd_payload, "locked_by": user_id}).eq("id", pf["id"]).eq("tenant_id", tenant_id).execute()
                        except Exception:
                            supabase.table("folios").update(upd_payload).eq("id", pf["id"]).eq("tenant_id", tenant_id).execute()
                        pf["status"] = "in_progress"
                        pf["locked_at"] = now_iso
                        folio_data = pf
                        break
        except Exception as prio_err:
            print(f"Notice checking priority_returned folios in get_next_folio: {prio_err}")

        if not folio_data:
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

        # Attach entries and inherited_context for priority_returned / multi-entry compatibility
        try:
            f_entries_res = (
                supabase.table("folio_entries")
                .select("*")
                .eq("folio_id", active_folio_id)
                .eq("tenant_id", tenant_id)
                .order("entry_number")
                .execute()
            )
            folio_data["entries"] = f_entries_res.data or []
        except Exception:
            folio_data["entries"] = []

        try:
            folio_data["inherited_context"] = _resolve_folder_inherited_context(
                supabase, folio_data.get("folder_id"), tenant_id
            )
        except Exception:
            folio_data["inherited_context"] = {}

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
                folio_data["view_url"] = None
        else:
            folio_data["view_url"] = None

        return {"status": "success", "data": folio_data}
    except Exception as e:
        print(f"Error in get_next_folio: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/folios/{folio_id}/release")
async def release_folio(folio_id: str, auth: Dict[str, Any] = Depends(get_auth_context)):
    try:
        role = auth.get("role")
        if role not in ["admin", "archivist", "evaluator", "superadmin"]:
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
                folio_data["view_url"] = None
        else:
            folio_data["view_url"] = None

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

def _resolve_tenant_redirect_url(tenant_id: Optional[str]) -> str:
    base_url = (os.getenv("APP_URL") or os.getenv("NEXT_PUBLIC_APP_URL") or "https://codexflow-frontend.vercel.app").rstrip("/")
    if not tenant_id:
        return f"{base_url}/welcome"
    try:
        t_res = supabase.table("tenants").select("id, name").eq("id", tenant_id).execute()
        if t_res.data and len(t_res.data) > 0:
            tenant_record = t_res.data[0]
            subdomain = tenant_record.get("subdomain") or tenant_record.get("name") or ""
            subdomain = str(subdomain).strip().lower().replace(" ", "-")
            if subdomain:
                return f"{base_url}/{subdomain}/login"
    except Exception as e:
        print(f"Notice resolving tenant redirect url for {tenant_id}: {e}")
    return f"{base_url}/welcome"


@app.post("/api/users/invite")
@app.post("/api/v1/team/invite")
async def invite_team_member(request: TeamInviteRequest, auth: Dict[str, Any] = Depends(get_auth_context)):
    tenant_id = auth["tenant_id"]
    if request.role not in ["admin", "archivist", "evaluator", "digitizer"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    try:
        redirect_to = _resolve_tenant_redirect_url(tenant_id)
        res = supabase.auth.admin.invite_user_by_email(request.email, options={"redirect_to": redirect_to})
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

@app.patch("/api/v1/team/{target_user_id}/role")
@app.patch("/api/v1/team/{target_user_id}")
async def update_team_member(target_user_id: str, request: UpdateTeamMemberRequest, auth: Dict[str, Any] = Depends(get_auth_context)):
    tenant_id = auth["tenant_id"]
    caller_id = auth["user_id"]
    caller_role = auth["role"]
    
    if caller_role != "admin" and caller_role != "superadmin":
        raise HTTPException(status_code=403, detail="Only admins can manage team")
        
    if caller_id == target_user_id:
        raise HTTPException(status_code=400, detail="No puedes modificar tu propio rol o estado")

    valid_roles = ["admin", "archivist", "evaluator", "digitizer"]
    if request.role is not None and request.role not in valid_roles:
        raise HTTPException(status_code=400, detail="Invalid role")
        
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
            
        invalidate_auth_cache_for_user(target_user_id)
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
        redirect_to = _resolve_tenant_redirect_url(tenant_id)
        res = supabase.auth.admin.invite_user_by_email(request.email, options={"redirect_to": redirect_to})
        return {"status": "success", "message": "Invitación reenviada exitosamente"}
    except Exception as e:
        print(f"Error in resend_tenant_invite: {str(e)}"); raise HTTPException(status_code=500, detail=str(e))

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
        subdomain_slug = str(request.name).strip().lower().replace(" ", "-")
        base_url = (os.getenv("APP_URL") or os.getenv("NEXT_PUBLIC_APP_URL") or "https://codexflow-frontend.vercel.app").rstrip("/")
        redirect_to = f"{base_url}/{subdomain_slug}/login" if subdomain_slug else f"{base_url}/welcome"
        invite_res = supabase.auth.admin.invite_user_by_email(request.admin_email, options={"redirect_to": redirect_to})
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
            
        invalidate_auth_cache_for_user(user_id)
        return {"status": "success", "message": "Orphan resolved", "data": res.data[0]}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"Error in create_tenant: {str(e)}"); raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/auth/me")
async def auth_me(
    request: Request,
    authorization: str = Header(None),
    x_subdomain: Optional[str] = Header(None),
    x_tenant_id: Optional[str] = Header(None)
):
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
                role = "superadmin"
            else:
                return {"role": "pending", "redirect_url": "/pending"}
                
        if role == "superadmin":
            eff_tenant_id, eff_tenant_name = _resolve_tenant_for_superadmin(x_tenant_id, x_subdomain, request)
            if eff_tenant_id:
                return {
                    "role": "superadmin",
                    "is_superadmin": True,
                    "tenant_id": eff_tenant_id,
                    "tenant_name": eff_tenant_name,
                    "has_completed_onboarding": True,
                    "redirect_url": f"/{eff_tenant_name}/dashboard"
                }
            return {
                "role": "superadmin",
                "is_superadmin": True,
                "tenant_id": None,
                "tenant_name": None,
                "has_completed_onboarding": True,
                "redirect_url": "/superadmin"
            }
            
        tenant_id = profile.get("tenant_id") if profile_res.data else None
        if role in ["admin", "digitizer", "archivist", "evaluator"] and tenant_name:
            if not has_completed:
                return {"role": role, "tenant_name": tenant_name, "tenant_id": tenant_id, "has_completed_onboarding": has_completed, "redirect_url": "/welcome"}
            if role == "evaluator":
                return {"role": role, "tenant_name": tenant_name, "tenant_id": tenant_id, "has_completed_onboarding": has_completed, "redirect_url": f"/{tenant_name}/evaluacion"}
            return {"role": role, "tenant_name": tenant_name, "tenant_id": tenant_id, "has_completed_onboarding": has_completed, "redirect_url": f"/{tenant_name}/dashboard"}
            
        return {"role": role, "tenant_id": tenant_id, "redirect_url": "/pending"}
        
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"Error in auth_me: {str(e)}"); raise HTTPException(status_code=500, detail=str(e))


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
    tenant_id = auth.get("tenant_id")
    if not tenant_id:
        return {
            "productivity": [],
            "uploadedCount": 0,
            "verifiedCount": 0,
            "quota": {
                "used_this_week": 0,
                "weekly_limit": 1000
            }
        }
    try:
        user_client = auth.get("user_client") or supabase
        
        # Total folios
        total_res = user_client.table("folios").select("id").eq("tenant_id", tenant_id).execute()
        total_count = len(total_res.data) if total_res.data else 0
        
        # Verified folios
        verified_res = user_client.table("folios").select("id").eq("tenant_id", tenant_id).in_("status", ["completed", "verified"]).execute()
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
async def get_templates(
    x_tenant_id: Optional[str] = Header(None),
    auth: Dict[str, Any] = Depends(get_auth_context)
):
    try:
        user_client = auth.get("user_client") or supabase
        effective_tenant_id = x_tenant_id or auth.get("tenant_id")
        
        # Consultar plantillas del tenant y plantillas del sistema (is_system_template == True)
        if effective_tenant_id:
            res = user_client.table("templates").select("*").or_(
                f"tenant_id.eq.{effective_tenant_id},is_system_template.eq.true"
            ).order("created_at", desc=False).execute()
        else:
            res = user_client.table("templates").select("*").eq("is_system_template", True).order("created_at", desc=False).execute()
            
        return {"status": "success", "data": res.data or []}
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
        now_iso = datetime.now(timezone.utc).isoformat()
        digitizer_identity = _resolve_user_identity(user_id)
        existing_f_meta = folio.get("metadata") if isinstance(folio.get("metadata"), dict) else {}
        merged_folio_meta = {
            **existing_f_meta,
            **(request.metadata if isinstance(request.metadata, dict) else {}),
            "digitized_by": digitizer_identity,
            "digitized_at": now_iso,
        }
        if request.status == "completed":
            merged_folio_meta["priority_returned"] = False

        update_data = {
            "metadata": merged_folio_meta,
            "status": request.status,
            "locked_at": None
        }
        if request.status == "completed":
            update_data["verified_at"] = now_iso
            
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
                if (f.get("batches") and f["batches"].get("uploaded_by") == user_id)
                or (isinstance(f.get("metadata"), dict) and bool(f["metadata"].get("escalated_to_archivist")))
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
    metadata: Optional[Dict[str, Any]] = None
    status: Optional[str] = None
    folio_id: Optional[str] = None

class UpdateRecordStatusRequest(BaseModel):
    status: str  # 'verified', 'completed', 'revision', 'pending', 'in_progress'
    folio_id: Optional[str] = None
    notes: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

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

def _infer_series_from_text(text: str) -> Optional[str]:
    t = (text or "").lower()
    if "bautis" in t:
        return "bautismo"
    if "matrim" in t or "casam" in t:
        return "matrimonio"
    if "defunc" in t or "entierro" in t or "muert" in t or "obit" in t:
        return "defuncion"
    if "sin clasificar" in t or "unclassified" in t:
        return "unclassified"
    return None

def _resolve_folder_series_and_tome(folder_id: Optional[str], folder_map: Dict[str, Dict[str, Any]], fallback_meta: Optional[Dict[str, Any]] = None) -> tuple[str, str, bool]:
    """
    Devuelve (tome_name, series_key, is_unclassified) para un folder_id dado.
    series_key in ('bautismo', 'matrimonio', 'defuncion', 'unclassified')
    """
    f_meta = fallback_meta or {}
    if not folder_id or str(folder_id) not in folder_map:
        meta_series = _infer_series_from_text(str(f_meta.get("series") or f_meta.get("sacrament_type") or f_meta.get("entry_type") or ""))
        return "Sin Clasificar", (meta_series or "unclassified"), True

    folder = folder_map[str(folder_id)]
    folder_meta = folder.get("metadata") or {}
    folder_name = str(folder.get("name") or "Sin Clasificar")

    if bool(folder_meta.get("is_virtual_unclassified")) or folder_name.strip().lower() in ("sin clasificar", "unclassified"):
        return "Sin Clasificar", "unclassified", True

    # Determinar series_key revisando metadata propia, nombre propio o carpeta padre
    raw_series = str(folder_meta.get("sacrament_type") or folder_meta.get("series") or "").strip().lower()
    series_key = _infer_series_from_text(raw_series)
    if not series_key:
        series_key = _infer_series_from_text(folder_name)

    parent_id = folder.get("parent_id")
    visited = set()
    while not series_key and parent_id and str(parent_id) in folder_map and str(parent_id) not in visited:
        visited.add(str(parent_id))
        parent = folder_map[str(parent_id)]
        p_meta = parent.get("metadata") or {}
        p_raw = str(p_meta.get("sacrament_type") or p_meta.get("series") or "").strip().lower()
        series_key = _infer_series_from_text(p_raw) or _infer_series_from_text(str(parent.get("name") or ""))
        parent_id = parent.get("parent_id")

    if not series_key:
        series_key = _infer_series_from_text(str(f_meta.get("series") or f_meta.get("sacrament_type") or f_meta.get("entry_type") or "")) or "bautismo"

    return folder_name, series_key, False

def _normalize_record_status(raw_status: Optional[str]) -> str:
    st = str(raw_status or "pending").strip().lower()
    if st == "processing":
        return "in_progress"
    if st in ("doubtful", "dudoso", "error"):
        return "revision"
    if st in ("completed", "verified", "pending", "revision", "in_progress"):
        return st
    return "pending"

def _extract_entry_fields(raw_meta: Dict[str, Any], f_meta: Dict[str, Any], row_status: str, is_blank: bool) -> tuple[str, str, str, str, Dict[str, Any]]:
    meta = raw_meta.get("data") if isinstance(raw_meta.get("data"), dict) and len(raw_meta.get("data")) > 0 else raw_meta
    if not isinstance(meta, dict):
        meta = {}
    f_data = f_meta.get("data") if isinstance(f_meta.get("data"), dict) and len(f_meta.get("data")) > 0 else f_meta
    if not isinstance(f_data, dict):
        f_data = {}

    combined_meta = {**f_meta, **f_data, **raw_meta, **meta}

    first_name = str(
        combined_meta.get("first_name") or
        combined_meta.get("primer_nombre") or
        combined_meta.get("nombres") or
        combined_meta.get("nombre") or
        combined_meta.get("difunto_nombres") or
        ""
    ).strip()
    last_name = str(
        combined_meta.get("last_name") or
        combined_meta.get("apellidos") or
        combined_meta.get("apellido") or
        combined_meta.get("difunto_apellidos") or
        ""
    ).strip()

    full_name = f"{first_name} {last_name}".strip()
    if not full_name:
        full_name = str(
            combined_meta.get("bautizado") or
            combined_meta.get("nombre_completo") or
            combined_meta.get("nombre_bautizado") or
            combined_meta.get("difunto") or
            combined_meta.get("nombre_difunto") or
            combined_meta.get("principal_person") or
            combined_meta.get("person_name") or
            ""
        ).strip()
    if not full_name and (
        combined_meta.get("novio_nombres") or
        combined_meta.get("novia_nombres") or
        combined_meta.get("contrayente_1") or
        combined_meta.get("contrayente_2") or
        combined_meta.get("esposo_nombre") or
        combined_meta.get("esposa_nombre")
    ):
        novio = (
            f"{combined_meta.get('novio_nombres', '')} {combined_meta.get('novio_apellidos', '')}".strip() or
            str(combined_meta.get("contrayente_1") or combined_meta.get("esposo_nombre") or "").strip()
        )
        novia = (
            f"{combined_meta.get('novia_nombres', '')} {combined_meta.get('novia_apellidos', '')}".strip() or
            str(combined_meta.get("contrayente_2") or combined_meta.get("esposa_nombre") or "").strip()
        )
        full_name = f"{novio} y {novia}".strip(" y ")

    if is_blank and not full_name:
        principal_person = "📄 Folio en Blanco / Sin Partidas"
    elif full_name:
        principal_person = full_name
    elif row_status in ("pending", "in_progress"):
        principal_person = "⏳ Pendiente de transcripción"
    else:
        principal_person = "Sin titular registrado"

    event_date = str(
        combined_meta.get("event_date") or
        combined_meta.get("fecha_sacramento") or
        combined_meta.get("fecha_matrimonio") or
        combined_meta.get("fecha_defuncion") or
        combined_meta.get("fecha_entierro") or
        combined_meta.get("fecha_bautismo") or
        combined_meta.get("fecha_acta") or
        combined_meta.get("fecha") or
        ""
    ).strip()

    birth_date = str(
        combined_meta.get("birth_date") or
        combined_meta.get("fecha_nacimiento") or
        ""
    ).strip()

    record_type = str(
        raw_meta.get("entry_type") or
        combined_meta.get("record_type") or
        combined_meta.get("tipo_acta") or
        combined_meta.get("sacrament_type") or
        "Partida"
    ).strip().capitalize()

    return principal_person, event_date, birth_date, record_type, combined_meta


@app.get("/api/v1/records")
async def get_records(
    series: Optional[str] = None,
    folder_id: Optional[str] = None,
    status: Optional[str] = "all",
    batch_id: Optional[str] = None,
    search: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    limit: Optional[int] = None,
    auth: Dict[str, Any] = Depends(get_auth_context)
):
    if auth.get("role") == "digitizer":
        raise HTTPException(status_code=403, detail="Permiso denegado: rol no autorizado para consultar registros")
    try:
        tenant_id = auth.get("tenant_id")
        eff_limit = max(1, min(limit if limit is not None else page_size, 100))
        page = max(1, page)

        if not tenant_id:
            return {
                "status": "success",
                "data": [],
                "counts": {
                    "total": 0,
                    "completed": 0,
                    "verified": 0,
                    "pending": 0,
                    "revision": 0,
                    "in_progress": 0,
                },
                "total": 0,
                "total_records": 0,
                "page": page,
                "page_size": eff_limit,
                "total_pages": 1
            }

        # Paso A — Cargar carpetas/tomos del tenant (document_folders)
        folders = []
        try:
            f_res = supabase.table("document_folders").select("id, name, parent_id, folder_type, metadata").eq("tenant_id", tenant_id).execute()
            folders = f_res.data or []
        except Exception as e_folders:
            print(f"Notice querying document_folders in get_records: {e_folders}")
            folders = []

        folder_map: Dict[str, Dict[str, Any]] = {str(f["id"]): f for f in folders if f.get("id")}

        # Paso B — Cargar folios del tenant (folios)
        all_folios = []
        try:
            folios_query = supabase.table("folios").select(
                "id, folder_id, batch_id, status, metadata, r2_url, original_filename, canonical_filename, sequence_order, created_at, verified_at, updated_at"
            ).eq("tenant_id", tenant_id)
            if batch_id:
                folios_query = folios_query.eq("batch_id", batch_id)
            folios_res = folios_query.execute()
            all_folios = folios_res.data or []
        except Exception as e_folios:
            print(f"Notice querying folios in get_records: {e_folios}")
            all_folios = []

        norm_series = (series or "").strip().lower()
        norm_folder_id = (folder_id or "").strip()

        filtered_folios = []
        for f in all_folios:
            f_folder_id = str(f.get("folder_id")) if f.get("folder_id") is not None else None
            f_meta = f.get("metadata") or {}
            tome_name, series_key, is_unclassified = _resolve_folder_series_and_tome(f_folder_id, folder_map, f_meta)

            # Filtrar por folder_id
            if norm_folder_id and norm_folder_id.lower() not in ("all", "todos"):
                if norm_folder_id.lower() == "unclassified":
                    if not is_unclassified:
                        continue
                else:
                    if f_folder_id != norm_folder_id:
                        continue

            # Filtrar por series
            if norm_series and norm_series not in ("all", "todos"):
                if norm_series == "unclassified":
                    if not is_unclassified:
                        continue
                elif norm_series in ("bautismo", "matrimonio", "defuncion"):
                    f_meta_series = _infer_series_from_text(str(f_meta.get("series") or f_meta.get("sacrament_type") or ""))
                    if series_key != norm_series and f_meta_series != norm_series:
                        continue

            f["_resolved_tome_name"] = tome_name
            f["_resolved_series_key"] = series_key
            filtered_folios.append(f)

        # Paso C — Cargar todas las partidas (folio_entries) del tenant
        all_entries = []
        try:
            entries_res = supabase.table("folio_entries").select("*").eq("tenant_id", tenant_id).execute()
            all_entries = entries_res.data or []
        except Exception as e_entries:
            print(f"Notice querying folio_entries in get_records: {e_entries}")
            all_entries = []

        entries_by_folio: Dict[str, List[Dict[str, Any]]] = {}
        for entry in all_entries:
            fid = str(entry.get("folio_id") or "")
            if not fid:
                continue
            entries_by_folio.setdefault(fid, []).append(entry)

        for fid in entries_by_folio:
            entries_by_folio[fid].sort(key=lambda x: int(x.get("entry_number") or 1))

        # Paso D — Construir lista unificada de filas (unified_rows)
        unified_rows: List[Dict[str, Any]] = []
        for f in filtered_folios:
            fid = str(f["id"])
            f_entries = entries_by_folio.get(fid, [])
            total_entries_in_folio = len(f_entries)
            f_meta = f.get("metadata") or {}
            if not isinstance(f_meta, dict):
                f_meta = {}
            f_data_inner = f_meta.get("data") if isinstance(f_meta.get("data"), dict) else {}
            folio_is_blank = bool(f_meta.get("is_blank", False) or f_data_inner.get("is_blank", False))
            tome_name = f.get("_resolved_tome_name") or "Sin Clasificar"
            series_key = f.get("_resolved_series_key") or "unclassified"
            c_filename = f.get("canonical_filename") or f.get("original_filename") or f"folio_{fid}.jpg"

            if total_entries_in_folio > 0:
                for entry in f_entries:
                    raw_meta = entry.get("metadata") or {}
                    if not isinstance(raw_meta, dict):
                        raw_meta = {}
                    e_data_inner = raw_meta.get("data") if isinstance(raw_meta.get("data"), dict) else {}
                    row_status = _normalize_record_status(entry.get("status") or f.get("status") or "pending")
                    entry_is_blank = bool(
                        folio_is_blank or
                        raw_meta.get("is_blank", False) or
                        e_data_inner.get("is_blank", False)
                    )
                    principal_person, event_date, birth_date, record_type, combined_meta = _extract_entry_fields(
                        raw_meta, f_meta, row_status, entry_is_blank
                    )
                    if entry_is_blank:
                        combined_meta["is_blank"] = True

                    folio_num = (
                        entry.get("folio_number")
                        if entry.get("folio_number") is not None
                        else (f_meta.get("folio_number") or f.get("sequence_order") or 1)
                    )
                    folio_side = str(entry.get("folio_side") or f_meta.get("folio_side") or "recto").lower()
                    act_num = (
                        entry.get("act_number") or
                        combined_meta.get("numero_acta") or
                        combined_meta.get("act_number") or
                        ("—" if row_status == "pending" else "S/N")
                    )

                    unified_rows.append({
                        "id": entry.get("id"),
                        "entry_id": entry.get("id"),
                        "folio_id": fid,
                        "is_virtual_folio_row": False,
                        "entry_number": int(entry.get("entry_number") or 1),
                        "total_entries_in_folio": total_entries_in_folio,
                        "folio_number": folio_num,
                        "folio_side": folio_side,
                        "act_number": str(act_num),
                        "status": row_status,
                        "is_continued": bool(entry.get("is_continued", False)),
                        "continued_from_entry_id": entry.get("continued_from_entry_id"),
                        "is_blank": entry_is_blank,
                        "metadata": combined_meta,
                        "principal_person": principal_person,
                        "person_name": principal_person,
                        "event_date": event_date,
                        "birth_date": birth_date,
                        "record_type": record_type,
                        "folder_id": f.get("folder_id"),
                        "tome_name": tome_name,
                        "series": series_key,
                        "batch_id": f.get("batch_id"),
                        "canonical_filename": c_filename,
                        "file_name": c_filename,
                        "r2_url": f.get("r2_url"),
                        "sequence_order": f.get("sequence_order") or 1,
                        "created_at": entry.get("created_at") or f.get("created_at"),
                        "verified_at": f.get("verified_at") or entry.get("updated_at") or entry.get("created_at"),
                        "review_notes": f_meta.get("review_notes") or combined_meta.get("review_notes") or "",
                        "escalated_to_archivist": bool(f_meta.get("escalated_to_archivist") or combined_meta.get("escalated_to_archivist")),
                        "escalated_by": f_meta.get("escalated_by") or combined_meta.get("escalated_by"),
                        "digitized_by": f_meta.get("digitized_by") or combined_meta.get("digitized_by"),
                        "verified_by": f_meta.get("verified_by") or combined_meta.get("verified_by"),
                    })
            else:
                row_status = _normalize_record_status(f.get("status") or "pending")
                principal_person, event_date, birth_date, record_type, combined_meta = _extract_entry_fields(
                    f_meta, f_meta, row_status, folio_is_blank
                )
                if folio_is_blank:
                    combined_meta["is_blank"] = True

                folio_num = f_meta.get("folio_number") or f.get("sequence_order") or 1
                folio_side = str(f_meta.get("folio_side") or "recto").lower()
                act_num = (
                    combined_meta.get("numero_acta") or
                    combined_meta.get("act_number") or
                    ("—" if row_status == "pending" else "S/N")
                )

                unified_rows.append({
                    "id": fid,
                    "entry_id": None,
                    "folio_id": fid,
                    "is_virtual_folio_row": True,
                    "entry_number": 1,
                    "total_entries_in_folio": 1,
                    "folio_number": folio_num,
                    "folio_side": folio_side,
                    "act_number": str(act_num),
                    "status": row_status,
                    "is_continued": False,
                    "continued_from_entry_id": None,
                    "is_blank": folio_is_blank,
                    "metadata": combined_meta,
                    "principal_person": principal_person,
                    "person_name": principal_person,
                    "event_date": event_date,
                    "birth_date": birth_date,
                    "record_type": record_type,
                    "folder_id": f.get("folder_id"),
                    "tome_name": tome_name,
                    "series": series_key,
                    "batch_id": f.get("batch_id"),
                    "canonical_filename": c_filename,
                    "file_name": c_filename,
                    "r2_url": f.get("r2_url"),
                    "sequence_order": f.get("sequence_order") or 1,
                    "created_at": f.get("created_at"),
                    "verified_at": f.get("verified_at") or f.get("updated_at") or f.get("created_at"),
                    "review_notes": f_meta.get("review_notes") or combined_meta.get("review_notes") or "",
                    "escalated_to_archivist": bool(f_meta.get("escalated_to_archivist") or combined_meta.get("escalated_to_archivist")),
                    "escalated_by": f_meta.get("escalated_by") or combined_meta.get("escalated_by"),
                    "digitized_by": f_meta.get("digitized_by") or combined_meta.get("digitized_by"),
                    "verified_by": f_meta.get("verified_by") or combined_meta.get("verified_by"),
                })

        # Paso E — Filtrar por Búsqueda Multicriterio (search) y Fechas Históricas (start_date, end_date)
        filtered_rows = unified_rows
        if search and search.strip():
            s_term = search.strip().lower()

            def _matches_search(row: Dict[str, Any]) -> bool:
                f_num = row.get("folio_number") or 1
                side_char = "v" if str(row.get("folio_side") or "").lower().startswith("v") else "r"
                folio_label_1 = f"f.{f_num}{side_char}"
                folio_label_2 = f"f{f_num}{side_char}"
                folio_label_3 = f"f.{f_num}"
                folio_label_4 = f"folio {f_num}"

                searchable_fields = [
                    str(row.get("principal_person") or ""),
                    str(row.get("act_number") or ""),
                    f"acta {row.get('act_number') or ''}",
                    folio_label_1,
                    folio_label_2,
                    folio_label_3,
                    folio_label_4,
                    str(row.get("canonical_filename") or ""),
                    str(row.get("tome_name") or ""),
                ]
                for val in searchable_fields:
                    if s_term in val.lower():
                        return True

                meta_obj = row.get("metadata") or {}
                if isinstance(meta_obj, dict):
                    for k, v in meta_obj.items():
                        if isinstance(v, (str, int, float)) and s_term in str(v).lower():
                            return True
                        elif isinstance(v, dict):
                            for sub_v in v.values():
                                if isinstance(sub_v, (str, int, float)) and s_term in str(sub_v).lower():
                                    return True
                return False

            filtered_rows = [r for r in filtered_rows if _matches_search(r)]

        if start_date and start_date.strip():
            s_date = start_date.strip()[:10]
            def _matches_start_date(row: Dict[str, Any]) -> bool:
                ev = str(row.get("event_date") or "").strip()[:10]
                if len(ev) == 10 and ev[4:5] == "-" and ev[7:8] == "-":
                    return ev >= s_date
                return False
            filtered_rows = [r for r in filtered_rows if _matches_start_date(r)]

        if end_date and end_date.strip():
            e_date = end_date.strip()[:10]
            def _matches_end_date(row: Dict[str, Any]) -> bool:
                ev = str(row.get("event_date") or "").strip()[:10]
                if len(ev) == 10 and ev[4:5] == "-" and ev[7:8] == "-":
                    return ev <= e_date
                return False
            filtered_rows = [r for r in filtered_rows if _matches_end_date(r)]

        # Paso F — Calcular Contadores en Vivo (counts) ANTES de filtrar por status
        counts = {
            "total": len(filtered_rows),
            "completed": sum(1 for r in filtered_rows if r["status"] == "completed"),
            "verified": sum(1 for r in filtered_rows if r["status"] == "verified"),
            "pending": sum(1 for r in filtered_rows if r["status"] == "pending"),
            "revision": sum(1 for r in filtered_rows if r["status"] == "revision"),
            "in_progress": sum(1 for r in filtered_rows if r["status"] in ("in_progress", "processing")),
        }

        # Paso G — Aplicar Filtro de status
        status_filtered_rows = filtered_rows
        if status and status.strip().lower() not in ("all", "todos", ""):
            st_filter = status.strip().lower()
            if st_filter == "in_progress":
                status_filtered_rows = [r for r in filtered_rows if r["status"] in ("in_progress", "processing")]
            else:
                status_filtered_rows = [r for r in filtered_rows if r["status"] == st_filter]

        # Paso H — Ordenamiento Archivístico Natural y Paginación
        def _archival_sort_key(r: Dict[str, Any]):
            tome_str = str(r.get("tome_name") or "")
            try:
                f_num_int = int(r.get("folio_number") or 9999)
            except (ValueError, TypeError):
                f_num_int = 9999
            f_side_str = str(r.get("folio_side") or "").lower()
            side_order = 0 if f_side_str in ("recto", "r") else (1 if f_side_str in ("vuelto", "v") else 2)
            try:
                entry_num_int = int(r.get("entry_number") or 1)
            except (ValueError, TypeError):
                entry_num_int = 1
            return (tome_str, f_num_int, side_order, entry_num_int)

        status_filtered_rows.sort(key=_archival_sort_key)

        total_count = len(status_filtered_rows)
        total_pages = max(1, (total_count + eff_limit - 1) // eff_limit) if total_count > 0 else 1
        offset = max(0, (page - 1) * eff_limit)
        paginated_rows = status_filtered_rows[offset : offset + eff_limit]

        return {
            "status": "success",
            "data": paginated_rows,
            "counts": counts,
            "total": total_count,
            "total_records": total_count,
            "page": page,
            "page_size": eff_limit,
            "total_pages": total_pages
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"Error in get_records: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/api/v1/records/{record_id}/status")
async def update_record_status(
    record_id: str,
    request: UpdateRecordStatusRequest,
    auth: Dict[str, Any] = Depends(get_auth_context)
):
    try:
        role = auth.get("role")
        if role == "digitizer":
            raise HTTPException(status_code=403, detail="Permiso denegado: rol no autorizado para arbitraje de estado")

        tenant_id = auth["tenant_id"]
        caller_id = auth["user_id"]
        caller_identity = _resolve_user_identity(caller_id)

        target_status = (request.status or "").strip().lower()
        if target_status not in ("verified", "completed", "revision", "pending", "in_progress"):
            raise HTTPException(status_code=400, detail=f"Estado no válido: {request.status}")

        now_iso = datetime.now(timezone.utc).isoformat()

        # 1. Intentar localizar primero en folio_entries
        entry_res = None
        try:
            entry_res = supabase.table("folio_entries").select("*").eq("id", record_id).eq("tenant_id", tenant_id).execute()
        except Exception as e_err:
            print(f"Notice checking folio_entries in update_record_status: {e_err}")

        if entry_res and entry_res.data:
            entry = entry_res.data[0]
            parent_folio_id = str(entry.get("folio_id") or request.folio_id or "")

            entry_update: Dict[str, Any] = {
                "status": target_status,
                "updated_at": now_iso
            }
            existing_meta = dict(entry.get("metadata") or {}) if isinstance(entry.get("metadata"), dict) else {}
            if request.metadata is not None and isinstance(request.metadata, dict):
                if isinstance(existing_meta.get("data"), dict):
                    existing_meta = {**existing_meta, "data": {**existing_meta["data"], **request.metadata}}
                else:
                    existing_meta = {**existing_meta, **request.metadata}

            if request.notes is not None and request.notes.strip():
                existing_meta["review_notes"] = request.notes.strip()
            if target_status == "revision" and role == "evaluator":
                existing_meta["escalated_to_archivist"] = True
                existing_meta["escalated_by"] = caller_identity
                existing_meta["escalated_at"] = now_iso
            elif target_status == "verified":
                existing_meta["verified_by"] = caller_identity
                existing_meta["verified_at"] = now_iso
                existing_meta["escalated_to_archivist"] = False

            entry_update["metadata"] = existing_meta

            supabase.table("folio_entries").update(entry_update).eq("id", record_id).eq("tenant_id", tenant_id).execute()

            if parent_folio_id:
                parent_f_res = supabase.table("folios").select("metadata").eq("id", parent_folio_id).eq("tenant_id", tenant_id).execute()
                parent_f_meta = dict(parent_f_res.data[0].get("metadata") or {}) if (parent_f_res.data and isinstance(parent_f_res.data[0].get("metadata"), dict)) else {}
                if request.notes is not None and request.notes.strip():
                    parent_f_meta["review_notes"] = request.notes.strip()
                if target_status == "revision" and role == "evaluator":
                    parent_f_meta["escalated_to_archivist"] = True
                    parent_f_meta["escalated_by"] = caller_identity
                    parent_f_meta["escalated_at"] = now_iso
                elif target_status == "verified":
                    parent_f_meta["verified_by"] = caller_identity
                    parent_f_meta["verified_at"] = now_iso
                    parent_f_meta["escalated_to_archivist"] = False

                folio_update: Dict[str, Any] = {
                    "status": target_status,
                    "updated_at": now_iso,
                    "metadata": parent_f_meta,
                }
                if target_status == "verified":
                    folio_update["verified_at"] = now_iso
                elif target_status in ("revision", "pending"):
                    folio_update["locked_at"] = None

                try:
                    supabase.table("folios").update({**folio_update, "last_modified_by": caller_id}).eq("id", parent_folio_id).eq("tenant_id", tenant_id).execute()
                except Exception:
                    supabase.table("folios").update(folio_update).eq("id", parent_folio_id).eq("tenant_id", tenant_id).execute()

            return {
                "status": "success",
                "new_status": target_status,
                "verified_at": now_iso if target_status == "verified" else None
            }

        # 2. Si no es un entry_id, actualizar directamente el folio en folios
        target_folio_id = request.folio_id or record_id
        folio_res = supabase.table("folios").select("*").eq("id", target_folio_id).eq("tenant_id", tenant_id).execute()
        if not folio_res.data:
            raise HTTPException(status_code=404, detail="Registro o folio no encontrado")

        existing_folio_meta = dict(folio_res.data[0].get("metadata") or {}) if isinstance(folio_res.data[0].get("metadata"), dict) else {}
        if request.metadata is not None and isinstance(request.metadata, dict):
            existing_folio_meta = {**existing_folio_meta, **request.metadata}
        if request.notes is not None and request.notes.strip():
            existing_folio_meta["review_notes"] = request.notes.strip()
        if target_status == "revision" and role == "evaluator":
            existing_folio_meta["escalated_to_archivist"] = True
            existing_folio_meta["escalated_by"] = caller_identity
            existing_folio_meta["escalated_at"] = now_iso
        elif target_status == "verified":
            existing_folio_meta["verified_by"] = caller_identity
            existing_folio_meta["verified_at"] = now_iso
            existing_folio_meta["escalated_to_archivist"] = False

        folio_update_data: Dict[str, Any] = {
            "status": target_status,
            "updated_at": now_iso,
            "metadata": existing_folio_meta,
        }
        if target_status == "verified":
            folio_update_data["verified_at"] = now_iso
        elif target_status in ("revision", "pending"):
            folio_update_data["locked_at"] = None

        try:
            supabase.table("folios").update({**folio_update_data, "last_modified_by": caller_id}).eq("id", target_folio_id).eq("tenant_id", tenant_id).execute()
        except Exception:
            supabase.table("folios").update(folio_update_data).eq("id", target_folio_id).eq("tenant_id", tenant_id).execute()

        # Sincronizar también entradas asociadas en folio_entries si existen
        try:
            supabase.table("folio_entries").update({
                "status": target_status,
                "updated_at": now_iso
            }).eq("folio_id", target_folio_id).eq("tenant_id", tenant_id).execute()
        except Exception as sync_err:
            print(f"Notice syncing folio_entries status: {sync_err}")

        return {
            "status": "success",
            "new_status": target_status,
            "verified_at": now_iso if target_status == "verified" else None
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"Error in update_record_status: {str(e)}")
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

        now_iso = datetime.now(timezone.utc).isoformat()

        # 1. Verificar si folio_id corresponde primero a una partida en folio_entries
        entry_res = None
        try:
            entry_res = supabase.table("folio_entries").select("*").eq("id", folio_id).eq("tenant_id", tenant_id).execute()
        except Exception:
            entry_res = None

        if entry_res and entry_res.data:
            entry = entry_res.data[0]
            parent_folio_id = str(entry.get("folio_id") or request.folio_id or "")

            existing_meta = entry.get("metadata") or {}
            new_meta = request.metadata if request.metadata is not None else existing_meta
            if isinstance(existing_meta, dict) and isinstance(existing_meta.get("data"), dict) and isinstance(new_meta, dict) and "data" not in new_meta:
                updated_entry_meta = {**existing_meta, **new_meta, "data": {**existing_meta["data"], **new_meta}}
            else:
                updated_entry_meta = new_meta

            entry_update_payload: Dict[str, Any] = {
                "metadata": updated_entry_meta,
                "updated_at": now_iso
            }
            if request.status:
                entry_update_payload["status"] = request.status

            e_upd = supabase.table("folio_entries").update(entry_update_payload).eq("id", folio_id).eq("tenant_id", tenant_id).execute()

            if parent_folio_id:
                parent_update: Dict[str, Any] = {
                    "metadata": new_meta,
                    "updated_at": now_iso
                }
                if request.status:
                    parent_update["status"] = request.status
                    if request.status == "verified":
                        parent_update["verified_at"] = now_iso
                try:
                    supabase.table("folios").update({**parent_update, "last_modified_by": caller_id}).eq("id", parent_folio_id).eq("tenant_id", tenant_id).execute()
                except Exception:
                    supabase.table("folios").update(parent_update).eq("id", parent_folio_id).eq("tenant_id", tenant_id).execute()

            return {"status": "success", "data": (e_upd.data[0] if e_upd and e_upd.data else entry_update_payload)}

        # 2. Flujo estándar sobre la tabla folios
        folio_res = user_client.table("folios").select("*, batches(uploaded_by)").eq("id", folio_id).eq("tenant_id", tenant_id).execute()
        if not folio_res.data:
            raise HTTPException(status_code=404, detail="Folio no encontrado")

        folio = folio_res.data[0]
        batch_rel = folio.get("batches") or {}
        batch_uploader = batch_rel.get("uploaded_by") if isinstance(batch_rel, dict) else None

        if role == "archivist" and batch_uploader and batch_uploader != caller_id:
            raise HTTPException(status_code=403, detail="Permiso denegado: solo puedes editar registros de lotes que subiste")

        if folio.get("status") == "in_progress" and not request.status:
            raise HTTPException(status_code=409, detail="El documento está siendo indexado en este momento")

        update_data: Dict[str, Any] = {
            "updated_at": now_iso
        }
        if request.metadata is not None:
            update_data["metadata"] = request.metadata
        if request.status:
            update_data["status"] = request.status
            if request.status == "verified":
                update_data["verified_at"] = now_iso

        try:
            res = user_client.table("folios").update({**update_data, "last_modified_by": caller_id}).eq("id", folio_id).eq("tenant_id", tenant_id).execute()
        except Exception:
            res = user_client.table("folios").update(update_data).eq("id", folio_id).eq("tenant_id", tenant_id).execute()

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

        # Primero verificar si es una partida individual en folio_entries
        try:
            entry_check = supabase.table("folio_entries").select("id, folio_id").eq("id", folio_id).eq("tenant_id", tenant_id).execute()
            if entry_check and entry_check.data:
                supabase.table("folio_entries").delete().eq("id", folio_id).eq("tenant_id", tenant_id).execute()
                return {
                    "status": "success",
                    "message": "Partida eliminada exitosamente",
                    "id": folio_id
                }
        except Exception:
            pass

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
            if uploaded_by and uploaded_by != caller_id:
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
    series: Optional[str] = None,
    folder_id: Optional[str] = None,
    status: Optional[str] = "all",
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

        query = supabase.table("folios").select("*, batches(id, template_id, uploaded_by)").eq("tenant_id", tenant_id)
        if status and status.strip().lower() not in ("all", "todos", ""):
            query = query.eq("status", status.strip().lower())
        if folder_id and folder_id.strip().lower() not in ("all", "todos", "", "unclassified"):
            query = query.eq("folder_id", folder_id.strip())
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
            f_status = folio.get("status", "")

            row = [
                folio.get("id", ""),
                file_name,
                batch_name,
                verified_formatted,
                f_status
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
                "folio_number": folio.get("sequence_order") or 1,
                "folio_side": "recto",
                "act_number": None,
                "is_continued": False,
                "continued_from_entry_id": None,
                "status": folio.get("status") or "pending",
                "metadata": existing_meta,
                "bounding_box": None
            }]
        else:
            entries = [{
                "id": f"synthetic-{folio_id}-1",
                "folio_id": folio_id,
                "entry_number": 1,
                "folio_number": folio.get("sequence_order") or 1,
                "folio_side": "recto",
                "act_number": None,
                "is_continued": False,
                "continued_from_entry_id": None,
                "status": "pending",
                "metadata": {},
                "bounding_box": None
            }]

    # T02-BE-01: Obtener última foliación usada en el tomo para facilitar sugerencia de siguiente cara
    last_foliation = {
        "folio_number": None,
        "folio_side": "recto",
        "act_number": None
    }
    try:
        if folder_id:
            tome_folios = client.table("folios").select("id").eq("folder_id", folder_id).execute()
            t_fids = [f["id"] for f in (tome_folios.data or [])]
            if t_fids:
                latest_entry_res = client.table("folio_entries")\
                    .select("folio_number, folio_side, act_number, created_at")\
                    .in_("folio_id", t_fids)\
                    .eq("tenant_id", tenant_id)\
                    .order("created_at", desc=True)\
                    .limit(1)\
                    .execute()
                if latest_entry_res.data and len(latest_entry_res.data) > 0:
                    le = latest_entry_res.data[0]
                    last_foliation = {
                        "folio_number": le.get("folio_number"),
                        "folio_side": le.get("folio_side") or "recto",
                        "act_number": le.get("act_number")
                    }
    except Exception as fol_err:
        print(f"Notice fetching last_foliation: {fol_err}")

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
        "last_foliation": last_foliation,
        "data": {
            "folio_id": folio_id,
            "entries": entries,
            "inherited_context": inherited_context,
            "inherited_tome_metadata": inherited_tome_metadata,
            "last_foliation": last_foliation
        }
    }


@app.post("/api/v1/folios/{folio_id}/entries")
@app.post("/api/v1/folios/{folio_id}/submit")
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

    folio_obj = folio_res.data[0]
    existing_f_meta = folio_obj.get("metadata") if isinstance(folio_obj.get("metadata"), dict) else {}

    saved_entries = []
    now_iso = datetime.now(timezone.utc).isoformat()
    digitizer_identity = _resolve_user_identity(user_id)

    for entry in request.entries:
        e_meta = dict(entry.metadata) if isinstance(entry.metadata, dict) else {}
        e_meta["digitized_by"] = digitizer_identity
        e_meta["digitized_at"] = now_iso
        e_meta["created_by"] = user_id

        entry_payload = {
            "tenant_id": tenant_id,
            "folio_id": folio_id,
            "entry_number": entry.entry_number,
            "status": entry.status or "pending",
            "metadata": e_meta,
            "bounding_box": entry.bounding_box,
            "folio_number": entry.folio_number,
            "folio_side": entry.folio_side or "recto",
            "act_number": entry.act_number,
            "is_continued": bool(entry.is_continued),
            "continued_from_entry_id": entry.continued_from_entry_id,
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
            ins = client.table("folio_entries").insert(entry_payload).execute()
            if ins.data:
                saved_entries.append(ins.data[0])
            else:
                saved_entries.append(entry_payload)

    first_entry_meta = dict(request.entries[0].metadata) if (request.entries and isinstance(request.entries[0].metadata, dict)) else {}
    merged_folio_meta = {
        **existing_f_meta,
        **first_entry_meta,
        "digitized_by": digitizer_identity,
        "digitized_at": now_iso,
    }

    if request.final_status == "completed":
        merged_folio_meta["priority_returned"] = False
        folio_update: Dict[str, Any] = {
            "status": "completed",
            "locked_at": None,
            "verified_at": now_iso,
            "metadata": merged_folio_meta,
        }
        client.table("folios").update(folio_update).eq("id", folio_id).eq("tenant_id", tenant_id).execute()
    elif request.final_status:
        client.table("folios").update({
            "status": request.final_status,
            "locked_at": None,
            "metadata": merged_folio_meta,
        }).eq("id", folio_id).eq("tenant_id", tenant_id).execute()
    else:
        client.table("folios").update({
            "metadata": merged_folio_meta,
        }).eq("id", folio_id).eq("tenant_id", tenant_id).execute()

    return {
        "status": "success",
        "message": f"{len(saved_entries)} partidas guardadas exitosamente",
        "data": saved_entries
    }


@app.put("/api/v1/folios/{folio_id}/entries/{entry_id}")
@app.patch("/api/v1/folios/{folio_id}/entries/{entry_id}")
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
        "updated_at": now_iso
    }
    if entry_in.metadata is not None:
        update_data["metadata"] = entry_in.metadata
    if entry_in.status is not None:
        update_data["status"] = entry_in.status
    if entry_in.bounding_box is not None:
        update_data["bounding_box"] = entry_in.bounding_box
    if entry_in.folio_number is not None:
        update_data["folio_number"] = entry_in.folio_number
    if entry_in.folio_side is not None:
        update_data["folio_side"] = entry_in.folio_side
    if entry_in.act_number is not None:
        update_data["act_number"] = entry_in.act_number
    if entry_in.is_continued is not None:
        update_data["is_continued"] = entry_in.is_continued
    if entry_in.continued_from_entry_id is not None:
        update_data["continued_from_entry_id"] = entry_in.continued_from_entry_id

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
    only_verified: bool = Query(False, description="Si es True, filtra estrictamente actas con status == 'verified'"),
    auth: Dict[str, Any] = Depends(get_auth_context)
):
    role = auth.get("role")
    client = auth.get("user_client") or supabase

    # 1. Obtener la carpeta (validar tenant_id según rol)
    if role == "superadmin":
        folder_res = client.table("document_folders").select("*").eq("id", folder_id).execute()
        if not folder_res.data:
            raise HTTPException(status_code=404, detail="Carpeta o tomo no encontrado")
        folder = folder_res.data[0]
        tenant_id = folder.get("tenant_id")
    else:
        tenant_id = auth.get("tenant_id")
        if not tenant_id:
            raise HTTPException(status_code=400, detail="tenant_id es requerido")
        folder_res = client.table("document_folders").select("*").eq("id", folder_id).eq("tenant_id", tenant_id).execute()
        if not folder_res.data:
            raise HTTPException(status_code=404, detail="Carpeta o tomo no encontrado")
        folder = folder_res.data[0]
    folder_name = folder.get("name", "Tomo")

    # 2. Obtener todos los folios asignados a esta carpeta
    folios_res = client.table("folios").select("id, folder_id, status, sequence_order, original_filename, canonical_filename").eq("folder_id", folder_id).eq("tenant_id", tenant_id).execute()
    folios = folios_res.data or []
    folio_ids = [f["id"] for f in folios]

    total_folios = len(folios)
    verified_folios = sum(1 for f in folios if (f.get("status") or "").lower() == "verified")
    total_entries = 0
    completed_entries = 0
    verified_entries = 0
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
                f_status = (f.get("status") or "pending").lower()
                if f_status == "verified":
                    verified_entries += 1
                    completed_entries += 1
                elif f_status == "completed":
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
            seen_verified_folios = set()
            for e in entries:
                e_status = (e.get("status") or "pending").lower()
                fid = e.get("folio_id")
                if e_status == "verified":
                    verified_entries += 1
                    completed_entries += 1
                    if fid:
                        seen_verified_folios.add(fid)
                elif e_status == "completed":
                    completed_entries += 1
                elif e_status in ("revision", "doubtful", "dudoso"):
                    revision_entries += 1
                    if fid and fid not in seen_doubtful_folios:
                        seen_doubtful_folios.add(fid)
                        doubtful_folios.append(folio_obj_map.get(fid, {"id": fid}))
                else:
                    pending_entries += 1
            if seen_verified_folios:
                verified_folios = max(verified_folios, len(seen_verified_folios))

    has_revisions = revision_entries > 0
    exportable_entries = verified_entries if only_verified else completed_entries

    # T02-BE-03: Resolver contexto geográfico y validar localidad mínima
    tome_context = _resolve_folder_inherited_context(client, folder_id, tenant_id)
    warnings: List[str] = []
    if not tome_context.get("country") or not tome_context.get("state"):
        warnings.append(
            "Aviso: El tomo no tiene localidad completa (País o Estado ausente). "
            "Se recomienda completarla para interoperabilidad óptima con FamilySearch."
        )

    if exportable_entries == 0:
        if only_verified:
            warnings.append("No se puede exportar el paquete con el filtro activo: el tomo aún no tiene actas Verificadas por Evaluador.")
        else:
            warnings.append("No se puede exportar el paquete: el tomo no tiene ninguna partida completada o verificada aún.")

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
            "verified_folios": verified_folios,
            "total_entries": total_entries,
            "completed_entries": exportable_entries,
            "all_completed_entries": completed_entries,
            "verified_entries": verified_entries,
            "completed_count": max(0, completed_entries - verified_entries),
            "verified_count": verified_entries,
            "revision_entries": revision_entries,
            "pending_entries": pending_entries,
            "has_revisions": has_revisions,
            "doubtful_folios_count": len(doubtful_folios),
            "only_verified": only_verified,
            "ready_for_export": exportable_entries > 0,
            "warnings": warnings,
            "tome_context": tome_context,
            "geographic_summary": geographic_summary
        }
    }


@app.get("/api/v1/folders/{folder_id}/export-familysearch")
async def export_familysearch_package(
    folder_id: str,
    include_images: bool = Query(False, description="Incluir archivos de fotos de alta resolución en subcarpeta images/"),
    only_verified: bool = Query(False, description="Si es True, exporta exclusivamente actas con status == 'verified'"),
    auth: Dict[str, Any] = Depends(get_auth_context)
):
    role = auth.get("role")
    client = auth.get("user_client") or supabase

    # 1. Obtener carpeta y contexto (validar tenant_id según rol)
    if role == "superadmin":
        folder_res = client.table("document_folders").select("*").eq("id", folder_id).execute()
        if not folder_res.data:
            raise HTTPException(status_code=404, detail="Carpeta o tomo no encontrado")
        folder = folder_res.data[0]
        tenant_id = folder.get("tenant_id")
    else:
        tenant_id = auth.get("tenant_id")
        if not tenant_id:
            raise HTTPException(status_code=400, detail="tenant_id es requerido")
        folder_res = client.table("document_folders").select("*").eq("id", folder_id).eq("tenant_id", tenant_id).execute()
        if not folder_res.data:
            raise HTTPException(status_code=404, detail="Carpeta o tomo no encontrado")
        folder = folder_res.data[0]
    tome_metadata = _resolve_folder_inherited_context(client, folder_id, tenant_id)
    tome_metadata["folder_name"] = folder.get("name", "Tomo")

    # 2. Folios del tomo
    folios_res = client.table("folios").select("*").eq("folder_id", folder_id).eq("tenant_id", tenant_id).order("sequence_order", desc=False).execute()
    folios = folios_res.data or []
    folio_ids = [f["id"] for f in folios]

    # Obtener el subdominio o nombre de la organización
    tenant_subdomain = ""
    try:
        tenant_res = supabase.table("tenants").select("name").eq("id", tenant_id).execute()
        if tenant_res.data and len(tenant_res.data) > 0:
            tenant_subdomain = tenant_res.data[0].get("subdomain") or tenant_res.data[0].get("name") or ""
    except Exception as t_err:
        print(f"Notice fetching tenant in export_familysearch: {t_err}")

    tome_name = folder.get("name", "Tomo")
    folder_meta = folder.get("metadata") or {}
    tome_number = folder_meta.get("tome_number") or folder_meta.get("number")

    allowed_statuses = ("verified",) if only_verified else ("completed", "verified")

    # 3. Partidas
    all_entries = []
    if folio_ids:
        entries_res = client.table("folio_entries").select("*").in_("folio_id", folio_ids).eq("tenant_id", tenant_id).order("entry_number").execute()
        all_entries = entries_res.data or []

    # Si no hay entradas en folio_entries, sintetizar a partir de metadata de folios
    if not all_entries and folios:
        for f in folios:
            f_status = (f.get("status") or "").lower()
            if f_status in allowed_statuses:
                all_entries.append({
                    "id": f"syn-{f['id']}",
                    "folio_id": f["id"],
                    "entry_number": 1,
                    "status": f_status,
                    "folio_number": f.get("sequence_order") or 1,
                    "folio_side": "recto",
                    "act_number": "S/N",
                    "is_continued": False,
                    "continued_from_entry_id": None,
                    "metadata": f.get("metadata") or {}
                })

    # T02-BE-02: Filtro estricto según only_verified
    completed_entries = [
        e for e in all_entries
        if (e.get("status") or "").lower() in allowed_statuses
    ]
    if len(completed_entries) == 0:
        raise HTTPException(
            status_code=400,
            detail=(
                "No se puede exportar el paquete: el tomo no tiene ninguna partida verificada por Evaluador aún."
                if only_verified
                else "No se puede exportar el paquete: el tomo no tiene ninguna partida completada o verificada aún."
            )
        )

    # Identificar folios que tienen al menos una partida exportable
    completed_folio_ids = set(str(e.get("folio_id")) for e in completed_entries if e.get("folio_id"))

    # T02-BE-03: Asegurar nombres canónicos para todos los folios incorporando foliación física y cara
    for idx, f in enumerate(folios, start=1):
        seq = f.get("sequence_order")
        if seq is None or seq <= 0:
            seq = idx
            f["sequence_order"] = seq

        # Buscar si el folio tiene partida completada con número y cara física
        f_entries = [e for e in completed_entries if str(e.get("folio_id")) == str(f["id"])]
        entry_f_num = None
        entry_f_side = None
        for fe in f_entries:
            if fe.get("folio_number"):
                entry_f_num = fe.get("folio_number")
                entry_f_side = fe.get("folio_side")
                break

        orig_ref = f.get("r2_url") or f.get("original_filename") or f.get("file_name")
        c_name = compute_canonical_filename(
            tenant_subdomain=tenant_subdomain,
            tome_name=tome_name,
            tome_number=tome_number,
            sequence_order=seq,
            original_filename_or_url=orig_ref,
            folio_number=entry_f_num,
            folio_side=entry_f_side
        )
        f["canonical_filename"] = c_name

        try:
            client.table("folios").update({
                "canonical_filename": c_name,
                "sequence_order": seq
            }).eq("id", f["id"]).eq("tenant_id", tenant_id).execute()
        except Exception as upd_err:
            print(f"Warning persisting canonical_filename for folio {f.get('id')}: {upd_err}")

    total_completed = len(completed_entries)
    total_revision = sum(1 for e in all_entries if (e.get("status") or "").lower() in ("revision", "doubtful", "dudoso"))
    total_tome_folios = len(folios)
    excluded_pending_folios = max(0, total_tome_folios - len(completed_folio_ids))
    quality_score = round((len(completed_entries) / max(1, len(all_entries))) * 100, 2) if all_entries else 100.0

    # 4. Generar componentes de datos pasando ÚNICAMENTE completed_entries
    excel_bytes, csv_bytes = generate_familysearch_matrix(completed_entries, folios, tome_metadata, only_verified=only_verified)
    gedcom_str = generate_gedcom_551(completed_entries, folios, tome_metadata, only_verified=only_verified)
    manifest_data = generate_manifest_json(
        folder=folder,
        folios=folios,
        entries=completed_entries,
        total_completed=total_completed,
        total_revision=total_revision,
        total_tome_folios=total_tome_folios,
        excluded_pending_folios=excluded_pending_folios,
        quality_score_percentage=quality_score,
        tome_metadata=tome_metadata
    )
    manifest_bytes = json.dumps(manifest_data, ensure_ascii=False, indent=2).encode("utf-8")

    # 5. Generar paquete ZIP con empaquetamiento selectivo de imágenes (T02-BE-03)
    zip_bio = io.BytesIO()
    with zipfile.ZipFile(zip_bio, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("manifest.json", manifest_bytes)
        zf.writestr("matriz_indexacion.xlsx", excel_bytes)
        zf.writestr("matriz_indexacion.csv", csv_bytes)
        zf.writestr("export_gedcom.ged", gedcom_str.encode("utf-8"))

        if include_images:
            bucket_name = os.getenv("R2_BUCKET_NAME")
            for f in folios:
                # Omitir imágenes de folios que solo tengan partidas pendientes o incompletas
                if str(f["id"]) not in completed_folio_ids:
                    continue

                canonical_name = f.get("canonical_filename") or f.get("original_filename") or f"folio_{f['id']}.jpg"
                r2_key = f.get("r2_url") or f.get("file_name") or f.get("original_filename")
                if bucket_name and r2_key:
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


# ==============================================================================
# SPEC-017: MESA DE ARBITRAJE DE CALIDAD (/api/v1/evaluation/...)
# ==============================================================================

class EvaluationNextRequest(BaseModel):
    queue_type: Optional[str] = "to_verify"  # "to_verify" (completed) | "doubtful" (revision)
    series: Optional[str] = None
    folder_id: Optional[str] = None
    specific_folio_id: Optional[str] = None


class EvaluationVerdictRequest(BaseModel):
    verdict: str  # "verify_entry" | "verify_all" | "return_to_digitizer" | "mark_doubtful"
    entry_id: Optional[str] = None
    entry_number: Optional[int] = None
    entries: Optional[List[FolioEntryCreate]] = None
    review_notes: Optional[str] = None


def _is_evaluation_locked_by_another(folio_meta: Dict[str, Any], current_user_id: Optional[str]) -> bool:
    if not isinstance(folio_meta, dict):
        return False
    locked_at_str = folio_meta.get("evaluation_locked_at")
    locked_by = folio_meta.get("evaluation_locked_by")
    if not locked_at_str or not locked_by:
        return False
    if current_user_id and str(locked_by) == str(current_user_id):
        return False
    try:
        clean_str = str(locked_at_str).replace("Z", "+00:00")
        dt = datetime.fromisoformat(clean_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        if (now - dt) < timedelta(minutes=15):
            return True
    except Exception:
        return False
    return False


@app.get("/api/v1/evaluation/queue")
async def get_evaluation_queue(
    queue_type: str = Query("to_verify", description="to_verify | doubtful | verified | all"),
    series: Optional[str] = None,
    folder_id: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    auth: Dict[str, Any] = Depends(get_auth_context)
):
    role = auth.get("role")
    if role not in ("evaluator", "archivist", "admin", "superadmin"):
        raise HTTPException(
            status_code=403,
            detail="Permiso denegado: se requiere rol Evaluador, Archivista o Administrador"
        )

    try:
        tenant_id = auth.get("tenant_id")
        eff_limit = max(1, min(page_size, 100))
        page = max(1, page)

        if not tenant_id:
            return {
                "status": "success",
                "items": [],
                "data": [],
                "counts": {
                    "to_verify": 0,
                    "doubtful": 0,
                    "escalated_to_archivist": 0,
                    "verified_today": 0,
                    "total_verified": 0,
                },
                "total": 0,
                "page": page,
                "page_size": eff_limit,
                "total_pages": 1,
            }

        # 1. Cargar carpetas del tenant
        folders = []
        try:
            f_res = supabase.table("document_folders").select("id, name, parent_id, folder_type, metadata").eq("tenant_id", tenant_id).execute()
            folders = f_res.data or []
        except Exception as e_folders:
            print(f"Notice querying document_folders in get_evaluation_queue: {e_folders}")

        folder_map: Dict[str, Dict[str, Any]] = {str(f["id"]): f for f in folders if f.get("id")}

        # 2. Cargar folios del tenant
        all_folios = []
        try:
            folios_res = supabase.table("folios").select(
                "id, folder_id, batch_id, status, metadata, r2_url, original_filename, canonical_filename, sequence_order, created_at, verified_at, updated_at"
            ).eq("tenant_id", tenant_id).execute()
            all_folios = folios_res.data or []
        except Exception as e_folios:
            print(f"Notice querying folios in get_evaluation_queue: {e_folios}")

        norm_series = (series or "").strip().lower()
        norm_folder_id = (folder_id or "").strip()

        filtered_folios = []
        for f in all_folios:
            f_folder_id = str(f.get("folder_id")) if f.get("folder_id") is not None else None
            f_meta = f.get("metadata") if isinstance(f.get("metadata"), dict) else {}
            tome_name, series_key, is_unclassified = _resolve_folder_series_and_tome(f_folder_id, folder_map, f_meta)

            if norm_folder_id and norm_folder_id.lower() not in ("all", "todos"):
                if norm_folder_id.lower() == "unclassified":
                    if not is_unclassified:
                        continue
                else:
                    if f_folder_id != norm_folder_id:
                        continue

            if norm_series and norm_series not in ("all", "todos"):
                if norm_series == "unclassified":
                    if not is_unclassified:
                        continue
                elif norm_series in ("bautismo", "matrimonio", "defuncion") or "baut" in norm_series or "matr" in norm_series or "defun" in norm_series:
                    target_s = _infer_series_from_text(norm_series) or norm_series
                    f_meta_series = _infer_series_from_text(str(f_meta.get("series") or f_meta.get("sacrament_type") or ""))
                    if series_key != target_s and f_meta_series != target_s:
                        continue

            f["_resolved_tome_name"] = tome_name
            f["_resolved_series_key"] = series_key
            filtered_folios.append(f)

        # 3. Cargar partidas (folio_entries) del tenant
        all_entries = []
        try:
            entries_res = supabase.table("folio_entries").select("*").eq("tenant_id", tenant_id).execute()
            all_entries = entries_res.data or []
        except Exception as e_entries:
            print(f"Notice querying folio_entries in get_evaluation_queue: {e_entries}")

        entries_by_folio: Dict[str, List[Dict[str, Any]]] = {}
        for entry in all_entries:
            fid = str(entry.get("folio_id") or "")
            if not fid:
                continue
            entries_by_folio.setdefault(fid, []).append(entry)

        for fid in entries_by_folio:
            entries_by_folio[fid].sort(key=lambda x: int(x.get("entry_number") or 1))

        # 4. Calcular contadores globales en vivo (counts)
        today_utc_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        to_verify_count = 0
        doubtful_count = 0
        escalated_count = 0
        verified_today_count = 0
        total_verified_count = 0

        for f in filtered_folios:
            f_status = _normalize_record_status(f.get("status"))
            f_meta = f.get("metadata") if isinstance(f.get("metadata"), dict) else {}
            if f_status == "completed":
                to_verify_count += 1
            elif f_status == "revision":
                doubtful_count += 1
                if bool(f_meta.get("escalated_to_archivist")):
                    escalated_count += 1
            elif f_status == "verified":
                total_verified_count += 1
                v_at = str(f.get("verified_at") or f_meta.get("verified_at") or "")
                if v_at.startswith(today_utc_str):
                    verified_today_count += 1

        counts = {
            "to_verify": to_verify_count,
            "doubtful": doubtful_count,
            "escalated_to_archivist": escalated_count,
            "verified_today": verified_today_count,
            "total_verified": total_verified_count,
        }

        # 5. Filtrar según queue_type
        q_type = (queue_type or "to_verify").strip().lower()
        queue_folios = []
        for f in filtered_folios:
            f_status = _normalize_record_status(f.get("status"))
            if q_type == "to_verify" and f_status == "completed":
                queue_folios.append(f)
            elif q_type == "doubtful" and f_status == "revision":
                queue_folios.append(f)
            elif q_type == "verified" and f_status == "verified":
                queue_folios.append(f)
            elif q_type == "all" and f_status in ("completed", "revision", "verified"):
                queue_folios.append(f)

        # 6. Enriquecer cada folio de la cola
        items: List[Dict[str, Any]] = []
        for f in queue_folios:
            fid = str(f["id"])
            f_meta = f.get("metadata") if isinstance(f.get("metadata"), dict) else {}
            f_entries = entries_by_folio.get(fid, [])
            tome_name = f.get("_resolved_tome_name") or "Sin Clasificar"
            series_key = f.get("_resolved_series_key") or "unclassified"
            f_status = _normalize_record_status(f.get("status"))

            folio_num = f_meta.get("folio_number") or f.get("sequence_order") or 1
            folio_side = str(f_meta.get("folio_side") or "recto").lower()
            if f_entries:
                first_e = f_entries[0]
                if first_e.get("folio_number") is not None:
                    folio_num = first_e.get("folio_number")
                if first_e.get("folio_side"):
                    folio_side = str(first_e.get("folio_side")).lower()

            entries_summary = []
            if f_entries:
                for e in f_entries:
                    e_meta = e.get("metadata") if isinstance(e.get("metadata"), dict) else {}
                    e_status = _normalize_record_status(e.get("status") or f_status)
                    e_blank = bool(e_meta.get("is_blank", False) or f_meta.get("is_blank", False))
                    p_person, ev_date, _, rec_type, comb = _extract_entry_fields(e_meta, f_meta, e_status, e_blank)
                    act_num = e.get("act_number") or comb.get("numero_acta") or comb.get("act_number") or "S/N"
                    entries_summary.append({
                        "id": e.get("id"),
                        "entry_number": int(e.get("entry_number") or 1),
                        "act_number": str(act_num),
                        "principal_person": p_person,
                        "event_date": ev_date,
                        "record_type": rec_type,
                        "status": e_status,
                    })
            else:
                e_blank = bool(f_meta.get("is_blank", False))
                p_person, ev_date, _, rec_type, comb = _extract_entry_fields(f_meta, f_meta, f_status, e_blank)
                act_num = comb.get("numero_acta") or comb.get("act_number") or "S/N"
                entries_summary.append({
                    "id": f"syn-{fid}-1",
                    "entry_number": 1,
                    "act_number": str(act_num),
                    "principal_person": p_person,
                    "event_date": ev_date,
                    "record_type": rec_type,
                    "status": f_status,
                })

            items.append({
                "id": fid,
                "canonical_filename": f.get("canonical_filename") or f.get("original_filename") or f"folio_{fid}.jpg",
                "original_filename": f.get("original_filename"),
                "status": f_status,
                "folder_id": f.get("folder_id"),
                "tome_name": tome_name,
                "series": series_key,
                "folio_number": folio_num,
                "folio_side": folio_side,
                "sequence_order": f.get("sequence_order") or 1,
                "entries_count": len(f_entries) if f_entries else 1,
                "entries_summary": entries_summary,
                "digitized_by": f_meta.get("digitized_by") or "Operador",
                "digitized_at": f_meta.get("digitized_at") or f.get("updated_at") or f.get("created_at"),
                "verified_by": f_meta.get("verified_by"),
                "verified_at": f.get("verified_at") or f_meta.get("verified_at"),
                "review_notes": f_meta.get("review_notes") or "",
                "escalated_to_archivist": bool(f_meta.get("escalated_to_archivist", False)),
                "escalated_by": f_meta.get("escalated_by"),
                "escalated_at": f_meta.get("escalated_at"),
                "evaluation_locked_by": f_meta.get("evaluation_locked_by"),
                "evaluation_locked_at": f_meta.get("evaluation_locked_at"),
                "updated_at": f.get("updated_at") or f.get("created_at"),
                "created_at": f.get("created_at"),
            })

        # 7. Ordenar por orden archivístico natural y paginar
        def _eval_sort_key(item: Dict[str, Any]):
            tome_str = str(item.get("tome_name") or "")
            try:
                f_num_int = int(item.get("folio_number") or 9999)
            except (ValueError, TypeError):
                f_num_int = 9999
            f_side_str = str(item.get("folio_side") or "").lower()
            side_order = 0 if f_side_str in ("recto", "r") else (1 if f_side_str in ("vuelto", "v") else 2)
            return (tome_str, f_num_int, side_order)

        items.sort(key=_eval_sort_key)

        total_count = len(items)
        total_pages = max(1, (total_count + eff_limit - 1) // eff_limit) if total_count > 0 else 1
        offset = max(0, (page - 1) * eff_limit)
        paginated_items = items[offset : offset + eff_limit]

        return {
            "status": "success",
            "items": paginated_items,
            "data": paginated_items,
            "counts": counts,
            "total": total_count,
            "page": page,
            "page_size": eff_limit,
            "total_pages": total_pages,
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"Error in get_evaluation_queue: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/evaluation/get_next")
async def get_next_evaluation_folio(
    request: Optional[EvaluationNextRequest] = None,
    auth: Dict[str, Any] = Depends(get_auth_context)
):
    role = auth.get("role")
    if role not in ("evaluator", "archivist", "admin", "superadmin"):
        raise HTTPException(
            status_code=403,
            detail="Permiso denegado: se requiere rol Evaluador, Archivista o Administrador"
        )

    try:
        tenant_id = auth.get("tenant_id")
        user_id = auth.get("user_id")
        req = request or EvaluationNextRequest()

        if not tenant_id:
            return {
                "status": "empty",
                "message": "No hay más folios pendientes en esta cola de evaluación.",
                "data": None
            }

        folio_data: Optional[Dict[str, Any]] = None

        if req.specific_folio_id:
            spec_res = (
                supabase.table("folios")
                .select("*")
                .eq("id", req.specific_folio_id)
                .eq("tenant_id", tenant_id)
                .execute()
            )
            if spec_res.data and len(spec_res.data) > 0:
                folio_data = spec_res.data[0]
        else:
            q_type = (req.queue_type or "to_verify").strip().lower()
            target_status = "revision" if q_type == "doubtful" else "completed"

            # Cargar carpetas si hay filtro de series
            folder_map: Dict[str, Dict[str, Any]] = {}
            if req.series or req.folder_id:
                try:
                    f_res = supabase.table("document_folders").select("id, name, parent_id, folder_type, metadata").eq("tenant_id", tenant_id).execute()
                    folder_map = {str(f["id"]): f for f in (f_res.data or []) if f.get("id")}
                except Exception:
                    folder_map = {}

            cand_res = (
                supabase.table("folios")
                .select("*")
                .eq("tenant_id", tenant_id)
                .eq("status", target_status)
                .execute()
            )
            candidates = cand_res.data or []

            norm_series = (req.series or "").strip().lower()
            norm_folder_id = (req.folder_id or "").strip()

            filtered_candidates = []
            for c in candidates:
                c_meta = c.get("metadata") if isinstance(c.get("metadata"), dict) else {}
                if _is_evaluation_locked_by_another(c_meta, user_id):
                    continue

                c_folder_id = str(c.get("folder_id")) if c.get("folder_id") is not None else None
                tome_name, series_key, is_unclassified = _resolve_folder_series_and_tome(c_folder_id, folder_map, c_meta)

                if norm_folder_id and norm_folder_id.lower() not in ("all", "todos"):
                    if norm_folder_id.lower() == "unclassified":
                        if not is_unclassified:
                            continue
                    elif c_folder_id != norm_folder_id:
                        continue

                if norm_series and norm_series not in ("all", "todos"):
                    if norm_series == "unclassified":
                        if not is_unclassified:
                            continue
                    else:
                        target_s = _infer_series_from_text(norm_series) or norm_series
                        c_meta_series = _infer_series_from_text(str(c_meta.get("series") or c_meta.get("sacrament_type") or ""))
                        if series_key != target_s and c_meta_series != target_s:
                            continue

                filtered_candidates.append(c)

            def _cand_sort_key(c: Dict[str, Any]):
                try:
                    seq = int(c.get("sequence_order") or 999999)
                except (ValueError, TypeError):
                    seq = 999999
                return (seq, str(c.get("created_at") or ""))

            filtered_candidates.sort(key=_cand_sort_key)
            if filtered_candidates:
                folio_data = filtered_candidates[0]

        if not folio_data:
            return {
                "status": "empty",
                "message": "No hay más folios pendientes en esta cola de evaluación.",
                "data": None
            }

        folio_id = str(folio_data["id"])
        now_iso = datetime.now(timezone.utc).isoformat()
        f_meta = dict(folio_data.get("metadata") or {}) if isinstance(folio_data.get("metadata"), dict) else {}
        f_meta["evaluation_locked_at"] = now_iso
        f_meta["evaluation_locked_by"] = user_id

        try:
            supabase.table("folios").update({"metadata": f_meta}).eq("id", folio_id).eq("tenant_id", tenant_id).execute()
        except Exception as lock_err:
            print(f"Notice locking folio for evaluation: {lock_err}")

        folio_data["metadata"] = f_meta

        # Generar Presigned URL de Cloudflare R2
        if folio_data.get("r2_url"):
            try:
                view_url = s3_client.generate_presigned_url(
                    "get_object",
                    Params={
                        "Bucket": os.getenv("R2_BUCKET_NAME"),
                        "Key": folio_data["r2_url"]
                    },
                    ExpiresIn=3600
                )
                folio_data["view_url"] = view_url
            except Exception as url_err:
                print(f"Error generating view_url in evaluation/get_next: {url_err}")
                folio_data["view_url"] = None
        else:
            folio_data["view_url"] = None

        # Cargar template desde batch_id o folder_id
        template_id = None
        template_obj = None
        batch_id = folio_data.get("batch_id")
        if batch_id:
            try:
                b_res = supabase.table("batches").select("template_id").eq("id", batch_id).eq("tenant_id", tenant_id).execute()
                if b_res.data and len(b_res.data) > 0:
                    template_id = b_res.data[0].get("template_id")
            except Exception as b_err:
                print(f"Notice fetching batch template_id in evaluation/get_next: {b_err}")

        if not template_id and folio_data.get("folder_id"):
            try:
                fd_res = supabase.table("document_folders").select("metadata").eq("id", folio_data["folder_id"]).eq("tenant_id", tenant_id).execute()
                if fd_res.data and isinstance(fd_res.data[0].get("metadata"), dict):
                    template_id = fd_res.data[0]["metadata"].get("template_id")
            except Exception:
                pass

        if template_id:
            try:
                t_res = supabase.table("templates").select("*").eq("id", template_id).execute()
                if t_res.data and len(t_res.data) > 0:
                    template_obj = t_res.data[0]
            except Exception as t_err:
                print(f"Notice fetching template in evaluation/get_next: {t_err}")

        folio_data["template_id"] = template_id
        folio_data["template"] = template_obj

        # Cargar entries ordenadas por entry_number
        entries_res = (
            supabase.table("folio_entries")
            .select("*")
            .eq("folio_id", folio_id)
            .eq("tenant_id", tenant_id)
            .order("entry_number")
            .execute()
        )
        entries = entries_res.data or []
        if not entries:
            entries = [{
                "id": f"synthetic-{folio_id}-1",
                "folio_id": folio_id,
                "entry_number": 1,
                "folio_number": f_meta.get("folio_number") or folio_data.get("sequence_order") or 1,
                "folio_side": f_meta.get("folio_side") or "recto",
                "act_number": f_meta.get("numero_acta") or f_meta.get("act_number") or None,
                "is_continued": False,
                "continued_from_entry_id": None,
                "status": folio_data.get("status") or "completed",
                "metadata": f_meta,
                "bounding_box": None,
            }]
        folio_data["entries"] = entries

        # Cargar contexto heredado desde document_folders
        inherited_context = _resolve_folder_inherited_context(supabase, folio_data.get("folder_id"), tenant_id)
        try:
            folder_map_single: Dict[str, Dict[str, Any]] = {}
            f_all_res = supabase.table("document_folders").select("id, name, parent_id, folder_type, metadata").eq("tenant_id", tenant_id).execute()
            folder_map_single = {str(fd["id"]): fd for fd in (f_all_res.data or []) if fd.get("id")}
            tome_name, series_key, _ = _resolve_folder_series_and_tome(
                str(folio_data.get("folder_id")) if folio_data.get("folder_id") else None,
                folder_map_single,
                f_meta
            )
            inherited_context["folder_name"] = tome_name
            inherited_context["series"] = series_key
        except Exception:
            pass

        folio_data["inherited_context"] = inherited_context
        folio_data["digitized_by"] = f_meta.get("digitized_by") or "Operador"
        folio_data["digitized_at"] = f_meta.get("digitized_at") or folio_data.get("updated_at")
        folio_data["verified_by"] = f_meta.get("verified_by")
        folio_data["review_notes"] = f_meta.get("review_notes") or ""
        folio_data["escalated_to_archivist"] = bool(f_meta.get("escalated_to_archivist", False))
        folio_data["escalated_by"] = f_meta.get("escalated_by")

        return {"status": "success", "data": folio_data}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"Error in get_next_evaluation_folio: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/evaluation/{folio_id}/verdict")
async def submit_evaluation_verdict(
    folio_id: str,
    request: EvaluationVerdictRequest,
    auth: Dict[str, Any] = Depends(get_auth_context)
):
    role = auth.get("role")
    if role not in ("evaluator", "archivist", "admin", "superadmin"):
        raise HTTPException(
            status_code=403,
            detail="Permiso denegado: se requiere rol Evaluador, Archivista o Administrador"
        )

    verdict = (request.verdict or "").strip().lower()
    if verdict not in ("verify_entry", "verify_all", "return_to_digitizer", "mark_doubtful"):
        raise HTTPException(status_code=400, detail=f"Veredicto inválido: {request.verdict}")

    try:
        tenant_id = auth["tenant_id"]
        user_id = auth.get("user_id")
        evaluator_identity = _resolve_user_identity(user_id)
        now_iso = datetime.now(timezone.utc).isoformat()

        # 1. Cargar el folio actual y sus folio_entries actuales
        folio_res = supabase.table("folios").select("*").eq("id", folio_id).eq("tenant_id", tenant_id).execute()
        if not folio_res.data:
            raise HTTPException(status_code=404, detail="Folio no encontrado")

        folio = folio_res.data[0]
        f_meta = dict(folio.get("metadata") or {}) if isinstance(folio.get("metadata"), dict) else {}

        existing_entries_res = (
            supabase.table("folio_entries")
            .select("*")
            .eq("folio_id", folio_id)
            .eq("tenant_id", tenant_id)
            .order("entry_number")
            .execute()
        )
        existing_entries = existing_entries_res.data or []
        prev_entries_by_num: Dict[int, Dict[str, Any]] = {
            int(e.get("entry_number") or 1): e for e in existing_entries
        }

        # 2. Detectar correcciones del Evaluador para Active Learning Gold Standard
        _SYSTEM_META_KEYS = {
            "digitized_by", "digitized_at", "verified_by", "verified_at",
            "review_notes", "priority_returned", "returned_by", "returned_at",
            "escalated_to_archivist", "escalated_by", "escalated_at",
            "evaluation_locked_at", "evaluation_locked_by", "is_blank"
        }

        if request.entries and verdict in ("verify_entry", "verify_all"):
            training_rows_to_insert = []
            for req_e in request.entries:
                prev_e = prev_entries_by_num.get(req_e.entry_number)
                prev_meta = (prev_e.get("metadata") if prev_e and isinstance(prev_e.get("metadata"), dict) else f_meta) or {}
                if isinstance(prev_meta.get("data"), dict) and len(prev_meta["data"]) > 0:
                    prev_meta = {**prev_meta, **prev_meta["data"]}

                new_meta = req_e.metadata if isinstance(req_e.metadata, dict) else {}
                if isinstance(new_meta.get("data"), dict) and len(new_meta["data"]) > 0:
                    new_meta = {**new_meta, **new_meta["data"]}

                for field_key, new_val in new_meta.items():
                    if field_key in _SYSTEM_META_KEYS or field_key == "data":
                        continue
                    if isinstance(new_val, (dict, list)):
                        continue
                    prev_val_str = str(prev_meta.get(field_key) or "").strip()
                    new_val_str = str(new_val or "").strip()
                    if prev_val_str != new_val_str and (prev_val_str or new_val_str):
                        training_rows_to_insert.append({
                            "id": str(uuid.uuid4()),
                            "tenant_id": tenant_id,
                            "folio_id": folio_id,
                            "field_name": str(field_key),
                            "predicted_value": prev_val_str,
                            "actual_value": new_val_str,
                            "ai_prediction": prev_val_str,
                            "human_truth": new_val_str,
                            "confidence": 1.0,
                            "action_type": "evaluator_verified_correction",
                            "corrected_by_user_id": user_id,
                        })

            if training_rows_to_insert:
                try:
                    clean_db_rows = [
                        {
                            "id": r["id"],
                            "tenant_id": r["tenant_id"],
                            "folio_id": r["folio_id"],
                            "field_name": r["field_name"],
                            "predicted_value": r["predicted_value"],
                            "actual_value": r["actual_value"],
                            "confidence": r["confidence"],
                            "action_type": r["action_type"],
                            "corrected_by_user_id": r["corrected_by_user_id"],
                        }
                        for r in training_rows_to_insert
                    ]
                    supabase.table("training_data").insert(clean_db_rows).execute()
                except Exception as td_err:
                    print(f"Notice inserting evaluator_verified_correction into training_data: {td_err}")
                try:
                    _save_r2_training_data(tenant_id, training_rows_to_insert)
                except Exception as r2_td_err:
                    print(f"Notice saving evaluator training_data to R2: {r2_td_err}")

        notes_str = (request.review_notes or "").strip()

        # Helper para guardar/actualizar entradas enviadas en request.entries
        def _upsert_submitted_entries(target_entry_status: str, extra_meta: Dict[str, Any], only_matching_entry: bool = False):
            if not request.entries:
                return
            for req_e in request.entries:
                prev_e = prev_entries_by_num.get(req_e.entry_number)
                is_target = True
                if only_matching_entry:
                    is_target = (
                        (request.entry_id and prev_e and str(prev_e.get("id")) == str(request.entry_id))
                        or (request.entry_number is not None and req_e.entry_number == request.entry_number)
                    )
                prev_e_meta = dict(prev_e.get("metadata") or {}) if (prev_e and isinstance(prev_e.get("metadata"), dict)) else {}
                req_e_meta = dict(req_e.metadata or {}) if isinstance(req_e.metadata, dict) else {}
                merged_e_meta = {**prev_e_meta, **req_e_meta}
                if is_target:
                    merged_e_meta.update(extra_meta)

                eff_status = target_entry_status if is_target else (prev_e.get("status") if prev_e else (req_e.status or "completed"))

                e_payload = {
                    "tenant_id": tenant_id,
                    "folio_id": folio_id,
                    "entry_number": req_e.entry_number,
                    "status": eff_status,
                    "metadata": merged_e_meta,
                    "bounding_box": req_e.bounding_box,
                    "folio_number": req_e.folio_number,
                    "folio_side": req_e.folio_side or "recto",
                    "act_number": req_e.act_number,
                    "is_continued": bool(req_e.is_continued),
                    "continued_from_entry_id": req_e.continued_from_entry_id,
                    "updated_at": now_iso,
                }
                if prev_e and prev_e.get("id"):
                    supabase.table("folio_entries").update(e_payload).eq("id", prev_e["id"]).eq("tenant_id", tenant_id).execute()
                else:
                    e_payload["created_at"] = now_iso
                    supabase.table("folio_entries").insert(e_payload).execute()

        # 3. Aplicar cada tipo de veredicto
        if verdict == "verify_all":
            extra_verified_meta = {
                "verified_by": evaluator_identity,
                "verified_at": now_iso,
                "review_notes": notes_str,
                "escalated_to_archivist": False,
                "priority_returned": False,
            }
            if request.entries:
                _upsert_submitted_entries("verified", extra_verified_meta, only_matching_entry=False)
            elif existing_entries:
                for prev_e in existing_entries:
                    pe_meta = dict(prev_e.get("metadata") or {}) if isinstance(prev_e.get("metadata"), dict) else {}
                    pe_meta.update(extra_verified_meta)
                    supabase.table("folio_entries").update({
                        "status": "verified",
                        "metadata": pe_meta,
                        "updated_at": now_iso
                    }).eq("id", prev_e["id"]).eq("tenant_id", tenant_id).execute()

            if request.entries and isinstance(request.entries[0].metadata, dict):
                f_meta.update(request.entries[0].metadata)
            f_meta.update({
                "verified_by": evaluator_identity,
                "verified_at": now_iso,
                "review_notes": notes_str,
                "escalated_to_archivist": False,
                "priority_returned": False,
                "evaluation_locked_at": None,
                "evaluation_locked_by": None,
            })
            supabase.table("folios").update({
                "status": "verified",
                "verified_at": now_iso,
                "metadata": f_meta,
                "updated_at": now_iso
            }).eq("id", folio_id).eq("tenant_id", tenant_id).execute()

            return {
                "status": "success",
                "verdict": "verify_all",
                "folio_status": "verified",
                "verified_by": evaluator_identity,
                "verified_at": now_iso
            }

        elif verdict == "verify_entry":
            extra_verified_meta = {
                "verified_by": evaluator_identity,
                "verified_at": now_iso,
                "review_notes": notes_str,
                "escalated_to_archivist": False,
            }
            if request.entries:
                has_specific = bool(request.entry_id or request.entry_number is not None)
                _upsert_submitted_entries("verified", extra_verified_meta, only_matching_entry=has_specific)
            elif request.entry_id and not str(request.entry_id).startswith("synthetic-"):
                target_e_res = supabase.table("folio_entries").select("*").eq("id", request.entry_id).eq("tenant_id", tenant_id).execute()
                if target_e_res.data:
                    te = target_e_res.data[0]
                    te_meta = dict(te.get("metadata") or {}) if isinstance(te.get("metadata"), dict) else {}
                    te_meta.update(extra_verified_meta)
                    supabase.table("folio_entries").update({
                        "status": "verified",
                        "metadata": te_meta,
                        "updated_at": now_iso
                    }).eq("id", request.entry_id).eq("tenant_id", tenant_id).execute()
            elif existing_entries:
                target_e = existing_entries[0]
                if request.entry_number is not None and request.entry_number in prev_entries_by_num:
                    target_e = prev_entries_by_num[request.entry_number]
                te_meta = dict(target_e.get("metadata") or {}) if isinstance(target_e.get("metadata"), dict) else {}
                te_meta.update(extra_verified_meta)
                supabase.table("folio_entries").update({
                    "status": "verified",
                    "metadata": te_meta,
                    "updated_at": now_iso
                }).eq("id", target_e["id"]).eq("tenant_id", tenant_id).execute()

            # Comprobar si TODAS las partidas del folio están ahora en status == 'verified'
            recheck_res = supabase.table("folio_entries").select("id, status").eq("folio_id", folio_id).eq("tenant_id", tenant_id).execute()
            recheck_entries = recheck_res.data or []
            all_verified = len(recheck_entries) == 0 or all(
                (re.get("status") or "").lower() == "verified" for re in recheck_entries
            )

            if all_verified:
                if request.entries and isinstance(request.entries[0].metadata, dict):
                    f_meta.update(request.entries[0].metadata)
                f_meta.update({
                    "verified_by": evaluator_identity,
                    "verified_at": now_iso,
                    "review_notes": notes_str,
                    "escalated_to_archivist": False,
                    "priority_returned": False,
                    "evaluation_locked_at": None,
                    "evaluation_locked_by": None,
                })
                supabase.table("folios").update({
                    "status": "verified",
                    "verified_at": now_iso,
                    "metadata": f_meta,
                    "updated_at": now_iso
                }).eq("id", folio_id).eq("tenant_id", tenant_id).execute()
                new_folio_status = "verified"
            else:
                new_folio_status = folio.get("status") or "completed"

            return {
                "status": "success",
                "verdict": "verify_entry",
                "folio_status": new_folio_status,
                "all_verified": all_verified,
                "verified_by": evaluator_identity,
                "verified_at": now_iso
            }

        elif verdict == "return_to_digitizer":
            eff_notes = notes_str or "Devuelto por Evaluador para corrección"
            return_meta = {
                "review_notes": eff_notes,
                "returned_by": evaluator_identity,
                "returned_at": now_iso,
                "priority_returned": True,
                "escalated_to_archivist": False,
            }
            if request.entries:
                _upsert_submitted_entries("pending", return_meta, only_matching_entry=False)
            elif existing_entries:
                for prev_e in existing_entries:
                    if request.entry_id and not str(request.entry_id).startswith("synthetic-") and str(prev_e.get("id")) != str(request.entry_id):
                        continue
                    pe_meta = dict(prev_e.get("metadata") or {}) if isinstance(prev_e.get("metadata"), dict) else {}
                    pe_meta.update(return_meta)
                    supabase.table("folio_entries").update({
                        "status": "pending",
                        "metadata": pe_meta,
                        "updated_at": now_iso
                    }).eq("id", prev_e["id"]).eq("tenant_id", tenant_id).execute()

            f_meta.update({
                **return_meta,
                "evaluation_locked_at": None,
                "evaluation_locked_by": None,
            })
            supabase.table("folios").update({
                "status": "pending",
                "locked_at": None,
                "metadata": f_meta,
                "updated_at": now_iso
            }).eq("id", folio_id).eq("tenant_id", tenant_id).execute()

            return {
                "status": "success",
                "verdict": "return_to_digitizer",
                "folio_status": "pending",
                "returned_by": evaluator_identity,
                "returned_at": now_iso,
                "review_notes": eff_notes
            }

        elif verdict == "mark_doubtful":
            eff_notes = notes_str or "Escalado al Archivista por Evaluador"
            escalate_meta = {
                "review_notes": eff_notes,
                "escalated_to_archivist": True,
                "escalated_by": evaluator_identity,
                "escalated_at": now_iso,
            }
            if request.entries:
                _upsert_submitted_entries("revision", escalate_meta, only_matching_entry=False)
            elif existing_entries:
                for prev_e in existing_entries:
                    pe_meta = dict(prev_e.get("metadata") or {}) if isinstance(prev_e.get("metadata"), dict) else {}
                    pe_meta.update(escalate_meta)
                    supabase.table("folio_entries").update({
                        "status": "revision",
                        "metadata": pe_meta,
                        "updated_at": now_iso
                    }).eq("id", prev_e["id"]).eq("tenant_id", tenant_id).execute()

            f_meta.update({
                **escalate_meta,
                "evaluation_locked_at": None,
                "evaluation_locked_by": None,
            })
            supabase.table("folios").update({
                "status": "revision",
                "locked_at": None,
                "metadata": f_meta,
                "updated_at": now_iso
            }).eq("id", folio_id).eq("tenant_id", tenant_id).execute()

            return {
                "status": "success",
                "verdict": "mark_doubtful",
                "folio_status": "revision",
                "escalated_to_archivist": True,
                "escalated_by": evaluator_identity,
                "escalated_at": now_iso,
                "review_notes": eff_notes
            }

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"Error in submit_evaluation_verdict: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))






