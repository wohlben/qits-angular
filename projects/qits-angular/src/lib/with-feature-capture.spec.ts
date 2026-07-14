import { ApplicationRef, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { captureOptions, resetCaptureForTesting, setCaptureRelay } from './capture-config';
import { provideQitsIntegration } from './provide-qits-integration';
import {
  mountCaptureButton,
  resetCaptureButtonMountForTesting,
  withFeatureCapture,
} from './with-feature-capture';

const RELAY = { ingestUrl: 'http://qits:8080/api/capture', resourceAttributes: {} };

describe('withFeatureCapture', () => {
  afterEach(() => {
    resetCaptureForTesting();
    resetCaptureButtonMountForTesting();
    document.querySelectorAll('qits-capture-button').forEach((el) => el.remove());
  });

  function mount(): void {
    mountCaptureButton(TestBed.inject(ApplicationRef), TestBed.inject(EnvironmentInjector));
  }

  it('stashes the feature options via an environment initializer', () => {
    TestBed.configureTestingModule({
      providers: [provideQitsIntegration(withFeatureCapture({ renderButton: false }))],
    });
    TestBed.inject(EnvironmentInjector); // creating the environment runs its initializers
    expect(captureOptions().renderButton).toBe(false);
  });

  it('does not mount the button when capture is dark (no relay in config.json)', () => {
    TestBed.configureTestingModule({ providers: [provideQitsIntegration(withFeatureCapture())] });
    mount();
    expect(document.querySelector('qits-capture-button')).toBeNull();
  });

  it('does not mount the button with renderButton: false — captureNow() is the trigger then', () => {
    setCaptureRelay(RELAY);
    TestBed.configureTestingModule({
      providers: [provideQitsIntegration(withFeatureCapture({ renderButton: false }))],
    });
    TestBed.inject(EnvironmentInjector);
    mount();
    expect(document.querySelector('qits-capture-button')).toBeNull();
  });

  it('mounts the button once onto document.body when the relay is lit', () => {
    setCaptureRelay(RELAY);
    TestBed.configureTestingModule({ providers: [provideQitsIntegration(withFeatureCapture())] });
    mount();
    mount();
    const buttons = document.querySelectorAll('qits-capture-button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].parentElement).toBe(document.body);
    // The picker/freeze exclusion convention — the snapshot must not contain its own trigger.
    expect(buttons[0].hasAttribute('data-qits-pick-overlay')).toBe(true);
  });
});
