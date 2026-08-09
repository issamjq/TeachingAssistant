"use client";

import React, { useState, useEffect } from "react";
import { Mail, Phone, Globe, Pencil, User, GraduationCap, Building2, Palette } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NATIONALITIES } from "../lib/enums";
import { Field, Modal, inputClasses, selectClasses, api } from "./_shared";
import AppearanceSettings from "../features/account/components/AppearanceSettings";
import { navigate } from "../lib/route";
import DatabaseProfile from "./DatabaseProfile";
import DatabaseSchools from "./DatabaseSchools";
import Avatar from "../components/Avatar";
import { avatarsFor } from "../lib/avatars";
import { useAccount, updateProfile } from "../lib/account";
import BrandLoader from "../components/BrandLoader";

const initials = (first, last) =>
  `${(first || "")[0] || ""}${(last || "")[0] || ""}`.toUpperCase();

// Settings page — tabbed. Tab 1 is the lightweight contact-info form
// (name / email / phone / nationality). Tab 2 embeds the full teaching
// profile that used to live inside "My students".
//
// `sub` comes from the URL (#/account/teaching → "teaching"). Anything
// unrecognised falls back to the personal tab.
export default function AccountProfile({ sub }) {
  const active =
    sub === "teaching"   ? "teaching"   :
    sub === "schools"    ? "schools"    :
    sub === "appearance" ? "appearance" :
    "personal";
  return (
    <div>
      <header className="mb-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
          <span className="w-6 h-px bg-accent" /> Settings
        </p>
        <h2 className="font-serif text-4xl font-medium text-ink">
          Your <em className="italic font-light text-accent">account</em>
        </h2>
      </header>

      <Tabs active={active} />

      {active === "personal" && <PersonalDetails />}
      {active === "teaching" && <DatabaseProfile />}
      {active === "schools"  && <DatabaseSchools />}
      {active === "appearance" && <AppearanceSettings />}
    </div>
  );
}

function Tabs({ active }) {
  const items = [
    { key: "personal", label: "Personal details", icon: User, route: ["account"] },
    { key: "teaching", label: "Teaching profile", icon: GraduationCap, route: ["account", "teaching"] },
    { key: "schools",  label: "My schools",       icon: Building2,     route: ["account", "schools"] },
    { key: "appearance", label: "Appearance",     icon: Palette,       route: ["account", "appearance"] },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-line mb-6">
      {items.map(({ key, label, icon: Icon, route }) => {
        const on = active === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => navigate(route)}
            aria-current={on ? "page" : undefined}
            className={`inline-flex items-center gap-2 px-3 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
              on
                ? "border-accent text-ink"
                : "border-transparent text-muted hover:text-ink hover:border-line"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

// Personal details — the previous AccountProfile body, lifted into its
// own component so the parent can decide which tab to render.
function PersonalDetails() {
  const account = useAccount();
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [pickingAvatar, setPickingAvatar] = useState(false);
  const avatarId = account?.profile?.avatar || "";
  // Gender drives which avatar set the picker shows. Prefer the saved value;
  // otherwise infer from the current avatar's id (w* = woman), else default man.
  const gender = account?.profile?.gender || (avatarId.startsWith("w") ? "woman" : "man");

  useEffect(() => {
    api("/api/me")
      .then((data) => {
        setMe(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const onSaved = (updated) => {
    setMe(updated);
    setEditing(false);
  };

  return (
    <div>
      <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <p className="text-muted">
          How the school reaches you. Languages, majors, and grades you teach live under the Teaching profile tab.
        </p>
        {me && (
          <Button onClick={() => setEditing(true)}>
            <Pencil size={14} className="mr-2" /> Edit details
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent mb-1">
            Could not load your account
          </p>
          <p className="text-sm text-ink-soft">{error}</p>
        </div>
      )}

      {loading && <BrandLoader compact fullscreen={false} />}

      {me && (
        <Card>
          <CardContent className="p-8">
            <div className="flex items-center gap-5 mb-6">
              <button
                type="button"
                onClick={() => setPickingAvatar(true)}
                title="Change avatar"
                aria-label="Change avatar"
                className="relative group rounded-full flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper-cool"
              >
                <Avatar
                  avatarId={avatarId}
                  photoUrl={me.avatar_url || account?.profile?.avatarUrl}
                  initial={initials(me.first_name, me.last_name)}
                  size={64}
                />
                <span className="absolute inset-0 rounded-full bg-ink/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Pencil size={15} className="text-paper-cool" />
                </span>
              </button>
              <div className="min-w-0 flex-1">
                <h3 className="font-serif text-3xl text-ink leading-tight">
                  {me.first_name} {me.last_name}
                </h3>
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted mt-1.5">
                  Teacher
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 pt-6 border-t border-line">
              <Stat label="Staff ID" value={me.staff_id || "—"} icon={<User size={13} />} mono />
              <Stat label="Email" value={me.email || "—"} icon={<Mail size={13} />} />
              <Stat label="Phone" value={me.phone || "—"} icon={<Phone size={13} />} mono />
              <Stat label="Nationality" value={me.nationality || "—"} icon={<Globe size={13} />} />
            </div>
          </CardContent>
        </Card>
      )}

      {editing && (
        <AccountEditModal initial={me} onClose={() => setEditing(false)} onSaved={onSaved} />
      )}

      {pickingAvatar && (
        <AvatarPickerModal
          currentAvatar={avatarId}
          currentGender={gender}
          onClose={() => setPickingAvatar(false)}
          onSave={(g, id) => {
            updateProfile({ gender: g, avatar: id });
            setPickingAvatar(false);
          }}
        />
      )}
    </div>
  );
}

// Avatar picker — shown from the account card. Shows the portrait set that
// matches the chosen gender, with a Man/Woman toggle to switch sets. Both the
// gender and the chosen avatar persist into the localStorage account profile,
// which the sidebar and landing nav read.
function AvatarPickerModal({ currentAvatar, currentGender, onClose, onSave }) {
  const [gender, setGender] = useState(currentGender || "man");
  const [sel, setSel] = useState(currentAvatar || "");

  // Switching sets drops a selection that doesn't belong to the new gender.
  const chooseGender = (g) => {
    setGender(g);
    setSel((cur) => (avatarsFor(g).some((a) => a.id === cur) ? cur : ""));
  };

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="Your account"
      title="Choose your avatar"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(gender, sel)}>Save avatar</Button>
        </>
      }
    >
      <p className="text-sm text-muted mb-4">
        Pick a portrait to represent you across Murchid. Tap the selected one again to clear it.
      </p>
      <div className="flex gap-2 mb-5">
        {["man", "woman"].map((g) => {
          const on = gender === g;
          return (
            <button
              key={g}
              type="button"
              onClick={() => chooseGender(g)}
              aria-pressed={on}
              className={`px-4 py-1.5 rounded-full text-[12.5px] font-medium border transition-colors ${
                on
                  ? "bg-ink text-paper-cool border-ink"
                  : "bg-paper-cool text-ink border-line hover:border-ink"
              }`}
            >
              {g === "man" ? "Man" : "Woman"}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3">
        {avatarsFor(gender).map((a) => {
          const on = sel === a.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setSel(on ? "" : a.id)}
              aria-pressed={on}
              aria-label="Choose avatar"
              style={{
                padding: 0,
                border: 0,
                background: "none",
                cursor: "pointer",
                borderRadius: "50%",
                lineHeight: 0,
                transition: "box-shadow 150ms, transform 150ms",
                boxShadow: on
                  ? "0 0 0 3px var(--color-clay)"
                  : "0 0 0 1px var(--color-line)",
                transform: on ? "scale(1.05)" : "none",
              }}
            >
              <Avatar avatarId={a.id} size={56} />
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

function Stat({ label, value, icon, mono = false }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-1 inline-flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <p className={`text-sm text-ink ${mono ? "font-mono text-[12px] text-ink-soft" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function AccountEditModal({ initial, onClose, onSaved }) {
  const [form, setForm] = useState({
    first_name: initial.first_name || "",
    last_name: initial.last_name || "",
    staff_id: initial.staff_id || "",
    email: initial.email || "",
    phone: initial.phone || "",
    nationality: initial.nationality || "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true);
    setErr(null);
    try {
      const updated = await api("/api/me", { method: "PATCH", body: form });
      // Mirror name + email into the local account.profile so the
      // sidebar chip and account menu reflect the edit immediately,
      // without waiting for the next /api/me hydration on reload.
      updateProfile({
        firstName: updated.first_name || "",
        lastName: updated.last_name || "",
        staffId: updated.staff_id || "",
        email: updated.email || "",
      });
      onSaved(updated);
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="Edit account"
      title="Update your details"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </>
      }
    >
      {err && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-3">
          <p className="text-sm text-accent">{err}</p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="First name">
          <input
            className={inputClasses}
            value={form.first_name}
            onChange={(e) => set("first_name", e.target.value)}
          />
        </Field>
        <Field label="Last name">
          <input
            className={inputClasses}
            value={form.last_name}
            onChange={(e) => set("last_name", e.target.value)}
          />
        </Field>
        <Field label="Staff ID" hint="As issued by your school">
          <input
            className={inputClasses}
            value={form.staff_id}
            onChange={(e) => set("staff_id", e.target.value)}
            placeholder="e.g. T-1042"
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            className={inputClasses}
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>
        <Field label="Phone">
          <input
            className={inputClasses}
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </Field>
        <div className="md:col-span-2">
          <Field label="Nationality">
            <select
              className={selectClasses}
              value={form.nationality || ""}
              onChange={(e) => set("nationality", e.target.value)}
            >
              <option value="">—</option>
              {NATIONALITIES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}
