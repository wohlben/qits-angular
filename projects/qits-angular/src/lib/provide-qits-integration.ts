import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';

/**
 * Walking skeleton. Plan 1 (qits repo, docs/feature-ideas/qits-angular-integration-library-1.md)
 * replaces these no-ops with the real integration: config.json-gated OTEL telemetry, error
 * handler, route telemetry — then plans 3 and 4 add feature capture and state snapshots.
 */
export function provideQitsIntegration(): EnvironmentProviders {
  return makeEnvironmentProviders([]);
}

/** Pre-bootstrap hook. Must be awaited before bootstrapApplication once plan 1 lands. */
export async function initQitsIntegration(): Promise<void> {
  // No-op walking skeleton; plan 1 fills this with config-gated telemetry init.
}
