import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60; // Allow up to 60 seconds for batch processing

const MAX_FILES = 20;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const files = form.getAll("files") as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Too many files. Maximum is ${MAX_FILES}` },
        { status: 400 }
      );
    }

    // Forward the request to the Python backend
    const backendUrl = process.env.PYTHON_BACKEND_URL || "http://localhost:8080";
    
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });

    try {
      const response = await fetch(`${backendUrl}/extract-batch`, {
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
        results: data.results,
        errors: data.errors,
        total: data.total,
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
