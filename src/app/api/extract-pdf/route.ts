import { NextResponse } from "next/server";
import { requireFirebaseAuth } from "@/utils/require-firebase-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const authResult = await requireFirebaseAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file is PDF
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
    }

    // Forward the request to the Python backend
    const backendUrl = process.env.PYTHON_BACKEND_URL || "http://localhost:8080";
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${backendUrl}/extract-pdf`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authResult.token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        return NextResponse.json(
          { error: error.error || "Failed to extract text from PDF" },
          { status: response.status }
        );
      }

      const data = await response.json();
      
      // PDF endpoint now returns an array of results (one per page)
      return NextResponse.json({
        results: data.results,
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
