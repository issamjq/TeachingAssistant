// Supabase Auth — verifies the access token minted by the Supabase JS
// client. Replaces lib/firebaseAdmin.js.
//
// Verification is LOCAL, against the project's JWKS endpoint:
//
//   https://<ref>.supabase.co/auth/v1/.well-known/jwks.json
//
// This project signs tokens with an asymmetric ES256 key, so the backend
// only ever needs the public half. Two things follow from that:
//
//   - No shared secret lives in the backend env. The old legacy
//     SUPABASE_JWT_SECRET approach (HS256) hands every server the power
//     to MINT tokens, not just verify them; a leak there is a full
//     account-impersonation vulnerability. We don't use it.
//   - No network round-trip per request. jose caches the JWKS in memory
//     and only refetches on an unknown `kid` (i.e. after a key rotation),
//     so this is as cheap as the old Firebase Admin path.
//
// The service-role/secret key is deliberately NOT used here. Calling
// /auth/v1/user with the token would also work, but it adds a network
// hop to every authenticated request and requires holding a privileged
// key in the API process for something that needs no privilege at all.
import { createRemoteJWKSet, jwtVerify, errors as joseErrors } from "jose";

const SUPABASE_URL = (
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  ""
).replace(/\/$/, "");

if (!SUPABASE_URL) {
  console.warn(
    "[auth] SUPABASE_URL is not set — every authenticated request will fail. " +
      "Set SUPABASE_URL=https://<ref>.supabase.co in the API environment."
  );
}

// GoTrue issues tokens with iss = "<project>/auth/v1" and, for signed-in
// end users, aud = "authenticated". Pinning both means a token minted by
// some *other* Supabase project can't be replayed against this API.
const ISSUER = `${SUPABASE_URL}/auth/v1`;
const AUDIENCE = "authenticated";

// Lazily built so a missing SUPABASE_URL surfaces as a clean auth error
// on the first request rather than a module-load crash that takes the
// whole API process down at boot.
let _jwks = null;
function getJwks() {
  if (!_jwks) {
    if (!SUPABASE_URL) throw new Error("SUPABASE_URL is not configured");
    _jwks = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`));
  }
  return _jwks;
}

// Normalises a GoTrue token payload into the same shape the rest of the
// backend already consumed from Firebase, so call sites don't branch on
// provider. Firebase → Supabase claim mapping:
//
//   uid                        → sub
//   email                      → email
//   name                       → user_metadata.full_name / .name
//   picture                    → user_metadata.avatar_url / .picture
//   email_verified             → user_metadata.email_verified (or top level)
//   firebase.sign_in_provider  → app_metadata.provider
//
// OAuth providers populate user_metadata differently (Google sends
// full_name AND name; Azure sends name only), so we accept either.
function normalizeClaims(payload) {
  const meta = payload.user_metadata || {};
  const app = payload.app_metadata || {};
  return {
    uid: payload.sub,
    email: payload.email || meta.email || null,
    name: meta.full_name || meta.name || "",
    picture: meta.avatar_url || meta.picture || null,
    emailVerified: Boolean(payload.email_verified ?? meta.email_verified),
    provider: app.provider || null,
    // Kept so downstream code can read anything we didn't map.
    raw: payload,
  };
}

// Verifies a Supabase access token and returns normalised claims.
// Throws on invalid/expired tokens — the caller decides the HTTP shape.
// Expired tokens are re-thrown with code "auth/id-token-expired" so
// lib/auth.js's existing 401 + token_expired branch keeps working
// unchanged.
export async function verifyAccessToken(token) {
  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return normalizeClaims(payload);
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      const e = new Error("Token expired");
      e.code = "auth/id-token-expired";
      throw e;
    }
    throw err;
  }
}
