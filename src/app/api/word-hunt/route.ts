import { NextResponse } from "next/server";
import { requireFirebaseAuth } from "@/utils/require-firebase-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const authResult = await requireFirebaseAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const body = await req.json();
    const text = typeof body?.text === "string" ? body.text.trim() : "";

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const backendUrl = process.env.PYTHON_BACKEND_URL || "http://localhost:8080";

    const response = await fetch(`${backendUrl}/word-hunt/vocabulary`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authResult.token}`,
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Failed to generate word hunt question" }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error generating vocabulary word hunt:", error);
    return NextResponse.json(
      { error: "Failed to generate vocabulary word hunt" },
      { status: 500 }
    );
  }
}