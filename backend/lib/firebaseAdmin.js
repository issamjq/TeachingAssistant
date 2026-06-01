// Firebase Admin SDK — verifies ID tokens minted by the client SDK.
//
// Two credential paths are supported. Either works; pick whichever
// your host makes easiest:
//
//   1. GOOGLE_APPLICATION_CREDENTIALS — path to a JSON file on disk.
//      The Admin SDK reads this env var automatically. On Render,
//      upload the service-account JSON via Settings → Secret Files
//      and set this env var to the mount path (e.g.
//      /etc/secrets/firebase-admin.json). No base64 round-trip; no
//      risk of textarea truncation.
//
//   2. FIREBASE_ADMIN_KEY_B64 — single base64-encoded string of the
//      same JSON. Works for hosts that only expose key=value env
//      vars, but every paste is one chance for a stray newline or a
//      truncation to corrupt the credential. Use #1 when possible.
//
// We keep a single global Admin app so initializeApp() doesn't get
// called twice in hot-reload dev (which throws).
import admin from "firebase-admin";
import fs from "node:fs";

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

  // Path 1 — JSON file on disk (the Firebase-recommended way).
  const filePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(
        `GOOGLE_APPLICATION_CREDENTIALS points at ${filePath}, but no file exists there.`
      );
    }
    let creds;
    try {
      creds = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (e) {
      throw new Error(
        `GOOGLE_APPLICATION_CREDENTIALS file is not valid JSON: ${e.message}`
      );
    }
    _app = admin.initializeApp({ credential: admin.credential.cert(creds) });
    return _app;
  }

  // Path 2 — base64-encoded JSON in env.
  const b64 = process.env.FIREBASE_ADMIN_KEY_B64;
  if (!b64) {
    throw new Error(
      "No Firebase credentials configured. Set either " +
        "GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json (recommended on Render via Secret Files) " +
        "or FIREBASE_ADMIN_KEY_B64=<base64-encoded JSON>."
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
