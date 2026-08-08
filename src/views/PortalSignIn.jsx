"use client";

// Portal sign-in — shared component for /admin, /owner, /moe.
//
// Privileged-role accounts (admin/super_admin/owner/moe) sign in here
// instead of through the marketing landing funnel. The page is intentionally
// minimal: no plan picker, no legal checkbox, no marketing fluff. Just the
// Murchid mark, the portal name, and the two providers.
//
// Auth flow:
//   1. Mount → if a Firebase session already exists, hit /api/auth/me
//      and short-circuit if the role matches the portal.
//   2. Otherwise show Google / Microsoft buttons.
//   3. After provider popup resolves → POST /api/auth/supabase (no plan).
//      Privileged emails are seeded server-side OR resolved via env, so
//      this returns the teacher row with the correct role.
//   4. If the returned role is NOT one of the portal's allowedRoles,
//      sign out of Firebase and surface a clear rejection message so the
//      user can try the right portal.

import React, { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useT, LangToggle } from "../lib/i18n";
import MurchidLogo from "../components/MurchidLogo";
import { api } from "./_shared";
import { exitPortalToStudio } from "../lib/portal";
import { setAccount } from "../lib/account";
import { setRole } from "../lib/role";
import BrandLoader from "../components/BrandLoader";

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden focusable="false">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}
function OutlookMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden focusable="false">
      <rect x="1"   y="1"   width="7.4" height="7.4" fill="#F25022" />
      <rect x="9.6" y="1"   width="7.4" height="7.4" fill="#7FBA00" />
      <rect x="1"   y="9.6" width="7.4" height="7.4" fill="#00A4EF" />
      <rect x="9.6" y="9.6" width="7.4" height="7.4" fill="#FFB900" />
    </svg>
  );
}

export default function PortalSignIn({ portal }) {
  const t = useT();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(true);

  // On mount, see if Firebase already has a session for this browser.
  // If so, hit /api/auth/me — if the canonical role matches this portal,
  // skip straight to the studio (saves a click for returning admins).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api("/api/auth/me");
        if (cancelled) return;
        if (portal.allowedRoles.includes(me.role)) {
          hydrateAccountFromTeacher(me);
          exitPortalToStudio();
          return;
        }
        // Signed in but with the wrong role for this portal. Don't
        // auto-sign-out — they might want to switch accounts manually.
        setError({ kind: "wrong_role", role: me.role });
      } catch {
        // 401 / no-session / no-row — leave the buttons visible.
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [portal.id]);

  const handleProvider = async (provider) => {
    setError(null);
    setSigningIn(true);
    try {
      const lib = await import("../lib/supabaseAuth");
      const fbAuth = provider === "google"
        ? await lib.signInWithGoogle()
        : await lib.signInWithMicrosoft();

      // Bootstrap on the server. No `plan` is sent — privileged emails
      // skip the plan gate on the backend; for non-privileged emails the
      // server returns `plan_required`, which we surface as "not authorized
      // for this portal".
      let teacher;
      try {
        teacher = await api("/api/auth/supabase", { method: "POST", body: {} });
      } catch (e) {
        if (e.code === "plan_required") {
          await lib.signOut().catch(() => {});
          setError({ kind: "not_authorized" });
          setSigningIn(false);
          return;
        }
        throw e;
      }

      if (!portal.allowedRoles.includes(teacher.role)) {
        await lib.signOut().catch(() => {});
        setError({ kind: "wrong_role", role: teacher.role });
        setSigningIn(false);
        return;
      }

      hydrateAccountFromTeacher(teacher);
      exitPortalToStudio();
    } catch (e) {
      if (e?.code !== "auth/popup-closed-by-user" && e?.code !== "auth/cancelled-popup-request") {
        setError({ kind: "unknown", message: e?.message || String(e) });
      }
      setSigningIn(false);
    }
  };

  // The studio reads localStorage for the sidebar / nav chip. Mirror
  // enough of the teacher row that the chip and avatar render correctly
  // — canonical data still lives on req.account server-side. Also write
  // a role into the `murchid_role` localStorage key (via setRole) so
  // App.jsx's role-based routing picks the right console.
  //
  // Dev preview: when the dev role enters a non-dev portal (/admin,
  // /moe, /owner, /superadmin), we want the studio to render THAT
  // portal's console instead of the Dev console — dev is the universal
  // tester and needs to be able to see what each role sees. The
  // server-side role stays `dev` (so every API works), only the local
  // UI preview is overridden. Falls back to the canonical role for
  // everyone else.
  function hydrateAccountFromTeacher(teacher) {
    setAccount({
      provider: "google", // either provider hydrates the same shape
      plan: teacher.subscription_plan || "annual",
      profile: {
        firstName: teacher.first_name || "",
        lastName:  teacher.last_name  || "",
        email:     teacher.email      || "",
        avatarUrl: teacher.avatar_url || "",
      },
      role:     teacher.role,
      sub_role: teacher.sub_role || null,
      subscriptionStatus: teacher.subscription_status,
      subscriptionEndsAt: teacher.subscription_ends_at,
    });
    const localRole =
      teacher.role === "dev" && portal.previewRoleForDev
        ? portal.previewRoleForDev
        : teacher.role;
    setRole(localRole);
  }

  if (checking) {
    return <BrandLoader />;
  }

  return (
    <div className="min-h-screen bg-paper" dir="auto">
      {/* Header */}
      <header className="px-6 md:px-12 py-6 flex items-center justify-between">
        <a href="/" className="inline-flex items-center gap-2.5 text-ink hover:opacity-80 transition">
          <MurchidLogo className="h-7 w-auto" />
        </a>
        <LangToggle />
      </header>

      <main className="px-6 md:px-12 pb-16 pt-12 md:pt-24">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-10">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted mb-3 inline-flex items-center gap-2.5">
              <span className="w-6 h-px bg-accent" /> {t(portal.eyebrowKey)}
            </p>
            <h1 className="font-serif text-4xl md:text-5xl font-medium text-ink leading-tight mb-3">
              {t(portal.titleKey)}{" "}
              <em className="italic font-light text-accent">{t(portal.titleEmKey)}</em>
            </h1>
            <p className="text-muted text-sm md:text-base max-w-sm mx-auto">
              {t(portal.leadKey)}
            </p>
          </div>

          <div className="space-y-3 mb-6">
            <ProviderButton
              icon={<GoogleMark />}
              label={signingIn ? t("portal.opening") : t("portal.continueGoogle")}
              onClick={() => handleProvider("google")}
              disabled={signingIn}
            />
            {/* Microsoft is not live yet — the Supabase project reports
                azure: false and it needs an Azure app registration of its
                own. Marked rather than removed, and wired to nothing so
                it cannot fail. See the .tsx portal screen for the same. */}
            <ProviderButton
              icon={<OutlookMark />}
              label={`${t("portal.continueMicrosoft")} · ${t("portal.comingSoon")}`}
              onClick={() => {}}
              disabled
            />
          </div>

          {error && (
            <div className="bg-paper border border-accent rounded-lg p-4 mb-6">
              <p className="font-mono text-[10px] uppercase tracking-wider text-accent mb-1.5">
                {t("portal.error.eyebrow")}
              </p>
              <p className="text-sm text-ink">
                {error.kind === "not_authorized" || error.kind === "wrong_role"
                  ? t("portal.error.notAuthorized")
                  : error.message || t("portal.error.unknown")}
              </p>
            </div>
          )}

          {/* Footer — link back to the teacher landing */}
          <div className="text-center mt-12 pt-8 border-t border-line">
            <p className="text-xs text-muted mb-3">{t("portal.footer.notHere")}</p>
            <a
              href="/"
              className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-ink hover:text-accent transition"
            >
              {t("portal.footer.toLanding")}
              <ArrowRight size={12} />
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

function ProviderButton({ icon, label, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl text-sm font-medium transition border bg-paper text-ink ${
        disabled ? "cursor-not-allowed opacity-50" : "border-line hover:border-ink hover:-translate-y-px"
      }`}
    >
      <span className="flex-shrink-0 inline-flex">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
