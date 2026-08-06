// The single place client-side environment configuration is read.
//
// Vite exposed browser env as `import.meta.env.VITE_*`. Next exposes it as
// `process.env.NEXT_PUBLIC_*`, inlined at build time. The references below
// must stay written out literally — the bundler does a static text
// substitution, so `process.env[someVariable]` silently yields undefined.
//
// Previously these reads were scattered across firebase.js and three view
// files. Centralising them means a missing variable surfaces here, once,
// instead of as a cryptic runtime error deep in a feature.

function required(name: string, value: string | undefined): string {
  if (!value && typeof window !== "undefined") {
    // Warn rather than throw: a missing Firebase key should degrade to a
    // failed sign-in, not a blank page for every route.
    console.warn(
      `[config] Missing ${name}. Set it in .env.local (dev) or the Vercel project (prod).`
    );
  }
  return value ?? "";
}

export const firebaseConfig = {
  apiKey: required(
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  ),
  authDomain: required(
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  ),
  projectId: required(
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  ),
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: required(
    "NEXT_PUBLIC_FIREBASE_APP_ID",
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  ),
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "",
};

// Prefix for /api calls.
//
// Empty in every normal deployment: next.config.ts rewrites /api/* to the
// Express server, so the browser always talks to its own origin. That
// removes the CORS preflight the old VITE_API_URL cross-origin setup
// needed. Override only when pointing a local frontend at a remote API.
export const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(
  /\/$/,
  ""
);

// True when Firebase has enough configuration to attempt initialisation.
// Lets callers degrade gracefully instead of throwing at module scope.
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);
