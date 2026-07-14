import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { QitsCaptureButton } from './capture-button.component';
import { resetCaptureForTesting, setCaptureRelay } from './capture-config';
import { setNavigateTopForTesting } from './capture-navigation';
import type { CapturePayload } from './capture-payload';

/**
 * The full press gesture needs a real layout engine (the press freezes this very document), so
 * this runs in Vitest browser mode.
 */

const RELAY = {
  ingestUrl: 'http://qits:8080/api/capture',
  resourceAttributes: { 'qits.repository.id': 'repo-1', 'qits.workspace.id': 'work-1' },
};

async function gunzipJson(body: ArrayBuffer): Promise<CapturePayload> {
  const stream = new Response(body).body!.pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).json() as Promise<CapturePayload>;
}

describe('QitsCaptureButton', () => {
  let fixture: ComponentFixture<QitsCaptureButton>;
  let originalFetch: typeof fetch;
  let navigate: ReturnType<typeof vi.fn<(url: string) => void>>;

  beforeEach(() => {
    originalFetch = window.fetch;
    navigate = vi.fn<(url: string) => void>();
    setNavigateTopForTesting(navigate);
    setCaptureRelay(RELAY);
    fixture = TestBed.createComponent(QitsCaptureButton);
    fixture.detectChanges();
  });

  afterEach(() => {
    window.fetch = originalFetch;
    setNavigateTopForTesting(undefined);
    resetCaptureForTesting();
  });

  function stubFetch(response: Partial<Response> | Promise<Partial<Response>>): ReturnType<
    typeof vi.fn
  > {
    const mock = vi.fn().mockReturnValue(Promise.resolve(response));
    window.fetch = mock as unknown as typeof fetch;
    return mock;
  }

  function pressButton(): void {
    (fixture.nativeElement as HTMLElement).querySelector('button')!.click();
  }

  it('press → spinner → gzip POST carrying the frozen page and relayed identity → navigate', async () => {
    let releaseIngest!: (r: Partial<Response>) => void;
    const mock = stubFetch(new Promise<Partial<Response>>((r) => (releaseIngest = r)));

    pressButton();
    await vi.waitFor(() => expect(mock).toHaveBeenCalled());
    fixture.detectChanges();

    // Busy: spinner shown, button disabled — presses can't stack.
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    expect(button.disabled).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('.qits-capture-spinner')).not.toBeNull();

    releaseIngest({ status: 201, json: () => Promise.resolve({ url: 'http://qits/new-ws' }) });
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('http://qits/new-ws'));

    const [url, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(RELAY.ingestUrl);
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      'Content-Encoding': 'gzip',
    });
    const payload = await gunzipJson(init.body as ArrayBuffer);
    expect(payload.identity).toEqual({
      'qits.repository.id': 'repo-1',
      'qits.workspace.id': 'work-1',
    });
    expect(payload.dom.html).toContain('<!doctype html>');
    // The button never captures itself (its host is marked data-qits-pick-overlay).
    expect(payload.dom.html).not.toContain('<qits-capture-button');
  });

  it('a failed ingest shows a retry-able toast, never navigates — and the retry re-posts', async () => {
    const failing = stubFetch({ status: 500 } as Partial<Response>);

    pressButton();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('.qits-capture-toast'),
      ).not.toBeNull();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(failing).toHaveBeenCalledTimes(1);

    // The app is undisturbed and the button pressable — the next press retries the whole gesture.
    stubFetch({ status: 201, json: () => Promise.resolve({ url: 'http://qits/new-ws' }) });
    pressButton();
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('http://qits/new-ws'));
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.qits-capture-toast')).toBeNull();
  });
});
