import { table, f } from "@xanots/sdk";
import { patients } from "./patients.js";
import { users } from "./users.js";

/**
 * A patient intake. Created in `submitted`, moved to `queued` by `evaluate`
 * (which stamps the priority, the rule version that routed it, and a
 * human-readable reason), then `approved` or `denied` by a clinician.
 */
export const intakes = table({
  name: "intakes",
  schema: {
    patient_id: f.tableRef(patients, { required: true }),
    chief_complaint: f.text({ required: true }),
    // A list of symptom tokens, e.g. ["chest_pain", "high_fever"].
    symptoms: f.json(),
    submitted_by: f.tableRef(users, { required: true }),
    status: f.enum(
      ["submitted", "queued", "approved", "denied"],
      { required: true },
    ),
    // Null until evaluated.
    assigned_priority: f.enum(
      ["routine", "urgent", "emergent"],
      { nullable: true },
    ),
    // 0 until evaluated; then the triage_rules.version that routed it.
    applied_rule_version: f.int({ default: 0 }),
    // The human-readable reason the priority was assigned.
    matched_criteria: f.text({ default: "" }),
  },
});
