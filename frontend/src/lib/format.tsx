import { Badge } from "@/components/ui/badge";
import type { Priority, Role } from "@/lib/api";

/** Xano stores created_at as epoch-ms. Render it, tolerating string/number/null. */
export function formatDateTime(v: number | string | null | undefined): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n) || n === 0) return "—";
  return new Date(n).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(v: string | null | undefined): string {
  if (!v) return "—";
  return v;
}

/** Turn a snake_case token (a symptom, an enum) into readable text. */
export function prettyToken(t: string | null | undefined): string {
  return (t ?? "").replace(/_/g, " ");
}

const PRIORITY_VARIANT: Record<Priority, "default" | "secondary" | "destructive"> = {
  emergent: "destructive",
  urgent: "default",
  routine: "secondary",
};

export function PriorityBadge({ priority }: { priority: Priority | null | undefined }) {
  if (!priority) return <Badge variant="outline">unassigned</Badge>;
  return (
    <Badge variant={PRIORITY_VARIANT[priority]} className="uppercase tracking-wide">
      {priority}
    </Badge>
  );
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  submitted: "outline",
  queued: "secondary",
  approved: "default",
  denied: "destructive",
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = status ?? "unknown";
  return <Badge variant={STATUS_VARIANT[s] ?? "outline"}>{s}</Badge>;
}

const ROLE_VARIANT: Record<Role, "default" | "secondary" | "outline"> = {
  clinician: "default",
  intake_clerk: "secondary",
  viewer: "outline",
};

export function RoleBadge({ role }: { role: Role }) {
  const label =
    { intake_clerk: "intake clerk", clinician: "clinician", viewer: "viewer" }[role] ?? role;
  return <Badge variant={ROLE_VARIANT[role]}>{label}</Badge>;
}
