# patient-intake-approval-queue

A [XanoTS](https://www.npmjs.com/package/@xanots/sdk) project: a Xano
backend authored in TypeScript under [`xano/`](xano/), and a React + Vite
frontend under [`frontend/`](frontend/) that derives its request paths and
types from the backend defs — so the two can't drift.

## Quick start

```bash
npm install
npm run dev          # run the frontend (no backend needed yet)
```

Then author your backend in [`xano/index.ts`](xano/index.ts) — start with the
walkthrough in [`xano/EXAMPLE.md`](xano/EXAMPLE.md).

## Deploy

```bash
xanots login            # once, to authenticate against your Xano account
npm run xano:deploy     # build the frontend, then ship it with the backend
```

- `npm run xano:export` compiles the backend to `workspace.json` (don't commit it).
- `npm run xano:deploy` deploys the backend and the built frontend to a live
  **ephemeral** environment and prints its URL. Run it again to refresh the same
  environment; if it expired, a fresh one is created and the new URL is called out.
- `xanots status` says who you are signed in as, which workspace you are bound to, and
  which environment this project last deployed to — its URL, and when it expires. You
  never have to remember the environment's name.
- `npm run xano:test` runs the tests the DEPLOYED environment carries — the `tests`
  on a query/function/middleware and any `workflowTest()`. It compiles nothing, so
  deploy first. A failing suite exits 5, distinct from a crash. `xanots deploy
  ./xano/index.ts --test` does both in one step.

## `xano.lock` — commit it

Object identity derives from `(type, name)`, so a rename would otherwise change
an object's guid and the engine would **delete and recreate** it rather than
renaming it in place — losing its rows on a record-preserving import.
[`xano/xano.lock`](xano/xano.lock) freezes each guid and each API group's
canonical slug, so renames and re-deploys keep the same identities (and the same
public URLs).

Every build writes it — no flag — and it **must be committed**. Ignoring it means
each build mints identities and public URLs that are thrown away and re-invented
next time. If you release to a workspace that already exists, adopt what it
already serves first with `xanots lock import <live-bundle.json> --lock=xano/xano.lock`;
that is also the recovery path once identities have drifted.

```bash
npm run xano:check      # CI: fail if the export would change xano.lock
```

To rename an object: rename it in code, run `npm run xano:export` (stderr prints
the exact fix-up), run `xanots lock rename <kind> <old> <new> --lock=xano/xano.lock`,
then export again. `lock rename` and `lock import` need that flag here — they take no
entry file, so they look for the lock in the current directory, while
`lock prune ./xano/index.ts` derives it from the entry like `export` does.

## The one contract

[`frontend/src/lib/api.ts`](frontend/src/lib/api.ts) imports the XanoTS query
defs and derives paths (`getPath()`) and request/response types
(`InferInput` / `InferResponse`) from them. Never hand-type a URL or a request
body — change a def and the frontend types follow.

> To spot-check a def from Node (read `getPath()`/`verb`, log a value), run a real
> file with `tsx <file.ts>` **from inside the project root** — not `tsx -e`, not
> bare `node file.ts`, and not from another directory (they mis-resolve the
> intra-workspace `.js` imports and the `@xanots/sdk` specifier). Or use
> `xanots routes xano/index.ts` to list every endpoint's verb + path.

## The frontend

React + Vite, styled with [Tailwind CSS](https://tailwindcss.com) v4 and
[shadcn/ui](https://ui.shadcn.com). shadcn is not a dependency — its components
are copied into [`frontend/src/components/ui/`](frontend/src/components/ui/) and
owned by this project, so edit them freely. `Button` and `Card` are already
there; add more with:

```bash
npx shadcn@latest add dialog input form
```

[`components.json`](components.json) is pre-configured, so that works with no
`shadcn init` step. Icons are [Lucide](https://lucide.dev/icons), installed as `lucide-react` and
imported by name from the package root —
`import { ArrowRight } from "lucide-react";`.
[`frontend/src/App.tsx`](frontend/src/App.tsx) already uses one.

Components import through the `@/` alias
(`@/components/ui/button`, `@/lib/utils`), which maps to `frontend/src/` in both
`tsconfig.json` and `vite.config.ts` — change one and change the other.

Colors come from the theme tokens in
[`frontend/src/index.css`](frontend/src/index.css) — see **Theming** below.

## Theming

Scaffolded with the **Zinc Blue** theme. Every color in the app comes from
the semantic tokens at the top of
[`frontend/src/index.css`](frontend/src/index.css) — `--primary`,
`--muted-foreground`, `--border`, the `--chart-*` ramp, the `--sidebar-*` set —
and every shadcn component reads those names, so editing one value rebrands
everything that uses it. Style with the token classes (`bg-primary`,
`text-muted-foreground`) rather than raw palette classes like `bg-gray-100`, or
the theme stops being one.

Tailwind v4 has no `tailwind.config.js`; that stylesheet *is* the config.

To swap the whole palette later:

```bash
npx shadcn@latest add https://ui.shadcn.com/r/themes/stone.json   # or any registry theme
```

Dark mode follows the OS until the user says otherwise. The pieces:
an inline script in the HTML entry applies the mode before first paint,
[`frontend/src/lib/theme.ts`](frontend/src/lib/theme.ts) holds and persists it,
and the mode toggle on the landing page cycles system → light → dark.

## Add-ons

XanoTS is composable with other `@xanots/*` packages:

- **[`@xanots/auth`](https://www.npmjs.com/package/@xanots/auth)** — turnkey
  authentication (user/login/signup tables and endpoints). Install it with
  `xanots marketplace install @xanots/auth`, then register it in
  `xano/index.ts`. Authentication only — **not** authorization: it has no
  roles, permissions, or route guards. Build those with `@xanots/sdk` (a role
  column plus a `s.precondition` per endpoint).
- More `@xanots/*` packages register onto the same workspace. This list
  does not update itself — run `xanots marketplace list` for the live
  catalogue, `xanots marketplace search <words>` to narrow it, and
  `xanots marketplace details <package>` to see what an add-on installs and
  how to register it. All three work before you log in.

None of these ship with the scaffold. Install one only when you need it — an
add-on you never register is weight in `package.json` for nothing.
