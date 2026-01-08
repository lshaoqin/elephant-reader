import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { text, language_code, voice_name } = body;

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    // Forward the request to the Python backend
    const backendUrl = process.env.PYTHON_BACKEND_URL || "http://localhost:5000";

    try {
      const response = await fetch(`${backendUrl}/tts/google`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          language_code: language_code || "en-US",
          voice_name: voice_name || "en-US-Neural2-H",
        }),
      });

      if (!response.ok) {
        return NextResponse.json(
          { error: "Failed to generate audio" },
          { status: response.status }
        );
      }

      // Return the streaming response directly so the frontend can handle SSE
      if (response.body) {
        return new NextResponse(response.body, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }

      return NextResponse.json(
        { error: "No response body from backend" },
        { status: 500 }
      );
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
