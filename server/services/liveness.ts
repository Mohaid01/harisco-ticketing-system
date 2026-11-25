import type { LivenessEvidence } from '../types/index.ts';

export interface LivenessCheck {
  ok: boolean;
  reason?: string;
  evidence?: LivenessEvidence;
}

/** Thresholds mirror the on-device rules in src/lib/faceVision.ts. */
const MIN_FRAMES = 8;
const MIN_BLINKS = 1;
const MIN_BLINK_DEPTH = 0.35;
const MIN_BLINK_MS = 100;
const MAX_BLINK_MS = 1500;
const MIN_FACE_WIDTH = 0.12;
const MAX_FACE_WIDTH = 0.95;

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/**
 * Sanity-check the on-device liveness evidence that accompanies a punch frame.
 * The browser owns the camera, so this cannot prove liveness on its own — it
 * rejects degenerate series (no blink, impossible timing, no motion) so a bare
 * static image or a replayed API call does not sail through untouched.
 */
export const validateLivenessEvidence = (raw: unknown): LivenessCheck => {
  if (typeof raw !== 'string' || raw.length === 0) {
    return { ok: false, reason: 'Missing liveness evidence.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'Malformed liveness evidence.' };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, reason: 'Malformed liveness evidence.' };
  }

  const evidence = parsed as Partial<LivenessEvidence>;
  const blinks = Array.isArray(evidence.blinks) ? evidence.blinks : [];

  if (!isFiniteNumber(evidence.framesProcessed) || evidence.framesProcessed < MIN_FRAMES) {
    return { ok: false, reason: 'Not enough camera frames were analysed.' };
  }

  const validBlinks = blinks.filter(
    (blink) =>
      blink &&
      isFiniteNumber(blink.depth) &&
      blink.depth >= MIN_BLINK_DEPTH &&
      isFiniteNumber(blink.durationMs) &&
      blink.durationMs >= MIN_BLINK_MS &&
      blink.durationMs <= MAX_BLINK_MS
  );

  if (validBlinks.length < MIN_BLINKS) {
    return { ok: false, reason: 'No eye blink detected.' };
  }

  const faceWidthFrac = evidence.faceWidthFrac;
  if (!isFiniteNumber(faceWidthFrac) || faceWidthFrac < MIN_FACE_WIDTH || faceWidthFrac > MAX_FACE_WIDTH) {
    return { ok: false, reason: 'Face was not framed correctly.' };
  }

  return { ok: true, evidence: evidence as LivenessEvidence };
};
