import { workspace } from "@xanots/sdk";

/**
 * The patient-intake-approval-queue backend.
 *
 * A workspace is assembled by registering typed objects onto a workspace()
 * instance and default-exporting it. This starter is intentionally empty and
 * already compiles + deploys — add your first table and endpoint below.
 *
 * ── Add your first table + endpoint ─────────────────────────────────────────
 *
 *   import { workspace, table, apiGroup, query, f, input, s, ref, c, expect, resp } from "@xanots/sdk";
 *
 *   const notes = table({
 *     name: "notes",
 *     // `id` (int PK) + `created_at` (epochms) are auto-injected.
 *     schema: {
 *       body: f.text({ required: true }),
 *     },
 *   });
 *
 *   const api = apiGroup({ name: "notes", canonical: "notes" }); // pin the slug
 *
 *   const createNote = query({
 *     name: "create_note",
 *     verb: "POST",
 *     apiGroup: api,
 *     input: { body: input.text({ required: true }) },
 *     // ...build the stack with the s.* statement helpers...
 *     // Assertions ride along with the object they cover; `npm run xano:test`
 *     // runs them against whatever you last deployed.
 *     tests: [
 *       {
 *         name: "creates a note",
 *         input: { body: c.text("hello") },
 *         expect: [expect.to_be_defined(resp())],
 *       },
 *     ],
 *   });
 *
 *   export default workspace("patient-intake-approval-queue")
 *     .registerTables([notes])
 *     .registerApiGroups([api])
 *     .registerQueries([createNote]);
 *
 * Discover the exact builders and options from the package's own types and its
 * shipped docs — read `node_modules/@xanots/sdk/llms.txt` first (it ends with a
 * map of the `llms/*.md` topic files), then the .d.ts files.
 * See `xano/EXAMPLE.md` for the full walkthrough.
 *
 * ── Optional add-ons ─────────────────────────────────────────────────────────
 * Nothing below is installed. Reach for an add-on when you need it, not before.
 *
 * @xanots/auth registers turnkey auth (user/login/signup) onto this same
 * workspace. Install it first (`xanots marketplace install @xanots/auth`), then
 * `registerAuth(workspace("patient-intake-approval-queue"), { canonical: "authn" })` returns the
 * instance to chain your own .register*() calls onto:
 *
 *   registerAuth(workspace("patient-intake-approval-queue"), { canonical: "authn" })
 *     .registerTables([notes])
 *     .registerApiGroups([api])
 *     .registerQueries([createNote]);
 *
 * That is not the whole catalogue. `xanots marketplace list` prints every
 * published add-on and `xanots marketplace details <package>` prints what one
 * installs plus the registration to paste here — no login required.
 */
export default workspace("patient-intake-approval-queue");
