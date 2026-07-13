# @qits/angular

The integration library for Angular apps managed by [qits](https://github.com/wohlben/qits) —
a tool that runs each git branch as a containerized workspace with dev-server daemons, telemetry,
a web view, and a coding agent. Instead of copy-pasting integration files from a fixture repo,
an app takes this library as a dependency.

The library packages the SPA half of the qits observability convention
([spa-observability](https://github.com/wohlben/qits/blob/main/docs/features/2026-07-06_spa-observability.md),
[meta-enrichment](https://github.com/wohlben/qits/blob/main/docs/features/2026-07-11_spa-telemetry-meta-enrichment.md)).
When the backend's identity relay reports a telemetry target, the app exports OTLP protobuf
traces + logs through its own backend's passthrough:

- document-load + fetch spans (client spans with `traceparent` propagation into the backend trace);
- `Navigation` spans and `app.route.path`/`app.route.url` stamped on **every** span and log record;
- click/submit interaction spans, named by a `data-track-event` DOM attribute;
- `code.*` caller attribution on fetch spans (which file/method issued the request);
- uncaught errors shipped as ERROR-severity log records via a provided Angular `ErrorHandler`.

Everything is gated by the backend's `api/config.json` relay: an app running standalone (or with
the qits daemon's otel toggle off) gets `telemetry: null` and the library stays **dark** — no SDK
objects constructed, `window.fetch` untouched, inert dead weight. There is no build-time
configuration; the config relay is the only runtime channel. Later plans add feature capture and
state snapshots as `provideQitsIntegration(withFeature…)` arguments.

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

**Zoneless apps:** `@opentelemetry/instrumentation-user-interaction` (a dependency of this
library) declares a hard `zone.js` peer it doesn't actually need in a zoneless app. Mark it
optional in the consumer's `package.json` so the lockfile stays zone-free (a peer-warning
silencer only — the install works without it):

```json
{
  "pnpm": {
    "packageExtensions": {
      "@opentelemetry/instrumentation-user-interaction": {
        "peerDependenciesMeta": { "zone.js": { "optional": true } }
      }
    }
  }
}
```

## Usage

Two lines, and the ordering of the first is load-bearing:

```ts
// main.ts — initQitsIntegration MUST complete before bootstrapApplication: Angular's
// FetchBackend captures window.fetch on first use, so the fetch instrumentation has to patch it
// first for API calls to get client spans and traceparent propagation.
initQitsIntegration()
  .catch(() => undefined)
  .then(() => bootstrapApplication(App, appConfig))
  .catch((err) => console.error(err));
```

```ts
// app.config.ts
providers: [
  provideBrowserGlobalErrorListeners(), // keep the scaffold default: feeds global errors into the ErrorHandler
  provideRouter(routes),
  provideQitsIntegration(),             // ErrorHandler + Navigation spans + app.route.* stamping
  provideHttpClient(withFetch()),       // required: the default XHR backend is invisible to the fetch instrumentation
],
```

Name interactions with a framework-free DOM attribute — put `data-track-event="<name>"` on the
event **target or an ancestor** (a submit event's target is the *form*, so name forms, not their
buttons):

```html
<form data-track-event="save-greeting" (ngSubmit)="submit()">…</form>
```

### The backend contract

The library talks only to its own backend, base-relative (so it works at `/` and under the qits
web-view path prefix alike):

- `GET api/config.json` — the identity relay. `{ "telemetry": null }` keeps the library dark;
  `{ "telemetry": { "serviceName": …, "resourceAttributes": … } }` lights it (the browser's
  service name gets a `-browser` suffix). Override the path via
  `initQitsIntegration({ configUrl: … })`.
- `POST api/otel/v1/{traces|logs}` — verbatim OTLP protobuf passthrough to the real collector.

Both resources are small app-side copies for Quarkus backends — see the
[qits integration guide](https://github.com/wohlben/qits/blob/main/docs/guides/quarkus-angular-integration.md)
(Tier 5) for `ConfigResource`/`OtelProxyResource` and the required
`quarkus.otel.traces.suppress-application-uris` property.

### Serving under a path prefix

Apps served under the qits daemon web view get their prefix at runtime. The rebase must run
before any module code, so it stays an inline `index.html` script — the canonical snippet:

```html
<base href="/">
<script>
  (function () {
    var match = location.pathname.match(/^\/daemon\/[^/]+\/[^/]+\//);
    if (match) document.querySelector('base').setAttribute('href', match[0]);
  })();
</script>
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
