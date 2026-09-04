import { query, input, s, ref, inp, c, col, expr, or } from "@xanots/sdk";
import { intakeApi } from "./intake.js";
import { users } from "../tables/users.js";
import { patients } from "../tables/patients.js";
import { triageRules } from "../tables/triage_rules.js";
import { intakes } from "../tables/intakes.js";
import { reviewQueue } from "../tables/review_queue.js";
import { reviewActions } from "../tables/review_actions.js";

// The initial triage policy (version 1). An ordered list; evaluate walks it and
// the first match wins. Symptom tokens match a value in the intake's symptoms
// list; a chief_complaint rule matches a substring of the complaint text.
const CRITERIA = [
  { field: "symptoms", op: "contains", value: "chest_pain", priority: "emergent", reason: "Chest pain reported; route as emergent." },
  { field: "symptoms", op: "contains", value: "difficulty_breathing", priority: "emergent", reason: "Difficulty breathing reported; route as emergent." },
  { field: "symptoms", op: "contains", value: "high_fever", priority: "urgent", reason: "High fever reported; route as urgent." },
  { field: "chief_complaint", op: "includes", value: "severe", priority: "urgent", reason: "Severe symptom in the chief complaint; route as urgent." },
  { field: "symptoms", op: "contains", value: "persistent_cough", priority: "urgent", reason: "Persistent cough reported; route as urgent." },
];

type Priority = "routine" | "urgent" | "emergent";
type SeedState = "submitted" | "open" | "claimed" | "approved" | "denied";

const RANK: Record<Priority, number> = { routine: 1, urgent: 2, emergent: 3 };

// Build the statements for one seeded intake: the intake row, its queue row when
// it reached the queue, and the append-only audit trail for its state. `as`
// names are keyed by `k` so each intake's rows are referenceable by real id.
function seedIntake(opts: {
  k: string;
  patientVar: string;
  clerkVar: string;
  clinicianVar: string;
  chief_complaint: string;
  symptoms: string[];
  state: SeedState;
  priority?: Priority;
  matched?: string;
  reason?: string;
}) {
  const { k, patientVar, clerkVar, clinicianVar } = opts;
  const evaluated = opts.state !== "submitted";
  const queued = opts.state === "open" || opts.state === "claimed";
  const claimed = opts.state === "claimed" || opts.state === "approved" || opts.state === "denied";
  const resolved = opts.state === "approved" || opts.state === "denied";
  const priority: Priority = opts.priority ?? "routine";
  const matched = opts.matched ?? "No urgent criteria matched; routed as routine.";
  const status: "submitted" | "queued" | "approved" | "denied" =
    opts.state === "submitted" ? "submitted"
    : opts.state === "approved" ? "approved"
    : opts.state === "denied" ? "denied"
    : "queued";

  const out = [];

  out.push(
    s.db.add({
      table: intakes,
      row: {
        patient_id: ref(`${patientVar}.id`),
        chief_complaint: opts.chief_complaint,
        symptoms: c.array(opts.symptoms),
        submitted_by: ref(`${clerkVar}.id`),
        status,
        assigned_priority: evaluated ? priority : null,
        applied_rule_version: evaluated ? 1 : 0,
        matched_criteria: evaluated ? matched : "",
      },
      as: `i${k}`,
    }),
    s.db.add({
      table: reviewActions,
      row: {
        intake_id: ref(`i${k}.id`),
        actor_id: ref(`${clerkVar}.id`),
        action: "submitted",
        detail: c.text("Intake submitted for triage."),
      },
    }),
  );

  if (evaluated) {
    out.push(
      s.db.add({
        table: reviewActions,
        row: {
          intake_id: ref(`i${k}.id`),
          actor_id: ref(`${clerkVar}.id`),
          action: "evaluated",
          detail: c.text(matched),
          rule_version: 1,
        },
      }),
    );
  }

  if (queued || resolved) {
    out.push(
      s.db.add({
        table: reviewQueue,
        row: {
          intake_id: ref(`i${k}.id`),
          priority,
          priority_rank: RANK[priority],
          claimed_by: claimed ? ref(`${clinicianVar}.id`) : 0,
          state: resolved ? "resolved" : opts.state === "claimed" ? "claimed" : "open",
        },
      }),
    );
  }

  if (claimed) {
    out.push(
      s.db.add({
        table: reviewActions,
        row: {
          intake_id: ref(`i${k}.id`),
          actor_id: ref(`${clinicianVar}.id`),
          action: "claimed",
          detail: c.text("Claimed for review."),
        },
      }),
    );
  }

  if (opts.state === "approved") {
    out.push(
      s.db.add({
        table: reviewActions,
        row: {
          intake_id: ref(`i${k}.id`),
          actor_id: ref(`${clinicianVar}.id`),
          action: "approved",
          detail: c.text("Approved for care."),
        },
      }),
    );
  }

  if (opts.state === "denied") {
    out.push(
      s.db.add({
        table: reviewActions,
        row: {
          intake_id: ref(`i${k}.id`),
          actor_id: ref(`${clinicianVar}.id`),
          action: "denied",
          detail: c.text(opts.reason ?? "Denied."),
        },
      }),
    );
  }

  return out;
}

/**
 * Reset and seed the demo. Public so it can run before the first login. It is
 * idempotent by default: it seeds only when the workspace is empty, so the
 * frontend can safely call it on load to make a fresh deploy browsable. Pass
 * `reset=true` to wipe and reseed on demand (the "reset demo data" control).
 *
 * Seeds one user per role, an active triage rule set, six patients, and intakes
 * across every state (submitted, queued/open, claimed, approved, denied) with
 * their full audit trails, so the queue, detail, and rule screens all show real
 * data immediately.
 */
export const seedQuery = query({
  name: "seed",
  verb: "GET",
  apiGroup: intakeApi,
  auth: false,
  input: { reset: input.bool({ default: false }) },
  stack: [
    s.db.query({ table: users, returnType: "count", as: "existing_users" }),
    s.conditional({
      when: or(
        expr(inp("reset"), "=", c.bool(true)),
        expr(ref("existing_users"), "=", c.int(0)),
      ),
      then: [
        s.db.truncate({ table: reviewActions, reset: true }),
        s.db.truncate({ table: reviewQueue, reset: true }),
        s.db.truncate({ table: intakes, reset: true }),
        s.db.truncate({ table: triageRules, reset: true }),
        s.db.truncate({ table: patients, reset: true }),
        s.db.truncate({ table: users, reset: true }),

        s.db.add({ table: users, row: { email: "clerk@clinic.test", password: "password123", role: "intake_clerk", display_name: "Casey Kim (Intake)" }, as: "u_clerk" }),
        s.db.add({ table: users, row: { email: "clinician@clinic.test", password: "password123", role: "clinician", display_name: "Dr. Nadia Rao" }, as: "u_clinician" }),
        s.db.add({ table: users, row: { email: "viewer@clinic.test", password: "password123", role: "viewer", display_name: "Sam Ford (Auditor)" }, as: "u_viewer" }),

        s.db.add({
          table: triageRules,
          row: { version: 1, is_active: true, criteria: c.array(CRITERIA), activated_by: ref("u_clinician.id"), note: "Initial triage policy: chest pain and difficulty breathing route emergent; high fever, severe complaints, and persistent cough route urgent." },
          as: "rule1",
        }),

        s.db.add({ table: patients, row: { name: "Maria Alvarez", date_of_birth: "1978-03-22", mrn: "MRN-1001", insurance_status: "insured" }, as: "p1" }),
        s.db.add({ table: patients, row: { name: "James Chen", date_of_birth: "1965-11-02", mrn: "MRN-1002", insurance_status: "medicaid" }, as: "p2" }),
        s.db.add({ table: patients, row: { name: "Fatima Noor", date_of_birth: "1990-07-14", mrn: "MRN-1003", insurance_status: "self_pay" }, as: "p3" }),
        s.db.add({ table: patients, row: { name: "Robert Blake", date_of_birth: "1955-01-30", mrn: "MRN-1004", insurance_status: "insured" }, as: "p4" }),
        s.db.add({ table: patients, row: { name: "Lily Nguyen", date_of_birth: "2001-09-09", mrn: "MRN-1005", insurance_status: "unknown" }, as: "p5" }),
        s.db.add({ table: patients, row: { name: "David Osei", date_of_birth: "1982-06-18", mrn: "MRN-1006", insurance_status: "insured" }, as: "p6" }),

        // A fresh submission awaiting evaluation (the evaluate demo).
        ...seedIntake({ k: "1", patientVar: "p1", clerkVar: "u_clerk", clinicianVar: "u_clinician", chief_complaint: "Chest tightness for the last two hours", symptoms: ["chest_pain", "sweating"], state: "submitted" }),
        // Open, emergent (top of the queue; the claim demo).
        ...seedIntake({ k: "2", patientVar: "p2", clerkVar: "u_clerk", clinicianVar: "u_clinician", chief_complaint: "Trouble breathing since this morning", symptoms: ["chest_pain", "difficulty_breathing"], state: "open", priority: "emergent", matched: "Chest pain reported; route as emergent." }),
        // Open, urgent.
        ...seedIntake({ k: "3", patientVar: "p3", clerkVar: "u_clerk", clinicianVar: "u_clinician", chief_complaint: "High fever and chills for two days", symptoms: ["high_fever", "chills"], state: "open", priority: "urgent", matched: "High fever reported; route as urgent." }),
        // Claimed, urgent (the approve/deny demo).
        ...seedIntake({ k: "4", patientVar: "p4", clerkVar: "u_clerk", clinicianVar: "u_clinician", chief_complaint: "Severe abdominal pain", symptoms: ["abdominal_pain"], state: "claimed", priority: "urgent", matched: "Severe symptom in the chief complaint; route as urgent." }),
        // Approved, routed urgent (a completed review with a full trail).
        ...seedIntake({ k: "5", patientVar: "p5", clerkVar: "u_clerk", clinicianVar: "u_clinician", chief_complaint: "Persistent cough for a week", symptoms: ["persistent_cough"], state: "approved", priority: "urgent", matched: "Persistent cough reported; route as urgent." }),
        // Denied, routed routine (a completed review with a reason).
        ...seedIntake({ k: "6", patientVar: "p6", clerkVar: "u_clerk", clinicianVar: "u_clinician", chief_complaint: "Mild rash on the forearm", symptoms: ["rash"], state: "denied", priority: "routine", matched: "No urgent criteria matched; routed as routine.", reason: "Not an emergency case; referred to primary care." }),
      ],
    }),
    s.db.query({ table: users, returnType: "count", as: "users_n" }),
    s.db.query({ table: patients, returnType: "count", as: "patients_n" }),
    s.db.query({ table: intakes, returnType: "count", as: "intakes_n" }),
    s.db.query({ table: reviewQueue, where: expr(col("state"), "!=", c.text("resolved")), returnType: "count", as: "open_queue_n" }),
  ],
  response: {
    users: ref("users_n"),
    patients: ref("patients_n"),
    intakes: ref("intakes_n"),
    open_queue: ref("open_queue_n"),
  },
});
