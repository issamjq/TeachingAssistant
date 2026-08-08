"use client";

// Portal sign-in — shared by /dev, /superadmin, /admin, /owner, /moe.
//
// Privileged-role accounts sign in here instead of through the marketing
// landing funnel. The page is intentionally minimal: no plan picker, no legal
// checkbox, no marketing fluff. Just the Murchid mark, the portal name, and
// the two providers.
//
// Auth flow:
//   1. Mount → if a Supabase session already exists, hit /api/auth/me and
//      short-circuit if the role matches the portal.
//   2. Otherwise show Google / Microsoft buttons.
//   3. Clicking one redirects the whole page to the provider. On return,
//      the mount effect runs again and POSTs /api/auth/supabase (no plan).
//      Privileged emails are seeded server-side OR resolved via env, so this
//      returns the account row with the correct role.
//   4. If the returned role is NOT one of the portal's allowedRoles, sign out
//      of Supabase and surface a clear rejection so the user can try the
//      right portal.
//
// Note the shape of step 3: Supabase OAuth is a top-level redirect, not
// Firebase's popup, so sign-in spans two page loads and provisioning has
// to happen on mount rather than after the click.
//
// Migrated from views/PortalSignIn.jsx. The one behavioural change: the
// portal is now passed in by its route segment rather than sniffed from
// window.location.pathname, and exiting navigates through the router instead
// of a raw history.replaceState.

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useT, LangToggle } from "@/shared/i18n";
import type { TranslationKey } from "@/shared/i18n";
import { api, ApiError } from "@/shared/lib/apiClient";
import { replace } from "@/lib/route";
import { setAccount } from "@/lib/account";
import { setRole } from "@/lib/role";
import type { Portal } from "@/lib/portal";
import type { Role } from "@/shared/types/domain";
import MurchidLogo from "@/components/MurchidLogo";
import BrandLoader from "@/components/BrandLoader";
import { GoogleMark, OutlookMark } from "./ProviderMarks";

// Shape of the account row returned by /api/auth/me and /api/auth/supabase.
interface AccountRow {
  role: Role;
  sub_role?: string | null;
  first_name?: string;
  last_name?: string;
  email?: string;
  avatar_url?: string;
  subscription_plan?: string;
  subscription_status?: string;
  subscription_ends_at?: string | null;
}

type PortalError =
  | { kind: "wrong_role"; role: Role }
  | { kind: "not_authorized" }
  | { kind: "unknown"; message: string };

export default function PortalSignIn({ portal }: { portal: Portal }) {
  const t = useT();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<PortalError | null>(null);
  const [checking, setChecking] = useState(true);

  // The studio reads localStorage for the sidebar / nav chip. Mirror enough
  // of the account row that the chip and avatar render correctly — canonical
  // data still lives on req.account server-side. Also writes a role into the
  // `murchid_role` key (via setRole) so role-based routing picks the right
  // console.
  //
  // Dev preview: when the dev role enters a non-dev portal, render THAT
  // portal's console instead of the Dev console — dev is the universal tester
  // and needs to see what each role sees. The server-side role stays `dev`
  // (so every API still works); only the local UI preview is overridden.
  function hydrateAccountFromRow(row: AccountRow) {
    setAccount({
      provider: "google", // either provider hydrates the same shape
      plan: (row.subscription_plan as never) || "annual",
      profile: {
        firstName: row.first_name || "",
        lastName: row.last_name || "",
        email: row.email || "",
        avatarUrl: row.avatar_url || "",
      },
      role: row.role,
      sub_role: (row.sub_role as never) || null,
      subscriptionStatus: row.subscription_status as never,
      subscriptionEndsAt: row.subscription_ends_at ?? null,
    });
    const localRole =
      row.role === "dev" && portal.previewRoleForDev
        ? portal.previewRoleForDev
        : row.role;
    setRole(localRole);
  }

  // After a successful sign-in, leave the portal for the studio. The studio's
  // role-based routing bounces to the right console for whatever role just
  // signed in, and a refresh on /dashboard re-enters the studio rather than
  // the portal.
  function exitToStudio() {
    replace(["dashboard"]);
  }

  // Provision the account row for a browser that already holds a Supabase
  // session, then enter the studio. Split out of the click handler because
  // with Supabase's redirect flow the click and the provisioning happen on
  // opposite sides of a full page navigation — see handleProvider below.
  async function completeSignIn() {
    const lib = await import("@/lib/supabaseAuth");
    // No `plan` is sent — privileged emails skip the plan gate on the
    // backend; for non-privileged emails the server returns
    // `plan_required`, surfaced here as "not authorized".
    let row: AccountRow;
    try {
      row = await api<AccountRow>("/api/auth/supabase", {
        method: "POST",
        body: {},
      });
    } catch (e) {
      if (e instanceof ApiError && e.code === "plan_required") {
        await lib.signOut().catch(() => {});
        setError({ kind: "not_authorized" });
        return;
      }
      throw e;
    }

    if (!portal.allowedRoles.includes(row.role)) {
      await lib.signOut().catch(() => {});
      setError({ kind: "wrong_role", role: row.role });
      return;
    }

    hydrateAccountFromRow(row);
    exitToStudio();
  }

  // On mount, work out whether this browser is already signed in — which
  // now covers two cases, not one:
  //
  //   a) a returning admin whose session was restored from storage, and
  //   b) a user landing back here from the OAuth provider, because
  //      Supabase redirects the whole page instead of using a popup.
  //
  // Both look identical by the time this runs: supabase-js has exchanged
  // the ?code= and there's a live session. The difference only shows up
  // at /api/auth/me — a returning admin has an account row, whereas a
  // first-time sign-in 404s with no_teacher_row and needs provisioning.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getCurrentUser } = await import("@/lib/supabaseAuth");
        const user = await getCurrentUser();
        if (cancelled) return;
        if (!user) return; // not signed in — show the buttons

        try {
          const me = await api<AccountRow>("/api/auth/me");
          if (cancelled) return;
          if (portal.allowedRoles.includes(me.role)) {
            hydrateAccountFromRow(me);
            exitToStudio();
            return;
          }
          // Signed in but with the wrong role for this portal. Don't
          // auto-sign-out — they might want to switch accounts manually.
          setError({ kind: "wrong_role", role: me.role });
        } catch (e) {
          // Valid token, no account row yet: this is the first sign-in
          // completing after the provider redirect. Provision now.
          if (e instanceof ApiError && e.code === "no_teacher_row") {
            if (!cancelled) await completeSignIn();
            return;
          }
          // 401 / no session — leave the buttons visible.
        }
      } catch (e) {
        if (!cancelled) {
          setError({
            kind: "unknown",
            message: e instanceof Error ? e.message : String(e),
          });
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portal.id]);

  // Kick off the provider redirect. Unlike Firebase's signInWithPopup,
  // this never resolves with a user — the browser navigates away to the
  // provider and comes back to this same route, where the mount effect
  // above picks the flow back up. So there is deliberately no code after
  // the call: anything here would not run.
  const handleProvider = async (provider: "google" | "microsoft") => {
    setError(null);
    setSigningIn(true);
    try {
      const lib = await import("@/lib/supabaseAuth");
      await (provider === "google"
        ? lib.signInWithGoogle()
        : lib.signInWithMicrosoft());
    } catch (e) {
      setError({
        kind: "unknown",
        message: e instanceof Error ? e.message : String(e),
      });
      setSigningIn(false);
    }
  };

  if (checking) return <BrandLoader />;

  return (
    <div className="min-h-screen bg-paper" dir="auto">
      <header className="px-6 md:px-12 py-6 flex items-center justify-between">
        <a
          href="/"
          className="inline-flex items-center gap-2.5 text-ink hover:opacity-80 transition"
        >
          <MurchidLogo className="h-7 w-auto" />
        </a>
        <LangToggle />
      </header>

      <main className="px-6 md:px-12 pb-16 pt-12 md:pt-24">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-10">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted mb-3 inline-flex items-center gap-2.5">
              <span className="w-6 h-px bg-accent" />{" "}
              {t(portal.eyebrowKey as TranslationKey)}
            </p>
            <h1 className="font-serif text-4xl md:text-5xl font-medium text-ink leading-tight mb-3">
              {t(portal.titleKey as TranslationKey)}{" "}
              <em className="italic font-light text-accent">
                {t(portal.titleEmKey as TranslationKey)}
              </em>
            </h1>
            <p className="text-muted text-sm md:text-base max-w-sm mx-auto">
              {t(portal.leadKey as TranslationKey)}
            </p>
          </div>

          <div className="space-y-3 mb-6">
            <ProviderButton
              icon={<GoogleMark />}
              label={signingIn ? t("portal.opening") : t("portal.continueGoogle")}
              onClick={() => handleProvider("google")}
              disabled={signingIn}
            />
            <ProviderButton
              icon={<OutlookMark />}
              label={
                signingIn ? t("portal.opening") : t("portal.continueMicrosoft")
              }
              onClick={() => handleProvider("microsoft")}
              disabled={signingIn}
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

function ProviderButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl text-sm font-medium transition border bg-paper text-ink ${
        disabled
          ? "cursor-not-allowed opacity-50"
          : "border-line hover:border-ink hover:-translate-y-px"
      }`}
    >
      <span className="flex-shrink-0 inline-flex">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
