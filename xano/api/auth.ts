import { query, input, s, ref, inp, c, expr } from "@xanots/sdk";
import { intakeApi } from "./intake.js";
import { users } from "../tables/users.js";

/**
 * The login surface. Public (no role guard). Verifies the credential and mints
 * a token, returning the caller's role so the frontend knows which actions to
 * offer. The token is what every protected endpoint checks; the role check
 * itself still happens server-side on each call, not from this response.
 */
export const loginQuery = query({
  name: "auth/login",
  verb: "POST",
  apiGroup: intakeApi,
  auth: false,
  input: {
    email: input.email({ required: true, methods: ["lower", "trim"] }),
    // Plaintext, NOT input.password (that would double-hash and never match).
    password: input.text({ required: true }),
  },
  stack: [
    s.db.get({
      table: users,
      fieldName: "email",
      fieldValue: inp("email"),
      // password is internal; name it explicitly to read the hash back.
      output: ["id", "email", "password", "role", "display_name"],
      as: "u",
    }),
    // One generic message for both misses, so login never reveals which emails exist.
    s.precondition({
      expr: expr(ref("u", { safe: true }), "!=", c.null()),
      error: c.text("Invalid email or password."),
      error_type: "unauthorized",
    }),
    s.security.check_password({
      text_password: inp("password"),
      hash_password: ref("u.password"),
      as: "ok",
    }),
    s.precondition({
      expr: expr(ref("ok"), "=", c.bool(true)),
      error: c.text("Invalid email or password."),
      error_type: "unauthorized",
    }),
    s.security.create_auth_token({ table: users, id: ref("u.id"), as: "token" }),
  ],
  response: {
    token: ref("token"),
    role: ref("u.role"),
    display_name: ref("u.display_name"),
    user_id: ref("u.id"),
  },
});
