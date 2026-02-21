import { NextRequest, NextResponse } from "next/server";
import { requireFirebaseAuth } from "@/utils/require-firebase-auth";

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireFirebaseAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { word, contextSentence } = body;

    if (!word || !word.trim()) {
      return NextResponse.json({ error: "No word provided" }, { status: 400 });
    }

    const backendUrl = process.env.PYTHON_BACKEND_URL || "http://localhost:8080";

    const payload = {
      word: word.trim(),
      context_sentence:
        typeof contextSentence === "string" ? contextSentence.trim() : "",
    };

    const response = await fetch(`${backendUrl}/define-word`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authResult.token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching definition:", error);
    return NextResponse.json(
      { error: "Failed to fetch definition" },
      { status: 500 }
    );
  }
}
