import { table, f } from "@xanots/sdk";
import { intakes } from "./intakes.js";
import { users } from "./users.js";

/**
 * The append-only audit log. One row per state change, never updated after
 * insert. Every action records the actor and (via the auto-injected
 * created_at) when it happened, so the full history of an intake is
 * reconstructable: submitted -> evaluated -> claimed -> approved/denied.
 */
export const reviewActions = table({
  name: "review_actions",
  schema: {
    intake_id: f.tableRef(intakes, { required: true }),
    actor_id: f.tableRef(users, { required: true }),
    action: f.enum(
      ["submitted", "evaluated", "claimed", "approved", "denied"],
      { required: true },
    ),
    detail: f.text({ default: "" }),
    // The triage rule version in force for an `evaluated` action; 0 otherwise.
    rule_version: f.int({ default: 0 }),
  },
});
