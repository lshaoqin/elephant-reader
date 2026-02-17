import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdminAuth } from "@/utils/firebase-admin";

export interface FirebaseAuthResult {
  token: string;
  uid: string;
  phoneNumber?: string;
}

export async function requireFirebaseAuth(
  request: NextRequest | Request
): Promise<FirebaseAuthResult | NextResponse> {
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

  const token = bearerToken || cookieToken;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(token);
    return {
      token,
      uid: decoded.uid,
      phoneNumber: decoded.phone_number,
    };
  } catch {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }
}
