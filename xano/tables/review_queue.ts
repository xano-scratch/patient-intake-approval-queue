import { table, f } from "@xanots/sdk";
import { intakes } from "./intakes.js";
import { users } from "./users.js";

/**
 * One row per queued intake awaiting clinician action. A priority-ordered read
 * model over `intakes`. `priority_rank` (3 emergent, 2 urgent, 1 routine) lets
 * the queue sort emergent-first without a client-side reordering.
 */
export const reviewQueue = table({
  name: "review_queue",
  schema: {
    intake_id: f.tableRef(intakes, { required: true }),
    priority: f.enum(["routine", "urgent", "emergent"], { required: true }),
    priority_rank: f.int({ required: true }),
    // 0 while unclaimed (an optional FK stores a 0 sentinel, not null).
    claimed_by: f.tableRef(users, { required: true, default: 0 }),
    state: f.enum(["open", "claimed", "resolved"], { required: true }),
  },
  index: [
    { type: "unique", fields: [{ name: "intake_id" }] },
    { type: "btree", fields: [{ name: "priority_rank" }] },
  ],
});
