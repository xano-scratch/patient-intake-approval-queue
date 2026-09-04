import { s, auth, ref, c, expr, or, statements } from "@xanots/sdk";
import { users } from "../tables/users.js";

/**
 * API-layer RBAC. Reads the caller's own row (so a role change takes effect
 * immediately, no re-login) and rejects with HTTP 403 when their role is not in
 * the allowed set. Returned via `statements(...)` so spreading it into an
 * endpoint's stack keeps the tuple type intact and `InferResponse` still works.
 *
 * Binds `me` (id, role, display_name) for the rest of the stack to use as the
 * acting user (e.g. the actor on an audit row).
 */
export function requireRole(...roles: string[]) {
  const check =
    roles.length === 1
      ? expr(ref("me.role"), "=", c.text(roles[0]))
      : or(...roles.map((r) => expr(ref("me.role"), "=", c.text(r))));

  return statements(
    s.db.get_by_id({
      table: users,
      id: auth("id"),
      output: ["id", "role", "display_name"],
      as: "me",
    }),
    s.precondition({
      expr: check,
      error: c.text("Your role is not permitted to perform this action."),
      error_type: "accessdenied",
    }),
  );
}
