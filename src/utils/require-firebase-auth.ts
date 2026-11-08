import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdminAuth } from "@/utils/firebase-admin";

export interface FirebaseAuthResult {
  token: string;
  uid: string;
  phoneNumber?: string;
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isAppSessionToken(value: string) {
  return value.startsWith("app_session:");
}

export async function requireFirebaseAuth(
  request: NextRequest | Request,
  optional: boolean = false
): Promise<FirebaseAuthResult | null | NextResponse> {
  const authorizationHeader = request.headers.get("authorization") || "";
  const bearerToken = authorizationHeader.startsWith("Bearer ")
    ? authorizationHeader.slice(7).trim()
    : "";

  const cookieHeader = request.headers.get("cookie") || "";
  const cookieToken = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("firebase_token="))
    ?.slice("firebase_token=".length);

  const appSessionCookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("app_session="))
    ?.slice("app_session=".length);

  const decodedCookieToken = cookieToken ? safeDecode(cookieToken) : "";
  const decodedAppSessionCookie = appSessionCookie ? safeDecode(appSessionCookie) : "";

  const token = bearerToken || decodedCookieToken || (decodedAppSessionCookie ? `app_session:${decodedAppSessionCookie}` : "");

  if (!token) {
    if (optional) return null;
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isAppSessionToken(token)) {
    const username = safeDecode(token.slice("app_session:".length));
    return {
      token,
      uid: `app-session-${username.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
      phoneNumber: username,
    };
  }

  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(token);
    return {
      token,
      uid: decoded.uid,
      phoneNumber: decoded.phone_number,
    };
  } catch {
    if (optional) return null;
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }
}
