import { NextRequest, NextResponse } from "next/server";
import { requireFirebaseAuth } from "@/utils/require-firebase-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const authResult = await requireFirebaseAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const backendUrl = process.env.PYTHON_BACKEND_URL || "http://localhost:8080";

  const response = await fetch(`${backendUrl}/user-files`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${authResult.token}`,
    },
  });

  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}

export async function POST(req: NextRequest) {
  const authResult = await requireFirebaseAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const backendUrl = process.env.PYTHON_BACKEND_URL || "http://localhost:8080";
  const body = await req.json();

  const response = await fetch(`${backendUrl}/user-files`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authResult.token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}
