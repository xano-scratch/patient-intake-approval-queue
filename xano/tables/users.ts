import { table, f } from "@xanots/sdk";

/**
 * The auth table. Backs identity (a login mints a token against it) and drives
 * API-layer RBAC: every protected endpoint reads the caller's row and checks
 * `role` with `s.precondition`. Auth is enforced at the API layer, never with
 * row-level security.
 */
export const users = table({
  name: "users",
  auth: true,
  schema: {
    email: f.email({ required: true }),
    // Plaintext in, hashed on write. Login reads it back with an explicit
    // `output` (the column is internal) and compares with check_password.
    password: f.password({ required: true }),
    role: f.enum(["intake_clerk", "clinician", "viewer"], { required: true }),
    display_name: f.text({ required: true }),
  },
  index: [{ type: "unique", fields: [{ name: "email" }] }],
});
