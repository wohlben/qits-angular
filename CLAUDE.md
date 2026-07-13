# CLAUDE.md — `@qits/angular`

The integration library for Angular apps managed by [qits](https://github.com/wohlben/qits).
Currently a walking skeleton (no-op providers); later qits plans add OTEL telemetry, feature
capture, and state snapshots. See `README.md` for the consumer contract.

## Commands

- `pnpm build` — `ng build qits-angular` → APF output in `dist/qits-angular/`
- `pnpm test` — `ng test qits-angular` (vitest builder)
- `pnpm lint` — `ng lint qits-angular`
- `pnpm check-exports` — verify the root manifest mirrors `dist/qits-angular/package.json`

## Workspace layout & the root-manifest takeover

Standard `ng new` workspace (`--create-application=false`) plus one library project under
`projects/qits-angular/`. The one non-standard thing:

**The root `package.json` *is* the installable package.** Distribution is git-only — a consumer's
`pnpm add "git+https://…#<sha>"` installs the **repo root**, not a published tarball. So the root
manifest was rewritten from the generated workspace shell to *be* `@qits/angular`: real `name`,
`exports`/`files` into the built `dist/qits-angular/`, `prepare` as the consumer-side build hook,
real `peerDependencies`. The Angular runtime lives in `devDependencies` (needed to build locally,
never shipped — consumers get only `dist/` via `files`).

### Packaging invariants (don't break)

- **Root manifest is the package** — name/`exports`/`files`/`prepare`/peers live at the root.
- **`files: ["dist/qits-angular"]`** carries the build; anything outside is dropped on pack.
- **`prepare` = `ng build qits-angular && check-exports`** — runs on consumer install; that is the
  distribution mechanism.
- **Root `exports`/`peers` mirror `dist/qits-angular/package.json`** — never hand-edit them on a
  hunch. Run `pnpm build && pnpm check-exports` and copy what dist actually says. `check-exports`
  is wired into `prepare`.
- **`private: true` stays** — it blocks registry publishing (intended), not git installs.
- **`dist/` is never committed on `main`** — it is rebuilt by `prepare`.

## Conventions (inherited from the qits webui)

- **Every export goes through `projects/qits-angular/src/public-api.ts`.**
- Standalone components only; `ChangeDetectionStrategy.OnPush`.
- `input()` / `output()` / `computed()` functions — never the decorator forms.
- `inject()` over constructor injection.
- Native control flow (`@if` / `@for` / `@switch`), not `*ngIf` / `*ngFor`.
- No `any`.
- Component selector prefix `qits` (kebab-case); directive prefix `qits` (camelCase).
