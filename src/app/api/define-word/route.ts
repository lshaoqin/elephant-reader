import { NextRequest, NextResponse } from "next/server";
import { requireFirebaseAuth } from "@/utils/require-firebase-auth";

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireFirebaseAuth(request, true);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { word, contextSentence, language_code, voice_name, include_illustration } = body;

    if (!word || !word.trim()) {
      return NextResponse.json({ error: "No word provided" }, { status: 400 });
    }

    const backendUrl = process.env.PYTHON_BACKEND_URL || "http://localhost:8080";

    const payload = {
      word: word.trim(),
      context_sentence:
        typeof contextSentence === "string" ? contextSentence.trim() : "",
      language_code:
        typeof language_code === "string" ? language_code.trim() : undefined,
      voice_name: typeof voice_name === "string" ? voice_name.trim() : undefined,
      include_illustration:
        typeof include_illustration === "boolean" ? include_illustration : true,
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authResult?.token) {
      headers["Authorization"] = `Bearer ${authResult!.token}`;
    }

    const response = await fetch(`${backendUrl}/define-word`, {
      method: "POST",
      headers,
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
