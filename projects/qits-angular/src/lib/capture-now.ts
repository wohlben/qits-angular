import { captureOptions, captureRelay } from './capture-config';
import { buildCapturePayload } from './capture-payload';
import { CaptureError, captureTargetUrl, postCapture } from './capture-transport';
import { freezeDocument } from './document-freeze';

export interface CaptureResult {
  /** Browser URL of the created qits workspace — navigate there, or don't; your trigger, your call. */
  url: string;
}

/**
 * Snapshot the running app into qits: freeze the document, POST it to the capture ingest,
 * resolve the created workspace's URL. Resolves instead of navigating — the shipped button
 * navigates the top window on success, custom triggers (withFeatureCapture({renderButton:
 * false})) choose their own follow-through.
 */
export async function captureNow(): Promise<CaptureResult> {
  const relay = captureRelay();
  if (!relay) {
    throw new CaptureError(
      'Capture is not active: config.json reported no capture relay (app running standalone?)',
    );
  }
  const dom = freezeDocument(document, { maxBytes: captureOptions().maxDomBytes });
  if (!dom) {
    throw new CaptureError('Could not freeze the document');
  }
  return postCapture(buildCapturePayload(dom, relay), captureTargetUrl(relay));
}
