"use client";

// =====================================================================
// Point this deployed frontend at a backend on your own machine
//
// Only exists in a preview build. StudioShell imports it lazily behind
// ALLOW_API_OVERRIDE, so with the flag unset the chunk is never
// requested and none of this reaches a teacher's browser. See
// src/shared/lib/apiBase.ts for why the override has to live in the
// browser at all, and why it is gated on a build flag rather than on a
// gesture.
//
// What it does NOT do is hide. The whole reason a hidden entrance was
// worth considering — keeping it away from real users — is already
// solved by the build flag, and a five-click easter egg on a control
// that already does something else would break that control's normal
// behaviour to buy nothing. So in a preview build it is simply visible,
// and it states the current target rather than making you remember it.
// =====================================================================

import { useEffect, useState, useSyncExternalStore } from "react";
import { Plug, X } from "lucide-react";
import {
  readApiOverride, readApiOverrideOnServer, subscribeApiBase, validateApiBase,
  writeApiOverride,
} from "@/shared/lib/apiBase";
import { API_BASE } from "@/config/env";
import s from "./DevApiEndpoint.module.css";

const PRESETS = ["http://localhost:3001", "http://127.0.0.1:3001", "http://localhost:8080"];

export default function DevApiEndpoint() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  // The override lives in localStorage, not in React. Reading it through
  // the store keeps this chip, the panel and a second tab in step, and
  // keeps the server render and the hydrating client agreeing.
  const current = useSyncExternalStore(
    subscribeApiBase,
    readApiOverride,
    readApiOverrideOnServer
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const check = draft.trim() ? validateApiBase(draft) : null;
  const canSave = !draft.trim() || (check?.ok ?? false);

  const openPanel = () => {
    setDraft(readApiOverride());
    setOpen(true);
  };

  const save = () => {
    if (!draft.trim()) { writeApiOverride(""); setOpen(false); return; }
    if (!check?.ok) return;
    writeApiOverride(check.value);
    setOpen(false);
  };

  const effective = current || API_BASE || "same origin → next.config rewrite";

  return (
    <>
      <button
        type="button"
        className={s.chip}
        data-on={!!current}
        onClick={openPanel}
        title={current ? `API calls go to ${current}` : "API calls use the normal rewrite"}
      >
        <Plug size={13} className={s.chipIcon} />
        <span className={s.chipText}>
          <b>API endpoint</b>
          {current || "default"}
        </span>
      </button>

      {open && (
        <div
          className={s.scrim}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
          role="dialog"
          aria-modal="true"
          aria-label="API endpoint"
        >
          <div className={s.panel}>
            <div className={s.head}>
              <h2 className={s.title}>API endpoint</h2>
              <span className={s.badge}>Preview build</span>
              <button type="button" className={s.close} onClick={() => setOpen(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            <p className={s.lede}>
              Sends every <code>/api/*</code> call straight from this browser to
              the origin you name, instead of through the server-side rewrite.
              Lets you test this deployed frontend against a backend running on
              your machine, with no deploy.
            </p>

            <label className={s.label} htmlFor="dev-api-base">Origin</label>
            <input
              id="dev-api-base"
              className={s.input}
              data-bad={check ? check.ok === false : false}
              value={draft}
              spellCheck={false}
              autoComplete="off"
              placeholder="http://localhost:3001"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && canSave) save(); }}
            />

            {check && check.ok === false && (
              <p className={`${s.hint} ${s.bad}`}>{check.reason}</p>
            )}
            {check?.ok && !check.local && (
              <p className={`${s.hint} ${s.warn}`}>
                Not a local address. Every request carries your Supabase bearer
                token — only point this at a host you control.
              </p>
            )}
            {!draft.trim() && (
              <p className={s.hint}>Leave empty and save to go back to the normal rewrite.</p>
            )}

            <div className={s.presets}>
              {PRESETS.map((p) => (
                <button key={p} type="button" className={s.preset} onClick={() => setDraft(p)}>
                  {p}
                </button>
              ))}
            </div>

            <div className={s.now}>
              <b>Calls currently go to</b>
              <code>{effective}</code>
            </div>

            <div className={s.note}>
              <strong>Your backend needs CORS.</strong> This is a cross-origin
              request now, so the rewrite is not there to hide it. On the local
              server allow this exact origin, the two auth headers, and — for
              Chrome, which treats a public page reaching localhost as a private
              network request — the PNA preflight header.
              <pre>{`Access-Control-Allow-Origin: ${typeof window !== "undefined" ? window.location.origin : "<this origin>"}
Access-Control-Allow-Headers: authorization, content-type, x-session-id
Access-Control-Allow-Private-Network: true`}</pre>
              <strong>Safari blocks http://localhost from an https page</strong>{" "}
              regardless of headers. Use a tunnel there — cloudflared or ngrok
              gives you an https origin that works in every browser, and on a
              phone.
            </div>

            <div className={s.actions}>
              {current && (
                <button type="button" className={s.btn} onClick={() => { writeApiOverride(""); setOpen(false); }}>
                  Reset to default
                </button>
              )}
              <span className={s.spacer} />
              <button type="button" className={s.btn} onClick={() => setOpen(false)}>Cancel</button>
              <button type="button" className={`${s.btn} ${s.btnMain}`} onClick={save} disabled={!canSave}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
