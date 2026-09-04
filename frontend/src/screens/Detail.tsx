import { useEffect, useState } from "react";
import { History, Loader2, ShieldCheck, User } from "lucide-react";

import { getDetail, type Criterion, type IntakeDetail, type Priority } from "@/lib/api";
import { PriorityBadge, StatusBadge, formatDateTime, prettyToken } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function Detail({ intakeId, reloadKey }: { intakeId: number; reloadKey?: number }) {
  const [data, setData] = useState<IntakeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    getDetail(intakeId)
      .then((d) => {
        if (alive) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (alive) {
          setError(e instanceof Error ? e.message : "Failed to load intake.");
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [intakeId, reloadKey]);

  if (loading) {
    return (
      <Card>
        <CardContent className="text-muted-foreground flex h-40 items-center justify-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" /> Loading intake #{intakeId}…
        </CardContent>
      </Card>
    );
  }

  if (error || !data?.intake) {
    return (
      <Card>
        <CardContent className="text-destructive flex h-40 items-center justify-center text-sm">
          {error || "Intake not found."}
        </CardContent>
      </Card>
    );
  }

  const { intake, patient, rule, actions } = data;
  const criteria = (rule?.criteria as Criterion[] | undefined) ?? [];
  const matched = String(intake.matched_criteria ?? "");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Intake #{String(intake.id)}
            <StatusBadge status={String(intake.status)} />
          </CardTitle>
          <PriorityBadge priority={(intake.assigned_priority as Priority | null) ?? null} />
        </div>
        <CardDescription className="flex items-center gap-1.5">
          <User className="size-3.5" />
          {patient?.name ?? "Unknown patient"} · MRN {patient?.mrn ?? "—"} · DOB{" "}
          {patient?.date_of_birth ?? "—"} · {prettyToken(String(patient?.insurance_status ?? ""))}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div>
          <div className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
            Chief complaint
          </div>
          <p className="text-sm">{String(intake.chief_complaint)}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(Array.isArray(intake.symptoms) ? (intake.symptoms as string[]) : []).map((s) => (
              <Badge key={s} variant="outline">
                {prettyToken(s)}
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        <div>
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck className="text-primary size-4" />
            <span className="text-sm font-medium">
              Governed decision
              {intake.applied_rule_version ? (
                <span className="text-muted-foreground font-normal">
                  {" "}
                  · triage rules v{String(intake.applied_rule_version)}
                </span>
              ) : null}
            </span>
          </div>
          {matched ? (
            <p className="bg-muted/50 rounded-md border px-3 py-2 text-sm">{matched}</p>
          ) : (
            <p className="text-muted-foreground text-sm">Not yet evaluated.</p>
          )}

          {criteria.length > 0 && (
            <div className="mt-3 space-y-1">
              <div className="text-muted-foreground text-xs">
                Criteria in force (the rule that fired is highlighted):
              </div>
              <ul className="space-y-1">
                {criteria.map((cr, i) => {
                  const fired = cr.reason != null && cr.reason === matched;
                  return (
                    <li
                      key={i}
                      className={
                        "rounded-md border px-2.5 py-1.5 text-xs " +
                        (fired
                          ? "border-primary bg-primary/10 text-foreground"
                          : "text-muted-foreground")
                      }
                    >
                      <span className="font-mono">
                        {cr.field} · {prettyToken(cr.value)}
                      </span>{" "}
                      → <PriorityBadge priority={cr.priority as Priority} />
                      {fired && <span className="text-primary ml-2 font-medium">fired</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <Separator />

        <div>
          <div className="mb-2 flex items-center gap-2">
            <History className="size-4" />
            <span className="text-sm font-medium">Audit trail</span>
            <span className="text-muted-foreground text-xs">append-only</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {actions.map((a) => (
                <TableRow key={String(a.id)}>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatDateTime(a.created_at as number)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{String(a.action)}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {a.actor_name ?? "—"}
                    {a.actor_role ? (
                      <span className="text-muted-foreground"> ({prettyToken(a.actor_role)})</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {String(a.detail ?? "")}
                  </TableCell>
                </TableRow>
              ))}
              {actions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground text-center text-sm">
                    No actions recorded.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
