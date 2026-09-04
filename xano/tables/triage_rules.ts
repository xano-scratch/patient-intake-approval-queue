import { table, f } from "@xanots/sdk";
import { users } from "./users.js";

/**
 * The versioned triage rule set. Only one version is active at a time. Each
 * intake records the version that routed it, so publishing a new version never
 * rewrites how older intakes were decided. The decision stays auditable.
 *
 * `criteria` is an ordered list of `{ field, op, value, priority, reason }`
 * conditions. `evaluate` walks them in order and the first match wins.
 */
export const triageRules = table({
  name: "triage_rules",
  schema: {
    version: f.int({ required: true }),
    is_active: f.bool({ required: true }),
    criteria: f.json(),
    // The clinician who published this version.
    activated_by: f.tableRef(users, { required: true, default: 0 }),
    note: f.text({ default: "" }),
  },
  index: [{ type: "btree", fields: [{ name: "version" }] }],
});
