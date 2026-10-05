import os
import tempfile
import boto3
import pyvips
from pdf2image import convert_from_path
from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL", "http://localhost:8000")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "dummy-key")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID", "dummy-account")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID", "dummy-access")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY", "dummy-secret")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME", "codexflow")

def get_s3_client():
    return boto3.client(
        's3',
        endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name="auto"
    )

def process_file(folio_id: str, file_key: str):
    s3 = get_s3_client()
    
    with tempfile.TemporaryDirectory() as temp_dir:
        file_name = os.path.basename(file_key)
        local_path = os.path.join(temp_dir, file_name)
        
        s3.download_file(R2_BUCKET_NAME, file_key, local_path)
        
        ext = file_name.split('.')[-1].lower()
        pages_to_process = []
        if ext == 'pdf':
            pages = convert_from_path(local_path)
            for i, page in enumerate(pages):
                page_path = os.path.join(temp_dir, f"page_{i}.jpg")
                page.save(page_path, 'JPEG')
                pages_to_process.append(page_path)
        else:
            pages_to_process.append(local_path)
            
        dzi_base_url = ""
            
        for i, page_path in enumerate(pages_to_process):
            dzi_name = f"{folio_id}_{i}"
            dzi_path = os.path.join(temp_dir, dzi_name)
            
            img = pyvips.Image.new_from_file(page_path)
            img.dzsave(dzi_path)
            
            dzi_file_path = f"{dzi_path}.dzi"
            s3.upload_file(dzi_file_path, R2_BUCKET_NAME, f"dzi/{dzi_name}.dzi")
            
            dzi_files_dir = f"{dzi_path}_files"
            for root, dirs, files in os.walk(dzi_files_dir):
                for f in files:
                    local_f = os.path.join(root, f)
                    rel_path = os.path.relpath(local_f, temp_dir)
                    s3.upload_file(local_f, R2_BUCKET_NAME, f"dzi/{rel_path}".replace("\\", "/"))
            
            if i == 0:
                dzi_base_url = f"dzi/{dzi_name}.dzi"
                
        supabase.table("folios").update({
            "status": "processed",
            "r2_url": dzi_base_url
        }).eq("id", folio_id).execute()
