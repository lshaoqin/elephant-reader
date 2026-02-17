import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdminAuth } from "@/utils/firebase-admin";

export const runtime = "nodejs";

const COOKIE_NAME = "firebase_token";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const idToken = body?.idToken as string | undefined;

    if (!idToken) {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    }

    await getFirebaseAdminAuth().verifyIdToken(idToken);

    const response = NextResponse.json({ ok: true });
    response.cookies.set(COOKIE_NAME, idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60,
    });

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid token";
    const isConfigError =
      message.includes("Firebase Admin credentials") ||
      message.includes("project ID") ||
      message.includes("credential");

    if (isConfigError) {
      console.error("Firebase Admin config error:", message);
      return NextResponse.json(
        { error: "Firebase Admin is not configured correctly" },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: message || "Invalid token" }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
