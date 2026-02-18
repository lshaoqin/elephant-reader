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

  const response = await fetch(`${backendUrl}/user-files/${documentId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${authResult.token}`,
    },
  });

  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}
