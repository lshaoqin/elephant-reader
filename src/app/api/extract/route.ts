import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Forward the request to the Python backend
    const backendUrl = process.env.PYTHON_BACKEND_URL || "http://localhost:8080";
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${backendUrl}/extract`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        return NextResponse.json(
          { error: error.error || "Failed to extract text" },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json({
        full_text: data.full_text,
        blocks: data.blocks,
        image_base64: data.image_base64,
      });
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
