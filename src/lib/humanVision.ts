import { Human, match } from '@vladmandic/human';

/** Face detection + embedding + liveness, entirely on-device. No video ever leaves the phone. */

export const ENROLL_STAGES: ('center' | 'blink' | 'turn-a' | 'turn-b')[] = [
  'center',
  'blink',
  'turn-a',
  'turn-b',
];

export const VERIFY_STAGES: ('center' | 'blink')[] = ['center', 'blink'];

export interface LivenessSnapshot {
  version: number;
  blinks: number;
  framesProcessed: number;
  faceWidthFrac: number;
  yawRangeDeg: number;
  brightness: number;
  durationMs: number;
  startedAt: string;
}

export interface FaceCaptureResult {
  embeddings: number[][];
  evidence: LivenessSnapshot;
}

let humanPromise: Promise<Human> | null = null;

/** Lazily initialize vladmandic/human (TFJS backend + face models). */
export const loadHuman = async (): Promise<Human> => {
  if (!humanPromise) {
    humanPromise = (async () => {
      const human = new Human({
        modelBasePath: '/models/human/',
        warmup: 'face',
        debug: false,
        face: {
          enabled: true,
          detector: { minConfidence: 0.4, maxDetected: 1, minSize: 30, scale: 1.25, square: true, rotation: true },
          mesh: { enabled: true, keepInvalid: false },
          description: { enabled: true, minConfidence: 0.4 },
          iris: { enabled: true },
          antispoof: { enabled: true },
          liveness: { enabled: true },
          emotion: { enabled: false },
          gear: { enabled: false },
          attention: { enabled: false },
        },
        body: { enabled: false },
        hand: { enabled: false },
        object: { enabled: false },
        gesture: { enabled: true },
        segmentation: { enabled: false },
      });
      await human.init();
      return human;
    })().catch((error: unknown) => {
      humanPromise = null;
      throw error;
    });
  }
  return humanPromise;
};

export interface DetectedFace {
  box: [number, number, number, number];
  boxRaw: [number, number, number, number];
  embedding: number[] | null;
  gaze: { yaw: number; pitch: number; roll: number };
  blink: boolean;
  isFacingLeft: boolean;
  isFacingRight: boolean;
}

/** Run one detection frame on a video element. Returns null when no usable face. */
export const detectFace = async (
  human: Human,
  video: HTMLVideoElement
): Promise<DetectedFace | null> => {
  const result = await human.detect(video);
  const faces = result.face;
  if (!faces || faces.length === 0) return null;

  const face = faces[0];
  const embedding = face.embedding ?? null;
  const box = (face.box ?? [0, 0, 0, 0]) as [number, number, number, number];
  const boxRaw = (face.boxRaw ?? [0, 0, 0, 0]) as [number, number, number, number];
  const annotations = face.annotations ?? {};

  // 1. Gesture detection from Human
  const gestures = Array.isArray(result.gesture) ? result.gesture : [];
  const gestureBlink = gestures.some(
    (g) => typeof g.gesture === 'string' && g.gesture.toLowerCase().includes('blink')
  );
  let isFacingLeft = gestures.some(
    (g) => typeof g.gesture === 'string' && g.gesture.toLowerCase() === 'facing left'
  );
  let isFacingRight = gestures.some(
    (g) => typeof g.gesture === 'string' && g.gesture.toLowerCase() === 'facing right'
  );

  // 2. Direct eyelid openness from 468-point mesh
  let meshBlink = false;
  if (face.mesh && face.mesh.length > 450) {
    // Left eye (MediaPipe indices 374: lower, 386: upper)
    const leftH = Math.abs(face.mesh[374][1] - face.mesh[386][1]);
    const leftRef = Math.max(1, Math.abs(face.mesh[443][1] - face.mesh[450][1]));
    // Right eye (MediaPipe indices 145: lower, 159: upper)
    const rightH = Math.abs(face.mesh[145][1] - face.mesh[159][1]);
    const rightRef = Math.max(1, Math.abs(face.mesh[223][1] - face.mesh[230][1]));

    const leftRatio = leftH / leftRef;
    const rightRatio = rightH / rightRef;
    // An open eye ratio is ~0.30 - 0.45. Closed is < 0.23.
    if (leftRatio < 0.23 || rightRatio < 0.23) {
      meshBlink = true;
    }
  }

  // 3. Fallback eyelid distance from annotations
  let earClosed = false;
  const leftUpper = annotations.leftEyeUpper0?.[3];
  const leftLower = annotations.leftEyeLower0?.[4];
  const rightUpper = annotations.rightEyeUpper0?.[3];
  const rightLower = annotations.rightEyeLower0?.[4];
  if (leftUpper && leftLower && rightUpper && rightLower) {
    const leftDist = Math.abs(leftLower[1] - leftUpper[1]);
    const rightDist = Math.abs(rightLower[1] - rightUpper[1]);
    const faceH = Math.max(10, box[3]);
    const normDist = (leftDist + rightDist) / (2 * faceH);
    if (normDist < 0.038) {
      earClosed = true;
    }
  }

  const blink = gestureBlink || meshBlink || earClosed;

  // 4. Head rotation angles in DEGREES
  let yawDeg = 0;
  let pitchDeg = 0;
  let rollDeg = 0;

  // Method A: face.rotation.angle (in radians from Euler decomposition)
  if (face.rotation?.angle) {
    yawDeg = (face.rotation.angle.yaw ?? 0) * (180 / Math.PI);
    pitchDeg = (face.rotation.angle.pitch ?? 0) * (180 / Math.PI);
    rollDeg = (face.rotation.angle.roll ?? 0) * (180 / Math.PI);
  }

  // Method B: 3D depth difference of outer eye corners (mesh[33] and mesh[263])
  if (face.mesh && face.mesh.length > 300) {
    const zDiff = (face.mesh[33][2] || 0) - (face.mesh[263][2] || 0);
    const xDiff = Math.max(1, Math.abs(face.mesh[33][0] - face.mesh[263][0]));
    const zRatio = zDiff / xDiff;
    // If face.rotation was unavailable or tiny, calculate yaw from Z depth
    if (Math.abs(yawDeg) < 2 && Math.abs(zRatio) > 0.05) {
      yawDeg = zRatio * 55;
    }
  }

  // Method C: Nose tip vs eye center midpoint horizontal offset
  const midway = annotations.midwayBetweenEyes?.[0];
  const nose = annotations.noseTip?.[0];
  if (Math.abs(yawDeg) < 2 && midway && nose) {
    const dx = nose[0] - midway[0];
    yawDeg = dx * 280;
  }

  // Sync gesture flags with yaw degrees
  if (yawDeg < -8) isFacingLeft = true;
  if (yawDeg > 8) isFacingRight = true;

  return {
    box,
    boxRaw,
    embedding,
    gaze: { yaw: yawDeg, pitch: pitchDeg, roll: rollDeg },
    blink,
    isFacingLeft,
    isFacingRight,
  };
};

/** Cosine similarity between two descriptors (0..1, higher = more similar). */
export const compareEmbeddings = (a: number[], b: number[]): number => {
  return match.similarity(a, b);
};

/** Find best match of a descriptor against stored descriptors. */
export const findBestMatch = (
  descriptor: number[],
  descriptors: number[][]
): { index: number; distance: number; similarity: number } | null => {
  if (descriptors.length === 0) return null;
  const result = match.find(descriptor, descriptors, { order: 1, threshold: 0.6, multiplier: 20 });
  return { index: result.index, distance: result.distance, similarity: result.similarity };
};
