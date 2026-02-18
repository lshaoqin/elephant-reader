import { NextRequest, NextResponse } from "next/server";
import { requireFirebaseAuth } from "@/utils/require-firebase-auth";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ documentId: string }> }
) {
  const authResult = await requireFirebaseAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const { documentId } = await context.params;
  const backendUrl = process.env.PYTHON_BACKEND_URL || "http://localhost:8080";

  const response = await fetch(`${backendUrl}/user-files/${documentId}/preview`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${authResult.token}`,
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: "Preview not found" }));
    return NextResponse.json(data, { status: response.status });
  }

  const buffer = await response.arrayBuffer();
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": response.headers.get("content-type") || "image/jpeg",
      "Cache-Control": "private, max-age=60",
    },
  });
}
