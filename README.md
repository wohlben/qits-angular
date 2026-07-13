# @qits/angular

The integration library for Angular apps managed by [qits](https://github.com/wohlben/qits) —
a tool that runs each git branch as a containerized workspace with dev-server daemons, telemetry,
a web view, and a coding agent. Instead of copy-pasting integration files from a fixture repo,
an app takes this library as a dependency.

This is currently a **walking skeleton**: `provideQitsIntegration()` and `initQitsIntegration()`
are no-ops. Later qits plans fill them with the real integration (OTEL telemetry, feature capture,
state snapshots). The skeleton exists to prove the distribution mechanics.

## Install

Distribution is **git-only, no npm registry** (prototype phase). Consumers install from a commit:

```bash
pnpm add "git+https://github.com/wohlben/qits-angular.git#<sha>"
```

pnpm clones the repo, installs its devDependencies, runs `prepare` (which builds `dist/`), then
packs using the `files` field.

**Required consumer-side step:** pnpm 10 gates dependency lifecycle scripts, and the git-dep
`prepare` build is *not* auto-exempt (verified against pnpm 10.33.0 — the install fails with
`ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED` otherwise). Allowlist this package in the **consumer's**
`package.json`:

```json
{ "pnpm": { "onlyBuiltDependencies": ["@qits/angular"] } }
```

(pnpm's error also accepts the same key in `pnpm-workspace.yaml`; the `package.json` form above is
what this repo verified.)

## Usage

```ts
// main.ts
await initQitsIntegration();          // before bootstrapApplication
```

```ts
// app.config.ts
providers: [provideQitsIntegration()]
```

## Developing against a consumer

Iterate with a local override — **never churn git refs**:

```bash
pnpm add "file:../qits-angular"       # or: pnpm link ../qits-angular
```

Commit a `#<sha>` pin in the consumer only when cutting a consumable state.

## Packaging invariants (don't break these)

- **The root `package.json` *is* the package** — a git dependency installs the repo root, so the
  root manifest carries name/`exports`/`files`/`prepare`/peers, not the workspace-shell defaults.
- **`files: ["dist/qits-angular"]` carries the build** — anything outside `files` is dropped when
  pnpm packs the git dep.
- **`prepare` builds on consumer install** — `ng build qits-angular && check-exports`; that second
  run (consumer-side) is the whole distribution mechanism.
- **Root `exports`/`peers` mirror `dist/qits-angular/package.json`** — ng-packagr writes the
  authoritative manifest there; the consumer never sees it (they install the root), so the root
  must mirror it. `pnpm check-exports` guards the mirror and is wired into `prepare`.

## Regression check (smoke the git install)

```bash
pnpm dlx @angular/cli@21 new smoke --minimal --skip-git --defaults && cd smoke
pnpm add "git+file://$(realpath ../qits-angular)#main"   # local git URL
pnpm ng build                                            # compiles against installed dist types
pnpm remove @qits/angular
pnpm add "git+https://github.com/wohlben/qits-angular.git#<sha>"   # real remote, SHA-pinned
pnpm ng build
```

## Commands

| Command | What it does |
| --- | --- |
| `pnpm build` | `ng build qits-angular` → APF output in `dist/qits-angular/` |
| `pnpm test` | `ng test qits-angular` (vitest builder) |
| `pnpm lint` | `ng lint qits-angular` |
| `pnpm check-exports` | verify root manifest mirrors `dist/qits-angular/package.json` |
