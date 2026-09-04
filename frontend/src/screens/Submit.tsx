import { useState, type FormEvent } from "react";
import { ArrowRight, Check, Loader2, Plus, Sparkles, X } from "lucide-react";

import {
  submitIntake,
  evaluateIntake,
  type Intake,
  type SubmitBody,
  ApiError,
} from "@/lib/api";
import { PriorityBadge, StatusBadge, prettyToken } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

type Insurance = "insured" | "self_pay" | "medicaid" | "unknown";

const SUGGESTED = [
  "chest_pain",
  "difficulty_breathing",
  "high_fever",
  "persistent_cough",
  "chills",
  "sweating",
  "abdominal_pain",
  "headache",
  "rash",
];

export function Submit({
  onOpenDetail,
}: {
  onOpenDetail: (id: number) => void;
}) {
  const [name, setName] = useState("Jordan Lee");
  const [dob, setDob] = useState("1988-04-12");
  const [mrn, setMrn] = useState("MRN-2001");
  const [insurance, setInsurance] = useState<Insurance>("insured");
  const [complaint, setComplaint] = useState("Chest pain and shortness of breath");
  const [symptoms, setSymptoms] = useState<string[]>(["chest_pain"]);
  const [symptomDraft, setSymptomDraft] = useState("");

  const [created, setCreated] = useState<Intake | null>(null);
  const [evaluated, setEvaluated] = useState<Intake | null>(null);
  const [busy, setBusy] = useState<"submit" | "evaluate" | null>(null);
  const [error, setError] = useState("");

  function addSymptom(raw: string) {
    const token = raw.trim().toLowerCase().replace(/\s+/g, "_");
    if (token && !symptoms.includes(token)) setSymptoms((s) => [...s, token]);
    setSymptomDraft("");
  }

  function reset() {
    setCreated(null);
    setEvaluated(null);
    setError("");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy("submit");
    setError("");
    setEvaluated(null);
    const body: SubmitBody = {
      patient_name: name,
      date_of_birth: dob,
      mrn,
      insurance_status: insurance,
      chief_complaint: complaint,
      symptoms,
    };
    try {
      setCreated(await submitIntake(body));
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 403
          ? "Blocked by role (server-side 403): only the intake clerk role can submit."
          : err instanceof Error
            ? err.message
            : "Submit failed.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function onEvaluate() {
    if (!created) return;
    setBusy("evaluate");
    setError("");
    try {
      setEvaluated(await evaluateIntake(Number(created.id)));
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 403
          ? "Blocked by role (server-side 403): only the intake clerk role can evaluate."
          : err instanceof Error
            ? err.message
            : "Evaluate failed.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>New intake</CardTitle>
          <CardDescription>
            Submit an intake, then run the triage rules and watch them assign a priority.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Patient name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dob">Date of birth</Label>
                <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mrn">MRN</Label>
                <Input id="mrn" value={mrn} onChange={(e) => setMrn(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="insurance">Insurance</Label>
                <Select value={insurance} onValueChange={(v) => setInsurance(v as Insurance)}>
                  <SelectTrigger id="insurance">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="insured">Insured</SelectItem>
                    <SelectItem value="self_pay">Self pay</SelectItem>
                    <SelectItem value="medicaid">Medicaid</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="complaint">Chief complaint</Label>
              <Textarea
                id="complaint"
                value={complaint}
                onChange={(e) => setComplaint(e.target.value)}
                rows={2}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Symptoms</Label>
              <div className="flex flex-wrap gap-1.5">
                {symptoms.map((sym) => (
                  <span
                    key={sym}
                    className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs"
                  >
                    {prettyToken(sym)}
                    <button
                      type="button"
                      onClick={() => setSymptoms((s) => s.filter((x) => x !== sym))}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`Remove ${sym}`}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                {symptoms.length === 0 && (
                  <span className="text-muted-foreground text-xs">No symptoms added.</span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  value={symptomDraft}
                  onChange={(e) => setSymptomDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSymptom(symptomDraft);
                    }
                  }}
                  placeholder="Add a symptom token"
                />
                <Button type="button" variant="secondary" onClick={() => addSymptom(symptomDraft)}>
                  <Plus className="size-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED.filter((s) => !symptoms.includes(s)).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addSymptom(s)}
                    className="border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md border px-2 py-0.5 text-xs"
                  >
                    + {prettyToken(s)}
                  </button>
                ))}
              </div>
            </div>

            <Button type="submit" disabled={busy !== null} className="w-full">
              {busy === "submit" ? <Loader2 className="size-4 animate-spin" /> : "Submit intake"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Triage result</CardTitle>
          <CardDescription>
            The rules run on the server. The intake records the exact version and reason.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}

          {!created && !error && (
            <div className="text-muted-foreground flex h-48 flex-col items-center justify-center gap-2 text-center text-sm">
              <Sparkles className="size-6 opacity-50" />
              Submit an intake to see it enter the pipeline.
            </div>
          )}

          {created && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Check className="text-primary size-4" />
                <span className="text-sm">
                  Intake <span className="font-medium">#{String(created.id)}</span> created
                </span>
                <StatusBadge status={evaluated ? String(evaluated.status) : String(created.status)} />
              </div>

              {!evaluated ? (
                <Button onClick={onEvaluate} disabled={busy !== null} className="w-full">
                  {busy === "evaluate" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      Run triage rules <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
              ) : (
                <div className="bg-muted/50 space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">Assigned priority</span>
                    <PriorityBadge priority={evaluated.assigned_priority as never} />
                  </div>
                  <Separator />
                  <div>
                    <div className="text-muted-foreground text-xs">Reason (recorded on the intake)</div>
                    <div className="text-sm">{String(evaluated.matched_criteria)}</div>
                  </div>
                  <div className="text-muted-foreground text-xs">
                    Routed by triage rules version {String(evaluated.applied_rule_version)}.
                  </div>
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => onOpenDetail(Number(evaluated.id))}
                  >
                    Open detail and audit trail <ArrowRight className="size-4" />
                  </Button>
                </div>
              )}

              <Button variant="ghost" size="sm" className="w-full" onClick={reset}>
                Start another intake
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
