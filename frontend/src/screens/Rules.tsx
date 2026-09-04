import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, Plus, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";

import {
  getRules,
  activateRules,
  type Criterion,
  type RuleRow,
  type Session,
  ApiError,
} from "@/lib/api";
import { PriorityBadge, formatDateTime, prettyToken } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Msg = { kind: "ok" | "blocked" | "error"; text: string };

const BLANK: Criterion = {
  field: "symptoms",
  op: "contains",
  value: "",
  priority: "urgent",
  reason: "",
};

export function Rules({ session }: { session: Session }) {
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Criterion[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);
  const inited = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await getRules();
      setRows(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load rules.");
    } finally {
      setLoading(false);
    }

    function setRows(rows: RuleRow[]) {
      setRules(rows);
      if (!inited.current) {
        const active = rows.find((r) => r.is_active);
        const current = (active?.criteria as Criterion[] | undefined) ?? [];
        setDraft(current.length ? current.map((c) => ({ ...c })) : [{ ...BLANK }]);
        inited.current = true;
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function updateRow(i: number, patch: Partial<Criterion>) {
    setDraft((d) => d.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  async function publish() {
    if (draft.some((c) => !c.value.trim())) {
      setMsg({ kind: "error", text: "Every criterion needs a value." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await activateRules({
        criteria: draft.map((c) => ({
          field: c.field,
          op: c.op ?? "contains",
          value: c.value.trim(),
          priority: c.priority,
          reason: c.reason?.trim() ? c.reason.trim() : `Matched ${c.field}: ${c.value.trim()}`,
        })),
        note,
      });
      setMsg({ kind: "ok", text: "Published. The new version is now active." });
      setNote("");
      await load();
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setMsg({ kind: "blocked", text: `Blocked by role (server-side 403): ${e.message}` });
      } else {
        setMsg({ kind: "error", text: e instanceof Error ? e.message : "Publish failed." });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Versions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Rule versions</CardTitle>
              <CardDescription>Only one version is active. Older versions are kept, not deleted.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={"size-4 " + (loading ? "animate-spin" : "")} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && <p className="text-destructive text-sm">{error}</p>}
          {rules.map((r) => {
            const criteria = (r.criteria as Criterion[] | undefined) ?? [];
            return (
              <div
                key={String(r.id)}
                className={
                  "rounded-lg border p-3 " + (r.is_active ? "border-primary/50 bg-primary/5" : "")
                }
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Version {String(r.version)}</span>
                    {r.is_active ? (
                      <Badge>active</Badge>
                    ) : (
                      <Badge variant="outline">retired</Badge>
                    )}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {r.activated_by_name ?? "—"} · {formatDateTime(r.created_at as number)}
                  </span>
                </div>
                {r.note ? <p className="text-muted-foreground mt-1 text-xs">{String(r.note)}</p> : null}
                <ul className="mt-2 space-y-1">
                  {criteria.map((c, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs">
                      <span className="font-mono">
                        {c.field} · {prettyToken(c.value)}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <PriorityBadge priority={c.priority as never} />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {!loading && rules.length === 0 && (
            <p className="text-muted-foreground text-sm">No rule versions yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Publish a new version */}
      <Card>
        <CardHeader>
          <CardTitle>Publish a new version</CardTitle>
          <CardDescription>
            Signed in as {session.display_name}. Publishing requires the clinician role. The active
            version is deactivated and this one takes its place.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {msg && (
            <div
              className={
                "flex items-start gap-2 rounded-md border px-3 py-2 text-sm " +
                (msg.kind === "ok"
                  ? "border-primary/40 bg-primary/5"
                  : "border-destructive/40 bg-destructive/5 text-destructive")
              }
            >
              {msg.kind === "ok" ? (
                <Check className="mt-0.5 size-4 shrink-0" />
              ) : (
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              )}
              <span>{msg.text}</span>
            </div>
          )}

          <div className="space-y-2">
            {draft.map((c, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 rounded-md border p-2">
                <Select value={c.field} onValueChange={(v) => updateRow(i, { field: v })}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="symptoms">symptom is</SelectItem>
                    <SelectItem value="chief_complaint">complaint has</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  className="h-8"
                  value={c.value}
                  onChange={(e) => updateRow(i, { value: e.target.value })}
                  placeholder="value"
                />
                <Select value={c.priority} onValueChange={(v) => updateRow(i, { priority: v })}>
                  <SelectTrigger className="h-8 w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="emergent">emergent</SelectItem>
                    <SelectItem value="urgent">urgent</SelectItem>
                    <SelectItem value="routine">routine</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  className="col-span-2 h-8"
                  value={c.reason ?? ""}
                  onChange={(e) => updateRow(i, { reason: e.target.value })}
                  placeholder="reason (shown on the audit trail)"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 self-start"
                  onClick={() => setDraft((d) => d.filter((_, idx) => idx !== i))}
                  aria-label="Remove criterion"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDraft((d) => [...d, { ...BLANK }])}
            >
              <Plus className="size-4" /> Add criterion
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">Version note</Label>
            <Input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What changed and why"
            />
          </div>

          <Button className="w-full" onClick={() => void publish()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Publish new version"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
