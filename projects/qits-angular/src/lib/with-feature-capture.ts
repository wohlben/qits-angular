import {
  APP_BOOTSTRAP_LISTENER,
  ApplicationRef,
  createComponent,
  EnvironmentInjector,
  inject,
  provideEnvironmentInitializer,
} from '@angular/core';
import { QitsCaptureButton } from './capture-button.component';
import { captureOptions, isCaptureActive, setCaptureOptions } from './capture-config';
import type { CaptureFeatureOptions } from './capture-config';
import type { QitsIntegrationFeature } from './provide-qits-integration';

/**
 * Feature capture for provideQitsIntegration: the floaty capture button (see
 * QitsCaptureButton), gated by config.json's `capture` relay — standalone runs and capture-less
 * backends show no button. The code always ships; the button appears only where a qits can
 * receive. `renderButton: false` keeps everything but the button: trigger via captureNow().
 */
export function withFeatureCapture(options?: CaptureFeatureOptions): QitsIntegrationFeature {
  return {
    providers: [
      provideEnvironmentInitializer(() => setCaptureOptions(options ?? {})),
      {
        provide: APP_BOOTSTRAP_LISTENER,
        multi: true,
        useFactory: () => {
          // Injected in the factory: inside the listener the injection context is gone, and an
          // app initializer could not inject ApplicationRef at all (cyclic — it is still being
          // constructed there; bootstrap listeners run after it exists).
          const appRef = inject(ApplicationRef);
          const environmentInjector = inject(EnvironmentInjector);
          return () => mountCaptureButton(appRef, environmentInjector);
        },
      },
    ],
  };
}

let mounted = false;

/** Exported for specs; not part of the public API. */
export function mountCaptureButton(
  appRef: ApplicationRef,
  environmentInjector: EnvironmentInjector,
): void {
  if (mounted || !isCaptureActive() || !captureOptions().renderButton) {
    return;
  }
  mounted = true;
  const ref = createComponent(QitsCaptureButton, { environmentInjector });
  // An attached view participates in appRef.tick() — signals + OnPush keep it zoneless-correct.
  appRef.attachView(ref.hostView);
  document.body.appendChild(ref.location.nativeElement);
}

/** Test seam: the module-level mounted flag would otherwise leak across specs. */
export function resetCaptureButtonMountForTesting(): void {
  mounted = false;
}
