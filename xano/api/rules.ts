import { query, input, f, s, ref, inp, c, col, expr } from "@xanots/sdk";
import { intakeApi } from "./intake.js";
import { requireRole } from "../lib/guards.js";
import { triageRules } from "../tables/triage_rules.js";
import { users } from "../tables/users.js";

/**
 * All triage rule versions, newest first, with the active one flagged and the
 * name of the clinician who published each. Any signed-in user can read it, so
 * the rule history is auditable.
 */
export const rulesListQuery = query({
  name: "rules",
  verb: "GET",
  apiGroup: intakeApi,
  auth: users,
  stack: [
    s.db.query({
      table: triageRules,
      bind: [
        {
          table: users,
          as: "ab",
          join: "left",
          where: expr(col("activated_by"), "=", col("ab.id")),
        },
      ],
      eval: [{ name: "ab.display_name", as: "activated_by_name" }],
      sort: [{ sortBy: "version", dir: "desc" }],
      as: "rows",
    }),
  ],
  response: ref("rows"),
});

/**
 * Publish a new triage rule version. Clinician only. Deactivates the current
 * version and inserts the new one as active, recording who published it. Older
 * intakes keep pointing at the version that actually routed them, so the change
 * is forward-only and fully auditable, not a hidden edit to how past decisions
 * were made.
 */
export const activateRulesQuery = query({
  name: "rules/activate",
  verb: "POST",
  apiGroup: intakeApi,
  auth: users,
  input: {
    criteria: input.list(
      input.object({
        field: f.text({ required: true }),
        op: f.text(),
        value: f.text({ required: true }),
        priority: f.text({ required: true }),
        reason: f.text(),
      }),
    ),
    note: input.text(),
  },
  stack: [
    ...requireRole("clinician"),
    s.db.query({
      table: triageRules,
      where: expr(col("is_active"), "=", c.bool(true)),
      returnType: "single",
      as: "current",
    }),
    s.lambda({
      as: "next_version",
      code: ({ $var }) =>
        $var.current && $var.current.version ? $var.current.version + 1 : 1,
    }),
    s.conditional({
      when: expr(ref("current"), "!=", c.null()),
      then: [
        s.db.edit({
          table: triageRules,
          fieldName: "id",
          fieldValue: ref("current.id"),
          row: { is_active: false },
        }),
      ],
    }),
    s.db.add({
      table: triageRules,
      row: {
        version: ref("next_version"),
        is_active: true,
        criteria: inp("criteria"),
        activated_by: ref("me.id"),
        note: inp("note"),
      },
      as: "new_rule",
    }),
  ],
  response: ref("new_rule"),
});
