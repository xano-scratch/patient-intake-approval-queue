import { query, input, s, ref, inp, c, col, expr } from "@xanots/sdk";
import { intakeApi } from "./intake.js";
import { requireRole } from "../lib/guards.js";
import { intakes } from "../tables/intakes.js";
import { reviewQueue } from "../tables/review_queue.js";
import { reviewActions } from "../tables/review_actions.js";
import { patients } from "../tables/patients.js";
import { users } from "../tables/users.js";

/**
 * The review queue, emergent first. Clinician or viewer. Joins the intake and
 * patient so each row carries the patient name and chief complaint, and the
 * claiming clinician's name when one has claimed it. Resolved items drop off.
 */
export const queueQuery = query({
  name: "queue",
  verb: "GET",
  apiGroup: intakeApi,
  auth: users,
  stack: [
    ...requireRole("clinician", "viewer"),
    s.db.query({
      table: reviewQueue,
      where: expr(col("state"), "!=", c.text("resolved")),
      bind: [
        {
          table: intakes,
          as: "i",
          join: "inner",
          where: expr(col("intake_id"), "=", col("i.id")),
        },
        {
          table: patients,
          as: "p",
          join: "inner",
          where: expr(col("i.patient_id"), "=", col("p.id")),
        },
        {
          table: users,
          as: "cb",
          join: "left",
          where: expr(col("claimed_by"), "=", col("cb.id")),
        },
      ],
      eval: [
        { name: "i.chief_complaint", as: "chief_complaint" },
        { name: "i.assigned_priority", as: "assigned_priority" },
        { name: "i.matched_criteria", as: "matched_criteria" },
        { name: "p.name", as: "patient_name" },
        { name: "p.mrn", as: "mrn" },
        { name: "cb.display_name", as: "claimed_by_name" },
      ],
      sort: [
        { sortBy: "priority_rank", dir: "desc" },
        { sortBy: "created_at", dir: "asc" },
      ],
      as: "rows",
    }),
  ],
  response: ref("rows"),
});

/**
 * Claim an open queue item. Clinician only. Moves it to `claimed` under the
 * caller's name and writes a `claimed` audit row. A non-clinician is rejected
 * by the role guard at the API layer, not by a hidden button.
 */
export const claimQuery = query({
  name: "queue/claim",
  verb: "POST",
  apiGroup: intakeApi,
  auth: users,
  input: { intake_id: input.int({ required: true }) },
  stack: [
    ...requireRole("clinician"),
    s.db.get({
      table: reviewQueue,
      fieldName: "intake_id",
      fieldValue: inp("intake_id"),
      as: "q",
    }),
    s.precondition({
      expr: expr(ref("q", { safe: true }), "!=", c.null()),
      error: c.text("This intake is not in the queue."),
      error_type: "notfound",
    }),
    s.precondition({
      expr: expr(ref("q.state"), "=", c.text("open")),
      error: c.text("This item is already claimed or resolved."),
      error_type: "badrequest",
    }),
    s.db.edit({
      table: reviewQueue,
      fieldName: "intake_id",
      fieldValue: inp("intake_id"),
      row: { claimed_by: ref("me.id"), state: "claimed" },
      as: "updated",
    }),
    s.db.add({
      table: reviewActions,
      row: {
        intake_id: inp("intake_id"),
        actor_id: ref("me.id"),
        action: "claimed",
        detail: c.text("Claimed for review."),
      },
    }),
  ],
  response: ref("updated"),
});

/**
 * Approve a claimed intake. Clinician only. The intake must be claimed first
 * (governance: a review is owned before it is resolved). Marks the intake
 * approved, resolves the queue row, and writes an `approved` audit row.
 */
export const approveQuery = query({
  name: "queue/approve",
  verb: "POST",
  apiGroup: intakeApi,
  auth: users,
  input: { intake_id: input.int({ required: true }) },
  stack: [
    ...requireRole("clinician"),
    s.db.get({
      table: reviewQueue,
      fieldName: "intake_id",
      fieldValue: inp("intake_id"),
      as: "q",
    }),
    s.precondition({
      expr: expr(ref("q", { safe: true }), "!=", c.null()),
      error: c.text("This intake is not in the queue."),
      error_type: "notfound",
    }),
    s.precondition({
      expr: expr(ref("q.state"), "=", c.text("claimed")),
      error: c.text("Claim this item before approving it."),
      error_type: "badrequest",
    }),
    s.db.edit({
      table: intakes,
      fieldName: "id",
      fieldValue: inp("intake_id"),
      row: { status: "approved" },
      as: "updated",
    }),
    s.db.edit({
      table: reviewQueue,
      fieldName: "intake_id",
      fieldValue: inp("intake_id"),
      row: { state: "resolved" },
    }),
    s.db.add({
      table: reviewActions,
      row: {
        intake_id: inp("intake_id"),
        actor_id: ref("me.id"),
        action: "approved",
        detail: c.text("Approved for care."),
      },
    }),
  ],
  response: ref("updated"),
});

/**
 * Deny a claimed intake with a reason. Clinician only. Same guard as approve;
 * the reason is recorded on the audit row so the denial is attributable.
 */
export const denyQuery = query({
  name: "queue/deny",
  verb: "POST",
  apiGroup: intakeApi,
  auth: users,
  input: {
    intake_id: input.int({ required: true }),
    reason: input.text({ required: true }),
  },
  stack: [
    ...requireRole("clinician"),
    s.db.get({
      table: reviewQueue,
      fieldName: "intake_id",
      fieldValue: inp("intake_id"),
      as: "q",
    }),
    s.precondition({
      expr: expr(ref("q", { safe: true }), "!=", c.null()),
      error: c.text("This intake is not in the queue."),
      error_type: "notfound",
    }),
    s.precondition({
      expr: expr(ref("q.state"), "=", c.text("claimed")),
      error: c.text("Claim this item before denying it."),
      error_type: "badrequest",
    }),
    s.db.edit({
      table: intakes,
      fieldName: "id",
      fieldValue: inp("intake_id"),
      row: { status: "denied" },
      as: "updated",
    }),
    s.db.edit({
      table: reviewQueue,
      fieldName: "intake_id",
      fieldValue: inp("intake_id"),
      row: { state: "resolved" },
    }),
    s.db.add({
      table: reviewActions,
      row: {
        intake_id: inp("intake_id"),
        actor_id: ref("me.id"),
        action: "denied",
        detail: inp("reason"),
      },
    }),
  ],
  response: ref("updated"),
});
