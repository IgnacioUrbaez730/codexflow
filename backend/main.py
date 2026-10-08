import os
import secrets
import hashlib
import uuid
import boto3
from botocore.client import Config
from datetime import datetime, timedelta
from fastapi import FastAPI, BackgroundTasks, HTTPException, Header, Depends
from pydantic import BaseModel
from supabase import create_client, Client, ClientOptions
from typing import List, Optional, Dict, Any
from worker import process_file

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
            user_client.table("folios").update({"status": "failed"}).eq("id", folio_id).execute()
            user_client.table("batches").update({"status": "failed"}).eq("id", batch_id).execute()

async def process_batch_task(batch_id: str, files: List[str], user_client: Client, tenant_id: str):
    try:
        # Update batch status to processing
        user_client.table("batches").update({"status": "processing"}).eq("id", batch_id).execute()
        
        tasks = []
        # Create folios for each file with status pending
        for file in files:
            folio_data = {
                "batch_id": batch_id,
                "tenant_id": tenant_id,
                "status": "pending",
                "r2_url": file,
            }
            res = user_client.table("folios").insert(folio_data).execute()
            
            # Prepare processing task
            if res.data:
                folio_id = res.data[0]["id"]
                tasks.append(async_process_file(folio_id, file, user_client, batch_id))
                
        # Wait for all files in this batch to finish processing
        if tasks:
            await asyncio.gather(*tasks)
        
    except Exception as e:
        print(f"Error processing batch {batch_id}: {e}")
        user_client.table("batches").update({"status": "failed"}).eq("id", batch_id).execute()

@app.post("/api/v1/ingest")
async def ingest_batch(request: IngestRequest, background_tasks: BackgroundTasks, auth: Dict[str, Any] = Depends(get_auth_context)):
    try:
        # Confirm upload and dispatch the background task
        background_tasks.add_task(process_batch_task, request.batch_id, request.files, auth["user_client"], auth["tenant_id"])
        
        return {"status": "success", "message": f"Batch {request.batch_id} ingestion task dispatched."}
    except Exception as e:
        print(f"Error in create_tenant: {str(e)}"); raise HTTPException(status_code=500, detail=str(e))

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

@app.post("/api/v1/folios/get_next")
async def get_next_folio(auth: Dict[str, Any] = Depends(get_auth_context)):
    try:
        user_client = auth["user_client"]
        tenant_id = auth["tenant_id"]
        res = user_client.rpc("get_next_folio", {"p_tenant_id": tenant_id}).execute()
        
        if not res.data or len(res.data) == 0:
            return {"status": "success", "data": None}
            
        return {"status": "success", "data": res.data[0]}
    except Exception as e:
        print(f"Error in get_next_folio: {str(e)}")
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

@app.post("/api/v1/folios/save")
async def save_folio(request: FolioSaveRequest, auth: Dict[str, Any] = Depends(get_auth_context)):
    try:
        user_client = auth["user_client"]
        
        # Verify folio exists and get template
        folio_res = user_client.table("folios").select("*, batches(template_id)").eq("id", request.folio_id).execute()
        if not folio_res.data:
            raise HTTPException(status_code=404, detail="Folio not found")
            
        folio = folio_res.data[0]
        template_id = folio["batches"]["template_id"]
        
        tpl_res = user_client.table("templates").select("fields").eq("id", template_id).execute()
        if not tpl_res.data:
            raise HTTPException(status_code=404, detail="Template not found")
            
        fields = tpl_res.data[0].get("fields", [])
        
        if request.status == "completed":
            # Validate required fields
            for f in fields:
                if f.get("required"):
                    val = request.metadata.get(f["id"])
                    if val is None or str(val).strip() == "":
                        raise HTTPException(status_code=400, detail=f"Field {f['id']} is required")
        
        # Update folio
        update_data = {
            "metadata": request.metadata,
            "status": request.status
        }
        if request.status == "completed":
            update_data["verified_at"] = datetime.now(timezone.utc).isoformat()
            
        res = user_client.table("folios").update(update_data).eq("id", request.folio_id).execute()
        
        return {"status": "success", "data": res.data[0]}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))
