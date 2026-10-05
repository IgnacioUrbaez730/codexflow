import os
from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
from supabase import create_client, Client
from typing import List
from worker import process_file

# Setup Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL", "http://localhost:8000")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "dummy-key")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="CodexFlow Ingestion API")

class IngestRequest(BaseModel):
    batch_id: str
    files: List[str] # List of file paths/keys uploaded to R2

class FeedbackRequest(BaseModel):
    tenant_id: str
    folio_id: str
    field_name: str
    predicted_value: str
    actual_value: str

def process_batch_task(batch_id: str, files: List[str]):
    try:
        # Update batch status to processing
        supabase.table("batches").update({"status": "processing"}).eq("id", batch_id).execute()
        
        # Create folios for each file with status pending
        for file in files:
            folio_data = {
                "batch_id": batch_id,
                "status": "pending",
                "r2_url": file,
            }
            res = supabase.table("folios").insert(folio_data).execute()
            
            # Run processing worker
            if res.data:
                folio_id = res.data[0]["id"]
                try:
                    process_file(folio_id, file)
                except Exception as file_e:
                    print(f"Error processing file {file} for folio {folio_id}: {file_e}")
                    supabase.table("folios").update({"status": "failed"}).eq("id", folio_id).execute()
                    supabase.table("batches").update({"status": "failed"}).eq("id", batch_id).execute()
        
    except Exception as e:
        print(f"Error processing batch {batch_id}: {e}")
        supabase.table("batches").update({"status": "failed"}).eq("id", batch_id).execute()

@app.post("/ingest")
async def ingest_batch(request: IngestRequest, background_tasks: BackgroundTasks):
    try:
        # Confirm upload and dispatch the background task
        background_tasks.add_task(process_batch_task, request.batch_id, request.files)
        
        return {"status": "success", "message": f"Batch {request.batch_id} ingestion task dispatched."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def health_check():
    return {"status": "ok"}

@app.post("/active-learning/feedback")
async def register_feedback(request: FeedbackRequest):
    try:
        data = {
            "tenant_id": request.tenant_id,
            "folio_id": request.folio_id,
            "field_name": request.field_name,
            "predicted_value": request.predicted_value,
            "actual_value": request.actual_value,
        }
        supabase.table("training_data").insert(data).execute()
        return {"status": "success", "message": "Feedback registered successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
