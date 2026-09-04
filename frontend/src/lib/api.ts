// The one contract: paths, request bodies, and response shapes are all derived
// from the xanots query defs. Rename a column or an input and the type error
// lands here, not in production. The only hand-written types are the overlays
// for columns a join PROJECTS onto a row (eval aliases), which the SDK types as
// `unknown` because they do not trace to a table column — those are documented
// below as the one place derivation cannot reach.

import type { InferInput, InferResponse } from "@xanots/sdk";

import { loginQuery } from "../../../xano/api/auth.js";
import { submitQuery, evaluateQuery, detailQuery } from "../../../xano/api/intakes.js";
import { queueQuery, claimQuery, approveQuery, denyQuery } from "../../../xano/api/queue.js";
import { rulesListQuery, activateRulesQuery } from "../../../xano/api/rules.js";
import { seedQuery } from "../../../xano/api/seed.js";

/**
 * The deployed Xano backend's base URL. Injected as `window.XANO_HOST` by
 * `xanots deploy <entry> --static <dir>`, or read from `VITE_XANO_HOST` in dev.
 */
export const XANO_HOST: string =
  (typeof window !== "undefined" && (window as { XANO_HOST?: string }).XANO_HOST) ||
  import.meta.env.VITE_XANO_HOST ||
  "";

export type Role = "intake_clerk" | "clinician" | "viewer";
export type Priority = "routine" | "urgent" | "emergent";

export const ROLE_LABEL: Record<Role, string> = {
  intake_clerk: "Intake clerk",
  clinician: "Clinician",
  viewer: "Viewer",
};

// ── Session ──────────────────────────────────────────────────────────────────

export interface Session {
  token: string;
  role: Role;
  display_name: string;
  user_id: number;
}

const SESSION_KEY = "intake_session";
let session: Session | null = loadSession();

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  return session;
}

export function setSession(next: Session | null): void {
  session = next;
  if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
  else localStorage.removeItem(SESSION_KEY);
}

// ── Transport ────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function call<T>(
  path: string,
  method: string,
  opts: { body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.auth && session) headers["Authorization"] = `Bearer ${session.token}`;

  const res = await fetch(XANO_HOST + path, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    let message = res.statusText || `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as { message?: string; error?: string };
      message = data.message || data.error || message;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export type LoginBody = InferInput<typeof loginQuery>;
type LoginResponse = InferResponse<typeof loginQuery>;

export async function login(body: LoginBody): Promise<Session> {
  const res = await call<LoginResponse>(loginQuery.getPath(), loginQuery.verb, { body });
  const next: Session = {
    token: String(res.token),
    role: res.role as Role,
    display_name: String(res.display_name),
    user_id: Number(res.user_id),
  };
  setSession(next);
  return next;
}

// ── Intake write flows ───────────────────────────────────────────────────────

export type SubmitBody = InferInput<typeof submitQuery>;
export type Intake = InferResponse<typeof submitQuery>;

export async function submitIntake(body: SubmitBody): Promise<Intake> {
  return call<Intake>(submitQuery.getPath(), submitQuery.verb, { body, auth: true });
}

export async function evaluateIntake(intake_id: number): Promise<Intake> {
  const run = () =>
    call<Intake>(evaluateQuery.getPath(), evaluateQuery.verb, { body: { intake_id }, auth: true });
  try {
    return await run();
  } catch (e) {
    // A cold first lambda call can transiently fail; the server guard leaves the
    // intake unevaluated, so a single retry on a now-warm worker is safe.
    if (e instanceof ApiError && e.status >= 500) return run();
    throw e;
  }
}

// ── Queue ────────────────────────────────────────────────────────────────────

// A queue row is a review_queue row (typed from the table) plus the columns the
// intake/patient/clinician joins PROJECT onto it. Those projected keys are
// `unknown` in InferResponse (they are not table columns), so we narrow them
// with an overlay — the documented boundary of the derived contract.
type QueueRowBase = InferResponse<typeof queueQuery>[number];
export type QueueRow = QueueRowBase & {
  chief_complaint: string;
  assigned_priority: Priority | null;
  matched_criteria: string;
  patient_name: string;
  mrn: string;
  claimed_by_name: string | null;
};

export async function getQueue(): Promise<QueueRow[]> {
  return call<QueueRow[]>(queueQuery.getPath(), queueQuery.verb, { auth: true });
}

export async function claimIntake(intake_id: number): Promise<unknown> {
  return call<unknown>(claimQuery.getPath(), claimQuery.verb, {
    body: { intake_id },
    auth: true,
  });
}

export async function approveIntake(intake_id: number): Promise<unknown> {
  return call<unknown>(approveQuery.getPath(), approveQuery.verb, {
    body: { intake_id },
    auth: true,
  });
}

export async function denyIntake(intake_id: number, reason: string): Promise<unknown> {
  return call<unknown>(denyQuery.getPath(), denyQuery.verb, {
    body: { intake_id, reason },
    auth: true,
  });
}

// ── Intake detail + audit ────────────────────────────────────────────────────

type DetailBase = InferResponse<typeof detailQuery>;
type AuditActionBase = DetailBase["actions"][number];
export type AuditAction = AuditActionBase & {
  actor_name: string | null;
  actor_role: string | null;
};
export type IntakeDetail = Omit<DetailBase, "actions"> & { actions: AuditAction[] };

export async function getDetail(intake_id: number): Promise<IntakeDetail> {
  return call<IntakeDetail>(
    detailQuery.getPath({ params: { intake_id } }),
    detailQuery.verb,
    { auth: true },
  );
}

// ── Rules ────────────────────────────────────────────────────────────────────

export interface Criterion {
  field: string;
  op?: string;
  value: string;
  priority: string;
  reason?: string;
}

type RuleRowBase = InferResponse<typeof rulesListQuery>[number];
export type RuleRow = RuleRowBase & { activated_by_name: string | null };

export async function getRules(): Promise<RuleRow[]> {
  return call<RuleRow[]>(rulesListQuery.getPath(), rulesListQuery.verb, { auth: true });
}

export type ActivateBody = InferInput<typeof activateRulesQuery>;

export async function activateRules(body: ActivateBody): Promise<unknown> {
  return call<unknown>(activateRulesQuery.getPath(), activateRulesQuery.verb, {
    body,
    auth: true,
  });
}

// ── Seed ─────────────────────────────────────────────────────────────────────

type SeedResponse = InferResponse<typeof seedQuery>;

/** Idempotent by default (seeds only when empty); reset=true wipes and reseeds. */
export async function seed(reset = false): Promise<SeedResponse> {
  const path = seedQuery.getPath();
  const url = reset ? `${path}?reset=true` : path;
  return call<SeedResponse>(url, seedQuery.verb);
}
