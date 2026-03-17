import { NextResponse } from "next/server";
import { requireFirebaseAuth } from "@/utils/require-firebase-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const authResult = await requireFirebaseAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const body = await req.json();
    const { text, language_code, voice_name, provider } = body;

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    // Forward the request to the Python backend
    const backendUrl = process.env.PYTHON_BACKEND_URL || "http://localhost:8080";

    try {
      const response = await fetch(`${backendUrl}/tts/google`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authResult.token}`,
        },
        body: JSON.stringify({
          text,
          language_code: language_code || "en-US",
          voice_name: voice_name || "en-US-Neural2-H",
          provider,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json(
          { error: errorText || "Failed to generate audio" },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data);
    } catch (fetchError) {
      console.error("Error connecting to backend:", fetchError);
      return NextResponse.json(
        { error: "Could not connect to backend service" },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error("Error in TTS route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
