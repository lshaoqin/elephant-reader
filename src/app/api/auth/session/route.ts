import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const COOKIE_NAME = "firebase_token";
const APP_SESSION_COOKIE_NAME = "app_session";

const getEnvValue = (...keys: string[]) =>
  keys
    .map((key) => process.env[key])
    .find((value) => typeof value === "string" && value.trim().length > 0)?.trim();

const normalizeUsername = (value: string) => value.trim();

const isValidUsernamePassword = (username: string, password: string) => {
  const normalizedUsername = normalizeUsername(username);
  const configuredPassword = getEnvValue("APP_PASSWORD", "NEXT_PUBLIC_APP_PASSWORD");

  if (!configuredPassword) {
    return false;
  }

  if (!normalizedUsername || !password) {
    return false;
  }

  return password === configuredPassword;
};

const setAuthenticatedSession = (response: NextResponse, username: string) => {
  const tokenValue = `app_session:${username}`;

  response.cookies.set(COOKIE_NAME, tokenValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });

  response.cookies.set(APP_SESSION_COOKIE_NAME, username, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });
};

export async function GET(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie") || "";
  const sessionUser = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${APP_SESSION_COOKIE_NAME}=`))
    ?.slice(`${APP_SESSION_COOKIE_NAME}=`.length);

  if (!sessionUser) {
    return NextResponse.json({ ok: false, authenticated: false }, { status: 401 });
  }

  return NextResponse.json({ ok: true, authenticated: true, username: decodeURIComponent(sessionUser) });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const idToken = body?.idToken as string | undefined;
    const username = typeof body?.username === "string" ? normalizeUsername(body.username) : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (idToken) {
      const response = NextResponse.json({ ok: true });
      response.cookies.set(COOKIE_NAME, idToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60,
      });
      return response;
    }

    if (!username || !password) {
      return NextResponse.json({ error: "Missing username or password" }, { status: 400 });
    }

    if (!isValidUsernamePassword(username, password)) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true, username });
    setAuthenticatedSession(response, username);
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ error: message || "Invalid request" }, { status: 401 });
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
  response.cookies.set(APP_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
