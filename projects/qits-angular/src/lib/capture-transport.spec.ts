import type { CapturePayload } from './capture-payload';
import {
  CaptureError,
  DAEMON_BASE_PATTERN,
  captureTargetUrl,
  postCapture,
} from './capture-transport';

const RELAY = {
  ingestUrl: 'http://qits:8080/api/capture',
  resourceAttributes: { 'qits.repository.id': 'r1' },
};

function payload(): CapturePayload {
  return {
    capturedAt: '2026-07-14T00:00:00.000Z',
    identity: { 'qits.repository.id': 'r1', 'qits.workspace.id': null },
    page: { url: location.href, appPath: '', routePattern: null, title: '' },
    environment: {
      viewport: { width: 1, height: 1, devicePixelRatio: 1 },
      userAgent: 'spec',
      prefersColorScheme: 'light',
    },
    dom: { html: '<html></html>', truncated: false, bytes: 13 },
  };
}

async function gunzipJson(body: ArrayBuffer): Promise<unknown> {
  const stream = new Response(body).body!.pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).json();
}

describe('captureTargetUrl', () => {
  const originalPath = location.pathname;

  afterEach(() => {
    history.replaceState(null, '', originalPath);
  });

  it('uses the relayed ingestUrl verbatim when not framed under the daemon proxy', () => {
    history.replaceState(null, '', '/greeting/anna');
    expect(captureTargetUrl(RELAY)).toBe('http://qits:8080/api/capture');
  });

  it('posts same-origin under a /daemon/{ws}/{daemon}/ base — the frame origin IS qits', () => {
    history.replaceState(null, '', '/daemon/work/daemon-1/greeting/anna');
    expect(captureTargetUrl(RELAY)).toBe(new URL('/api/capture', location.origin).href);
  });

  it('the daemon base needs both segments', () => {
    expect(DAEMON_BASE_PATTERN.test('/daemon/only-one/')).toBe(false);
    expect(DAEMON_BASE_PATTERN.test('/daemon/ws/d1/')).toBe(true);
  });
});

describe('postCapture', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = window.fetch;
  });

  afterEach(() => {
    window.fetch = originalFetch;
  });

  function stubFetch(response: Partial<Response> | Error): ReturnType<typeof vi.fn> {
    const mock =
      response instanceof Error
        ? vi.fn().mockRejectedValue(response)
        : vi.fn().mockResolvedValue(response);
    window.fetch = mock as unknown as typeof fetch;
    return mock;
  }

  it('gzip-POSTs the payload; the body decompresses back to the JSON document', async () => {
    const mock = stubFetch({
      status: 201,
      json: () => Promise.resolve({ url: 'http://qits/workspace' }),
    } as Partial<Response>);
    const result = await postCapture(payload(), 'http://qits:8080/api/capture');

    expect(result).toEqual({ url: 'http://qits/workspace' });
    const [url, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://qits:8080/api/capture');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      'Content-Encoding': 'gzip',
    });
    await expect(gunzipJson(init.body as ArrayBuffer)).resolves.toEqual(payload());
  });

  it('rejects with a CaptureError on a non-201 status', async () => {
    stubFetch({ status: 413 } as Partial<Response>);
    await expect(postCapture(payload(), 'http://x/api/capture')).rejects.toThrowError(
      CaptureError,
    );
  });

  it('rejects with a CaptureError when the endpoint is unreachable', async () => {
    stubFetch(new Error('offline'));
    await expect(postCapture(payload(), 'http://x/api/capture')).rejects.toThrow(
      'Could not reach the qits capture endpoint',
    );
  });

  it('rejects when a 201 carries no workspace URL', async () => {
    stubFetch({ status: 201, json: () => Promise.resolve({}) } as Partial<Response>);
    await expect(postCapture(payload(), 'http://x/api/capture')).rejects.toThrow(
      'no workspace URL',
    );
  });
});
