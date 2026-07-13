# CLAUDE.md — `@qits/angular`

The integration library for Angular apps managed by [qits](https://github.com/wohlben/qits):
config.json-gated browser OTEL telemetry (traces + logs, route/interaction/caller enrichment,
error shipping). Later qits plans add feature capture and state snapshots as
`provideQitsIntegration(withFeature…)` arguments. See `README.md` for the consumer contract.

## Shape of the integration (traps are load-bearing — don't "clean them up")

Public API (all of `public-api.ts`): `initQitsIntegration(options?)` (pre-bootstrap, fetches the
`api/config.json` identity relay, stays dark on `telemetry: null`, otherwise wires the OTEL web
SDKs) and `provideQitsIntegration(...features)` (DI: `TelemetryErrorHandler` + route telemetry;
`QitsIntegrationFeature.providers` is the tree-shakable seam for later features). The two-phase
shape is not incidental: Angular's `FetchBackend` captures `window.fetch` on first use, so
`initQitsIntegration()` must complete **before** `bootstrapApplication`.

Ported verbatim from the qits fixture (`testing-repo-quarkus-angular`), each encoding a trap
(details in qits' `docs/features/2026-07-06_spa-observability.md` and
`2026-07-11_spa-telemetry-meta-enrichment.md`):

- `init-qits-integration.ts` — exporter URLs are used **verbatim** by the proto exporters
  (resolve per-signal URLs from `document.baseURI`); `ignoreUrls` excludes the `api/otel/v1/`
  passthrough (else exports instrument themselves recursively); 1 s flush (iframe removal fires
  no pagehide — the default 5 s buffer silently loses spans).
- `route-context.ts` — module-level current-route state; stamping processors put
  `app.route.path`/`app.route.url` on every span/log record.
- `route-telemetry.ts` — `Navigation` spans + route tracking as an app initializer (router
  wiring needs the injector, so it can't live in the pre-bootstrap init).
- `interaction-telemetry.ts` — enrichment via the instrumentation's
  `shouldPreventSpanCreation` hook (despite the name); `data-track-event` is read from
  `closest()`, because a submit's target is the form.
- `fetch-caller-attribution.ts` — `window.fetch` wrapper installed **before**
  FetchInstrumentation registers so it runs inside the fetch span's context;
  `Error.stackTraceLimit` lifted around capture (plumbing alone is ~50 frames).
- `telemetry-error-handler.ts` — zoneless Angular funnels all errors through `ErrorHandler`,
  never `window` listeners; apps keep `provideBrowserGlobalErrorListeners()`.

The library is **zoneless-first**: no `zone.js`, no `@opentelemetry/context-zone` — the default
stack context manager is correct. The `instrumentation-user-interaction` `zone.js` peer is
marked optional via a pnpm `packageExtensions` entry here and in every consumer.

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
