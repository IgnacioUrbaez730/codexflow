import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const R2_ENDPOINT_URL = process.env.R2_ENDPOINT_URL || "";
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "codexflow-folios";

const s3 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT_URL,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export async function generateUploadUrl(fileName: string, contentType: string) {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session) {
    throw new Error("No hay sesión activa");
  }

  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", session.user.id)
    .single();

  if (userError || !userData?.tenant_id) {
    throw new Error("El usuario no tiene un tenant_id asignado");
  }

  const tenantId = userData.tenant_id;
  const key = `${tenantId}/${Date.now()}-${fileName}`;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

  return { signedUrl, key };
}
