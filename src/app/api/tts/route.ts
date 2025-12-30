import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { text, voice } = body;

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    // Forward the request to the Python backend
    const backendUrl = process.env.PYTHON_BACKEND_URL || "http://localhost:5000";

    try {
      const response = await fetch(`${backendUrl}/tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          voice: voice || "af_heart",
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
    } catch (err) {
      return NextResponse.json(
        { error: `Failed to connect to backend: ${String(err)}` },
        { status: 500 }
      );
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
