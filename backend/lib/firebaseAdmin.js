// Firebase Admin SDK — verifies ID tokens minted by the client SDK.
//
// The service account JSON lives in env var FIREBASE_ADMIN_KEY_B64 as a
// single base64-encoded string (newlines in the private_key survive the
// round-trip). On Render, paste the same base64 value into the dashboard.
//
// We keep a single global Admin app so initializeApp() doesn't get
// called twice in hot-reload dev (which throws).
import admin from "firebase-admin";

let _app = null;

export function getAdminApp() {
  if (_app) return _app;
  // Vite HMR can re-execute this module without restarting Node, so a
  // second initializeApp() with the same default name would throw.
  // Prefer reusing whatever the runtime already has.
  if (admin.apps.length > 0) {
    _app = admin.apps[0];
    return _app;
  }
  const b64 = process.env.FIREBASE_ADMIN_KEY_B64;
  if (!b64) {
    throw new Error(
      "FIREBASE_ADMIN_KEY_B64 missing. Paste the base64 service-account into .env (see README)."
    );
  }
  let creds;
  try {
    creds = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  } catch (e) {
    throw new Error(`FIREBASE_ADMIN_KEY_B64 is not valid base64-JSON: ${e.message}`);
  }
  _app = admin.initializeApp({ credential: admin.credential.cert(creds) });
  return _app;
}

// Verifies a Firebase ID token and returns the decoded claims.
// Throws on invalid/expired tokens — caller decides the HTTP shape.
export async function verifyIdToken(idToken) {
  const app = getAdminApp();
  return admin.auth(app).verifyIdToken(idToken);
}
