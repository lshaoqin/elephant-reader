import { NextRequest, NextResponse } from "next/server";
import { requireFirebaseAuth } from "@/utils/require-firebase-auth";

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireFirebaseAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { text } = body;

    if (!text || !String(text).trim()) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const backendUrl = process.env.PYTHON_BACKEND_URL || "http://localhost:8080";
    const response = await fetch(`${backendUrl}/word-hunt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authResult.token}`,
      },
      body: JSON.stringify({ text: String(text).trim() }),
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error creating word hunt:", error);
    return NextResponse.json(
      { error: "Failed to create word hunt" },
      { status: 500 }
    );
  }
}
