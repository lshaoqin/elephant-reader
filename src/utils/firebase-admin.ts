import { applicationDefault, cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

let hasLoggedFirebaseAdminConfig = false;

function logFirebaseAdminConfigOnce(details: {
  source: "env-cert" | "application-default" | "existing-app";
  projectId?: string;
  credentialsPath?: string;
}) {
  if (hasLoggedFirebaseAdminConfig) return;
  hasLoggedFirebaseAdminConfig = true;

  console.log(
    "[Firebase Admin] init",
    JSON.stringify({
      source: details.source,
      projectId: details.projectId || process.env.FIREBASE_PROJECT_ID || "(not-set)",
      credentialsPath: details.credentialsPath || "(not-set)",
    })
  );
}

function initializeFirebaseAdmin() {
  if (getApps().length > 0) {
    const app = getApp();
    logFirebaseAdminConfigOnce({
      source: "existing-app",
      projectId: app.options.projectId,
    });
    return getApp();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const credentialsPath =
    process.env.FIREBASE_ADMIN_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (projectId && clientEmail && privateKey) {
    logFirebaseAdminConfigOnce({
      source: "env-cert",
      projectId,
      credentialsPath,
    });
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  if (credentialsPath) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
  }

  try {
    logFirebaseAdminConfigOnce({
      source: "application-default",
      projectId,
      credentialsPath,
    });
    return initializeApp({
      credential: applicationDefault(),
      ...(projectId ? { projectId } : {}),
    });
  } catch {
    throw new Error(
      "Firebase Admin credentials are missing or invalid. Set FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY or FIREBASE_ADMIN_CREDENTIALS."
    );
  }
}

export function getFirebaseAdminAuth() {
  const app = initializeFirebaseAdmin();
  return getAuth(app);
}
