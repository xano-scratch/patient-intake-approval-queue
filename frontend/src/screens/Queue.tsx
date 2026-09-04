import { useCallback, useEffect, useState } from "react";
import { Ban, Check, Hand, Loader2, RefreshCw, ShieldAlert } from "lucide-react";

import {
  getQueue,
  claimIntake,
  approveIntake,
  denyIntake,
  type QueueRow,
  type Session,
  ApiError,
} from "@/lib/api";
import { PriorityBadge, prettyToken } from "@/lib/format";
import { Detail } from "@/screens/Detail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ActionMsg = { kind: "ok" | "blocked" | "error"; text: string };

export function Queue({
  session,
  selectedId,
  onSelect,
}: {
  session: Session;
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<ActionMsg | null>(null);
  const [denyReason, setDenyReason] = useState("");
  const [detailReload, setDetailReload] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setListError("");
    try {
      setRows(await getQueue());
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Failed to load the queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedRow = rows.find((r) => Number(r.intake_id) === selectedId);

  async function runAction(key: string, fn: () => Promise<unknown>, okText: string) {
    setActionBusy(key);
    setActionMsg(null);
    try {
      await fn();
      setActionMsg({ kind: "ok", text: okText });
      setDenyReason("");
      await load();
      setDetailReload((n) => n + 1);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setActionMsg({
          kind: "blocked",
          text: `Blocked by role (server-side 403): ${e.message}`,
        });
      } else {
        setActionMsg({ kind: "error", text: e instanceof Error ? e.message : "Action failed." });
      }
    } finally {
      setActionBusy(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Left: the queue */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Review queue</CardTitle>
              <CardDescription>Emergent first. Resolved items drop off.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={"size-4 " + (loading ? "animate-spin" : "")} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {listError && <p className="text-destructive text-sm">{listError}</p>}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Priority</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Complaint</TableHead>
                <TableHead>State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const id = Number(r.intake_id);
                return (
                  <TableRow
                    key={id}
                    onClick={() => onSelect(id)}
                    data-state={selectedId === id ? "selected" : undefined}
                    className="cursor-pointer"
                  >
                    <TableCell>
                      <PriorityBadge priority={r.priority} />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{r.patient_name}</div>
                      <div className="text-muted-foreground text-xs">{r.mrn}</div>
                    </TableCell>
                    <TableCell className="max-w-[16rem] truncate text-sm">
                      {r.chief_complaint}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.state === "claimed" ? "secondary" : "outline"}>
                        {r.state}
                      </Badge>
                      {r.state === "claimed" && r.claimed_by_name && (
                        <div className="text-muted-foreground mt-0.5 text-xs">
                          {r.claimed_by_name}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground py-8 text-center text-sm">
                    The queue is empty. Submit and evaluate an intake to fill it.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Right: detail + actions */}
      <div className="space-y-4">
        {selectedId == null ? (
          <Card>
            <CardContent className="text-muted-foreground flex h-64 items-center justify-center text-center text-sm">
              Select a queue item to see the patient, the rule that routed it, and the audit trail.
            </CardContent>
          </Card>
        ) : (
          <>
            <Detail intakeId={selectedId} reloadKey={detailReload} />

            {selectedRow && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Review actions</CardTitle>
                  <CardDescription>
                    Signed in as {session.display_name}. Claim, approve, and deny require the
                    clinician role, enforced on the server.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {actionMsg && (
                    <div
                      className={
                        "flex items-start gap-2 rounded-md border px-3 py-2 text-sm " +
                        (actionMsg.kind === "ok"
                          ? "border-primary/40 bg-primary/5"
                          : "border-destructive/40 bg-destructive/5 text-destructive")
                      }
                    >
                      {actionMsg.kind === "ok" ? (
                        <Check className="mt-0.5 size-4 shrink-0" />
                      ) : (
                        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                      )}
                      <span>{actionMsg.text}</span>
                    </div>
                  )}

                  {selectedRow.state === "open" && (
                    <Button
                      className="w-full"
                      disabled={actionBusy !== null}
                      onClick={() =>
                        void runAction(
                          "claim",
                          () => claimIntake(Number(selectedRow.intake_id)),
                          "Claimed. You now own this review.",
                        )
                      }
                    >
                      {actionBusy === "claim" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <>
                          <Hand className="size-4" /> Claim
                        </>
                      )}
                    </Button>
                  )}

                  {selectedRow.state === "claimed" && (
                    <div className="space-y-3">
                      <Button
                        className="w-full"
                        disabled={actionBusy !== null}
                        onClick={() =>
                          void runAction(
                            "approve",
                            () => approveIntake(Number(selectedRow.intake_id)),
                            "Approved for care.",
                          )
                        }
                      >
                        {actionBusy === "approve" ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="size-4" /> Approve
                          </>
                        )}
                      </Button>
                      <Textarea
                        value={denyReason}
                        onChange={(e) => setDenyReason(e.target.value)}
                        rows={2}
                        placeholder="Reason for denial (recorded on the audit trail)"
                      />
                      <Button
                        variant="destructive"
                        className="w-full"
                        disabled={actionBusy !== null}
                        onClick={() => {
                          if (!denyReason.trim()) {
                            setActionMsg({ kind: "error", text: "A denial needs a reason." });
                            return;
                          }
                          void runAction(
                            "deny",
                            () => denyIntake(Number(selectedRow.intake_id), denyReason.trim()),
                            "Denied. The reason is on the audit trail.",
                          );
                        }}
                      >
                        {actionBusy === "deny" ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <>
                            <Ban className="size-4" /> Deny
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
