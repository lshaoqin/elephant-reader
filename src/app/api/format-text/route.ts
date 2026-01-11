import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = body.text as string;

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    // Forward the request to the Python backend
    const backendUrl = process.env.PYTHON_BACKEND_URL || "http://localhost:8080";

    const response = await fetch(`${backendUrl}/format-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.error || "Failed to format text" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ formatted_text: data.formatted_text });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to format text: ${String(err)}` },
      { status: 500 }
    );
  }
}
