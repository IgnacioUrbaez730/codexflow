import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ folioId: string }> | { folioId: string } }
) {
  const resolved = await Promise.resolve(params);
  const folioId = resolved.folioId;
  const backendBase = process.env.NEXT_PUBLIC_API_URL || "https://codexflow-backend.onrender.com";
  return NextResponse.redirect(`${backendBase}/api/v1/folios/${folioId}/image`, 307);
}
