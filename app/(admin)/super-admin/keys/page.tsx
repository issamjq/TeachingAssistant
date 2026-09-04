"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getKeyPool,
  addKeys,
  updateKey,
  removeKey,
  updateKeyPoolSettings,
  type KeyPoolSnapshot,
  type LlmKeyRow,
  type AddKeysResult,
} from "@/lib/data/keypool";
import { BackendError } from "@/lib/data/backend";

function statusBadge(key: LlmKeyRow) {
  const resting = key.status === "active" && key.cooldown_until && new Date(key.cooldown_until) > new Date();
  if (resting) {
    return (
      <Badge variant="warning">
        Resting until {new Date(key.cooldown_until!).toLocaleString()}
      </Badge>
    );
  }
  if (key.status === "active") return <Badge variant="success">In use</Badge>;
  if (key.status === "probation") return <Badge variant="destructive">Refused — needs a human</Badge>;
  return <Badge variant="outline">Off</Badge>;
}

export default function SuperAdminKeysPage() {
  const [snapshot, setSnapshot] = useState<KeyPoolSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [addBlob, setAddBlob] = useState("");
  const [addNote, setAddNote] = useState("");
  const [adding, setAdding] = useState(false);
  const [addResult, setAddResult] = useState<AddKeysResult | null>(null);

  const [floorDraft, setFloorDraft] = useState("");
  const [cooldownDraft, setCooldownDraft] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  const refresh = useCallback(() => {
    getKeyPool()
      .then((s) => {
        setSnapshot(s);
        setFloorDraft(String(s.settings.min_active_keys));
        setCooldownDraft(String(s.settings.cooldown_minutes));
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load the key pool"));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleAdd() {
    if (!addBlob.trim() || adding) return;
    setAdding(true);
    setAddResult(null);
    setError(null);
    try {
      const result = await addKeys(addBlob, addNote.trim() || undefined);
      setAddResult(result);
      setAddBlob("");
      setAddNote("");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add keys");
    } finally {
      setAdding(false);
    }
  }

  async function handlePatch(id: number, patch: { status?: LlmKeyRow["status"]; clear_cooldown?: boolean }) {
    setBusyId(id);
    setError(null);
    try {
      await updateKey(id, patch);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update key");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(id: number) {
    if (!confirm("Remove this key permanently?")) return;
    setBusyId(id);
    setError(null);
    try {
      await removeKey(id);
      refresh();
    } catch (e) {
      setError(e instanceof BackendError ? e.message : "Failed to remove key");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    setError(null);
    try {
      await updateKeyPoolSettings({
        min_active_keys: Number(floorDraft),
        cooldown_minutes: Number(cooldownDraft),
      });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="API keys"
        description="The OpenRouter key pool that generation draws on. Values are never shown — only added, tended, and retired."
      />
      <div className="space-y-6 p-6 md:p-8">
        {error ? (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : null}

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <StatCard
            label="Usable now"
            value={snapshot ? String(snapshot.usable) : "…"}
            hint={snapshot ? `floor is ${snapshot.settings.min_active_keys}` : undefined}
            trend={
              snapshot && snapshot.usable <= snapshot.settings.min_active_keys ? "down" : undefined
            }
          />
          <StatCard label="Total keys" value={snapshot ? String(snapshot.keys.length) : "…"} />
          <StatCard
            label="Cooldown"
            value={snapshot ? `${snapshot.settings.cooldown_minutes}m` : "…"}
          />
        </div>

        {snapshot === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : snapshot.keys.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title="No keys in the pool"
            description="Paste one or more OpenRouter keys below to get started."
          />
        ) : (
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {snapshot.keys.map((k) => (
                <div key={k.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-medium">{k.label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {k.masked}
                      {k.note ? ` · ${k.note}` : ""}
                      {k.last_ok_at ? ` · last ok ${new Date(k.last_ok_at).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(k)}
                    {k.status === "active" && k.cooldown_until ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === k.id}
                        onClick={() => handlePatch(k.id, { clear_cooldown: true })}
                      >
                        Clear cooldown
                      </Button>
                    ) : null}
                    {k.status !== "disabled" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === k.id}
                        onClick={() => handlePatch(k.id, { status: "disabled" })}
                      >
                        Disable
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === k.id}
                        onClick={() => handlePatch(k.id, { status: "active" })}
                      >
                        Enable
                      </Button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemove(k.id)}
                      disabled={busyId === k.id}
                      title="Remove"
                      className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Add keys</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              rows={4}
              placeholder="Paste one or more OpenRouter keys — one per line, or comma/space separated."
              value={addBlob}
              onChange={(e) => setAddBlob(e.target.value)}
              disabled={adding}
            />
            <Input
              placeholder="Note (optional)"
              value={addNote}
              onChange={(e) => setAddNote(e.target.value)}
              disabled={adding}
              className="h-9"
            />
            <p className="text-xs text-muted-foreground">
              Each key is tested before it's stored, one at a time — up to ~20 seconds each, so
              a batch of ten can take a couple of minutes. That's expected, not a hang.
            </p>
            <Button onClick={handleAdd} disabled={adding || !addBlob.trim()}>
              {adding ? "Testing and adding keys…" : "Add keys"}
            </Button>
            {addResult ? (
              <div className="space-y-1 rounded-md border border-border p-3 text-sm">
                <p>
                  Added {addResult.added}
                  {addResult.labels.length > 0 ? ` (${addResult.labels.join(", ")})` : ""}
                </p>
                {addResult.rejected.map((r) => (
                  <p key={r.key} className="text-xs text-destructive">
                    {r.key}: {r.reason}
                  </p>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pool settings</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Minimum active keys</label>
              <Input
                type="number"
                min={0}
                max={50}
                value={floorDraft}
                onChange={(e) => setFloorDraft(e.target.value)}
                className="h-9 w-28"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Cooldown (minutes)</label>
              <Input
                type="number"
                min={5}
                max={2880}
                value={cooldownDraft}
                onChange={(e) => setCooldownDraft(e.target.value)}
                className="h-9 w-28"
              />
            </div>
            <Button size="sm" variant="outline" disabled={savingSettings} onClick={handleSaveSettings}>
              {savingSettings ? "Saving…" : "Save"}
            </Button>
          </CardContent>
        </Card>

        {snapshot && snapshot.events.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {snapshot.events.slice(0, 50).map((e, i) => (
                <div
                  key={`${e.label}-${e.created_at}-${i}`}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className={e.event === "refused" ? "font-medium text-destructive" : ""}>
                    <span className="font-mono">{e.label}</span> — {e.event}
                    {e.detail ? ` (${e.detail})` : ""}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {new Date(e.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
