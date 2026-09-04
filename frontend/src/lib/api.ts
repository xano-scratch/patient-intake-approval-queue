// The one contract: derive paths and request/response *types* from your xanots
// query defs. Never hand-type a URL or a request body — change a def and
// everything here follows.
//
// Keep the client bundle lean (the split-route-metadata rule):
//   • `import type` for shapes — InferInput/InferResponse erase to nothing.
//   • Import the ONE lean query def module for its getPath()/verb — never
//     ../../../xano/index.js (that pulls the whole workspace) and never a def
//     whose stack builds a heavy graph (an agent + its tools via s.ai.agent.run):
//     those s.*/c.* factory calls run at module load and can't be tree-shaken out.
//   • For such a stack-heavy endpoint, don't import its def in the browser at all —
//     declare its { path, verb } in the ROUTES table below and verify it against
//     the compiled bundle with `npx xanots routes xano/index.ts`.
//
// This starter has no endpoints yet. Once you add one in xano/, wire it like:
//
//   // Types are free — always import them type-only.
//   import type { InferInput, InferResponse } from "@xanots/sdk";
//   import type { createNoteQuery } from "../../../xano/api/create-note.js";
//
//   // Runtime path/verb: import the lean def value, OR (for a stack-heavy def)
//   // read it from ROUTES so the def never enters the bundle.
//   import { createNoteQuery } from "../../../xano/api/create-note.js";
//
//   export type CreateNoteBody = InferInput<typeof createNoteQuery>;
//   export type Note = InferResponse<typeof createNoteQuery>;
//
//   export async function createNote(body: CreateNoteBody): Promise<Note> {
//     const res = await fetch(XANO_HOST + createNoteQuery.getPath(), {
//       method: createNoteQuery.verb,
//       headers: { "content-type": "application/json" },
//       body: JSON.stringify(body),
//     });
//     if (!res.ok) throw new Error(await res.text());
//     return res.json();
//   }
//
// The stack-heavy escape hatch — plain metadata, no def import, no bundle cost.
// Keep it in sync with `npx xanots routes xano/index.ts` (it prints verb + path):
//
//   export const ROUTES = {
//     triageRequest: { path: "/api:notes/triage_request", verb: "POST" },
//   } as const;

/**
 * The deployed Xano backend's base URL. Injected as `window.XANO_HOST` by
 * `xanots deploy <entry> --static <dir>`, or read from `VITE_XANO_HOST` in dev.
 * Empty string when neither is set (the UI runs with no backend).
 */
export const XANO_HOST: string =
  (typeof window !== "undefined" && (window as { XANO_HOST?: string }).XANO_HOST) ||
  import.meta.env.VITE_XANO_HOST ||
  "";
