import { query, input, s, ref, inp, c, col, expr, or } from "@xanots/sdk";
import { intakeApi } from "./intake.js";
import { requireRole } from "../lib/guards.js";
import { patients } from "../tables/patients.js";
import { intakes } from "../tables/intakes.js";
import { triageRules } from "../tables/triage_rules.js";
import { reviewQueue } from "../tables/review_queue.js";
import { reviewActions } from "../tables/review_actions.js";
import { users } from "../tables/users.js";

/**
 * Submit a new intake. Intake-clerk only. Matches an existing patient by MRN
 * (or creates one), opens the intake in `submitted`, and writes the first audit
 * row. Typed inputs validate at the boundary; the MRN upsert keeps one patient
 * per medical record number.
 */
export const submitQuery = query({
  name: "submit",
  verb: "POST",
  apiGroup: intakeApi,
  auth: users,
  input: {
    patient_name: input.text({ required: true }),
    date_of_birth: input.date({ required: true }),
    mrn: input.text({ required: true, methods: ["trim"] }),
    insurance_status: input.enum(
      ["insured", "self_pay", "medicaid", "unknown"],
      { required: true },
    ),
    chief_complaint: input.text({ required: true }),
    symptoms: input.list(input.text()),
  },
  stack: [
    ...requireRole("intake_clerk"),
    s.db.add_or_edit({
      table: patients,
      fieldName: "mrn",
      fieldValue: inp("mrn"),
      row: {
        name: inp("patient_name"),
        date_of_birth: inp("date_of_birth"),
        mrn: inp("mrn"),
        insurance_status: inp("insurance_status"),
      },
      as: "patient",
    }),
    s.db.add({
      table: intakes,
      row: {
        patient_id: ref("patient.id"),
        chief_complaint: inp("chief_complaint"),
        symptoms: inp("symptoms"),
        submitted_by: ref("me.id"),
        status: "submitted",
      },
      as: "intake",
    }),
    s.db.add({
      table: reviewActions,
      row: {
        intake_id: ref("intake.id"),
        actor_id: ref("me.id"),
        action: "submitted",
        detail: c.text("Intake submitted for triage."),
      },
    }),
  ],
  response: ref("intake"),
});

/**
 * The governed decision. Intake-clerk only. Loads the single active triage rule
 * set, walks its ordered criteria against the intake's symptoms and chief
 * complaint (first match wins, else routine), then stamps the intake with the
 * priority, the exact rule version that routed it, and the human-readable
 * reason. Queues it and writes an `evaluated` audit row. Guarded so an intake is
 * only evaluated once.
 */
export const evaluateQuery = query({
  name: "evaluate",
  verb: "POST",
  apiGroup: intakeApi,
  auth: users,
  input: { intake_id: input.int({ required: true }) },
  stack: [
    ...requireRole("intake_clerk"),
    s.db.get_by_id({ table: intakes, id: inp("intake_id"), as: "intake" }),
    s.precondition({
      expr: expr(ref("intake", { safe: true }), "!=", c.null()),
      error: c.text("Intake not found."),
      error_type: "notfound",
    }),
    s.precondition({
      expr: expr(ref("intake.status"), "=", c.text("submitted")),
      error: c.text("This intake has already been evaluated."),
      error_type: "badrequest",
    }),
    s.db.query({
      table: triageRules,
      where: expr(col("is_active"), "=", c.bool(true)),
      returnType: "single",
      as: "rule",
    }),
    s.precondition({
      expr: expr(ref("rule", { safe: true }), "!=", c.null()),
      error: c.text("No active triage rule set is configured."),
      error_type: "standard",
    }),
    // The rule set is data, so evaluating it is the one place a lambda earns its
    // keep. Defensive: coerces types and falls back to routine, so a malformed
    // criteria entry never throws.
    s.lambda({
      as: "decision",
      code: ({ $var }) => {
        const rank: Record<string, number> = { routine: 1, urgent: 2, emergent: 3 };
        const symptoms = Array.isArray($var.intake.symptoms) ? $var.intake.symptoms : [];
        const complaint = String($var.intake.chief_complaint || "").toLowerCase();
        const criteria = Array.isArray($var.rule.criteria) ? $var.rule.criteria : [];
        for (const cr of criteria) {
          const value = String(cr && cr.value != null ? cr.value : "");
          let hit = false;
          if (cr && cr.field === "symptoms") hit = symptoms.includes(value);
          else if (cr && cr.field === "chief_complaint") hit = complaint.includes(value.toLowerCase());
          if (hit) {
            const priority = String(cr.priority || "routine");
            return {
              priority,
              priority_rank: rank[priority] || 1,
              matched_criteria: String(cr.reason || ("Matched " + cr.field + ": " + value)),
              applied_rule_version: $var.rule.version,
            };
          }
        }
        return {
          priority: "routine",
          priority_rank: 1,
          matched_criteria: "No urgent criteria matched; routed as routine.",
          applied_rule_version: $var.rule.version,
        };
      },
    }),
    // Commit nothing until the decision is a valid priority. A lambda runs
    // out-of-process and a cold first call can hiccup (a thrown body returns
    // diagnostic text at HTTP 200), so this guard aborts BEFORE any write. The
    // intake stays `submitted`, so evaluate is safely retryable rather than
    // being left queued with no priority.
    s.precondition({
      expr: or(
        expr(ref("decision.priority"), "=", c.text("routine")),
        expr(ref("decision.priority"), "=", c.text("urgent")),
        expr(ref("decision.priority"), "=", c.text("emergent")),
      ),
      error: c.text("Triage evaluation did not produce a valid priority. Please retry."),
      error_type: "standard",
    }),
    s.db.edit({
      table: intakes,
      fieldName: "id",
      fieldValue: inp("intake_id"),
      row: {
        status: "queued",
        assigned_priority: ref("decision.priority"),
        applied_rule_version: ref("decision.applied_rule_version"),
        matched_criteria: ref("decision.matched_criteria"),
      },
      as: "updated",
    }),
    s.db.add({
      table: reviewQueue,
      row: {
        intake_id: inp("intake_id"),
        priority: ref("decision.priority"),
        priority_rank: ref("decision.priority_rank"),
        claimed_by: 0,
        state: "open",
      },
    }),
    s.db.add({
      table: reviewActions,
      row: {
        intake_id: inp("intake_id"),
        actor_id: ref("me.id"),
        action: "evaluated",
        detail: ref("decision.matched_criteria"),
        rule_version: ref("decision.applied_rule_version"),
      },
    }),
  ],
  response: ref("updated"),
});

/**
 * Fetch one intake with everything needed to audit its journey: the patient,
 * the exact triage rule version (and its criteria) that set the priority, and
 * the full append-only action trail with actor names. Any signed-in user can
 * read it. intake_id is a path segment so the route is addressable.
 */
export const detailQuery = query({
  name: "detail/{intake_id}",
  verb: "GET",
  apiGroup: intakeApi,
  auth: users,
  input: { intake_id: input.int() },
  stack: [
    s.db.get_by_id({ table: intakes, id: inp("intake_id"), as: "intake" }),
    s.precondition({
      expr: expr(ref("intake", { safe: true }), "!=", c.null()),
      error: c.text("Intake not found."),
      error_type: "notfound",
    }),
    s.db.get({
      table: patients,
      fieldName: "id",
      fieldValue: ref("intake.patient_id"),
      as: "patient",
    }),
    // The version that actually routed it (0 for a not-yet-evaluated intake, so
    // this simply binds null). Old versions are retired, not deleted, so an
    // older intake still resolves the criteria it was decided by.
    s.db.query({
      table: triageRules,
      where: expr(col("version"), "=", ref("intake.applied_rule_version")),
      returnType: "single",
      as: "rule",
    }),
    s.db.query({
      table: reviewActions,
      where: expr(col("intake_id"), "=", ref("intake.id")),
      bind: [
        {
          table: users,
          as: "a",
          join: "left",
          where: expr(col("actor_id"), "=", col("a.id")),
        },
      ],
      eval: [
        { name: "a.display_name", as: "actor_name" },
        { name: "a.role", as: "actor_role" },
      ],
      sort: [{ sortBy: "created_at", dir: "asc" }],
      as: "actions",
    }),
  ],
  response: {
    intake: ref("intake"),
    patient: ref("patient"),
    rule: ref("rule"),
    actions: ref("actions"),
  },
});
