import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from '@mediapipe/tasks-vision';

const WASM_PATH = '/mediapipe/wasm';
const MODEL_PATH = '/models/face_landmarker.task';

export type LivenessStageId = 'center' | 'blink' | 'turn-a' | 'turn-b';

export interface LivenessStage {
  id: LivenessStageId;
  title: string;
  hint: string;
}

/** Enrollment: enough head pose variation to build robust templates. */
export const ENROLL_STAGES: LivenessStage[] = [
  { id: 'center', title: 'Fit your face in the frame', hint: 'Hold still and look straight ahead' },
  { id: 'blink', title: 'Blink twice', hint: 'A natural blink, eyes fully closed for a moment' },
  { id: 'turn-a', title: 'Turn your head slowly', hint: 'Turn to one side, then hold' },
  { id: 'turn-b', title: 'Turn to the other side', hint: 'Now turn your head the other way' },
];

/** Verification: prove a live person is present with the minimum interaction. */
export const VERIFY_STAGES: LivenessStage[] = [
  { id: 'center', title: 'Fit your face in the frame', hint: 'Hold still and look straight ahead' },
  { id: 'blink', title: 'Blink once', hint: 'A natural blink confirms you are present' },
];

const YAW_TURN_THRESHOLD_DEG = 15;
/**
 * How long (ms) the face must stay framed + centred before the 'center' stage
 * is considered complete. 800 ms gives enough time for users to settle without
 * feeling instant — and avoids capturing a blurry snap on first detection.
 */
const CENTER_HOLD_MS = 800;
/**
 * How many consecutive bad frames are tolerated before the hold timer resets.
 * Increased to 8 to survive brief model hiccups on slower devices.
 */
const CENTER_TOLERANCE_FRAMES = 8;
const BLINK_CLOSED_SCORE = 0.5;

/** Framing rules, shared by the tracker and the on-screen guidance. */
export const FACE_WIDTH_MIN = 0.12; // was 0.16 — allow slightly farther faces
export const FACE_WIDTH_MAX = 0.95;
export const CENTER_OFFSET_LIMIT = 0.35; // was 0.25 — slightly more lenient centering

export interface FramingState {
  centered: boolean;
  framed: boolean;
  message: string;
}

/** Explain why a frame is not usable yet, so the UI is never silent. */
export const describeFraming = (metrics: FaceFrameMetrics | null): FramingState => {
  if (!metrics) {
    return { centered: false, framed: false, message: 'Position your face in the oval' };
  }
  const centered = metrics.centerOffsetX < CENTER_OFFSET_LIMIT;
  const framed = metrics.faceWidthFrac >= FACE_WIDTH_MIN && metrics.faceWidthFrac <= FACE_WIDTH_MAX;
  if (!framed) {
    return {
      centered,
      framed,
      message:
        metrics.faceWidthFrac < FACE_WIDTH_MIN
          ? 'Move closer to the camera'
          : 'Move back a little — your face is too close',
    };
  }
  if (!centered) {
    return { centered, framed, message: 'Center your face in the oval' };
  }
  return { centered, framed, message: 'Hold still' };
};

/** Client and server must agree, otherwise a valid blink is rejected on upload. */
export const BLINK_MIN_DEPTH = 0.35;
export const BLINK_MIN_MS = 100;
export const BLINK_MAX_MS = 1500;

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

export interface FaceFrameMetrics {
  faceWidthFrac: number;
  centerOffsetX: number;
  centerOffsetY: number;
  /** Model score for how closed each eye is (0 open → 1 closed). */
  blinkScore: number;
  yawDeg: number;
  pitchDeg: number;
  brightness: number;
}

export interface LivenessBlink {
  depth: number;
  durationMs: number;
  frames: number;
}

export interface LivenessSnapshot {
  version: number;
  framesProcessed: number;
  blinks: LivenessBlink[];
  faceWidthFrac: number;
  yawRangeDeg: number;
  brightness: number;
  durationMs: number;
  startedAt: string;
}

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

const createLandmarker = async (delegate: 'GPU' | 'CPU'): Promise<FaceLandmarker> => {
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate },
    runningMode: 'VIDEO',
    numFaces: 2,
    minFaceDetectionConfidence: 0.3,
    minFacePresenceConfidence: 0.3,
    minTrackingConfidence: 0.3,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  });
};

/**
 * Lazily load the MediaPipe face landmarker. GPU is preferred; a failed GPU
 * delegate falls back to CPU once instead of leaving the screen unusable.
 */
export const loadFaceLandmarker = async (): Promise<FaceLandmarker> => {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      try {
        return await createLandmarker('GPU');
      } catch {
        return createLandmarker('CPU');
      }
    })().catch((error: unknown) => {
      landmarkerPromise = null;
      throw error;
    });
  }
  return landmarkerPromise;
};

const blendshapeScore = (result: FaceLandmarkerResult, faceIndex: number, category: string): number => {
  const found = result.faceBlendshapes?.[faceIndex]?.categories.find((entry) => entry.categoryName === category);
  return found ? found.score : 0;
};

/** Euler angles (degrees) from MediaPipe's facial transformation matrix. */
const eulerFromMatrix = (matrix: number[][] | undefined): { yaw: number; pitch: number } => {
  if (!matrix || matrix.length < 3) return { yaw: 0, pitch: 0 };
  const [row0, row1, row2] = matrix;
  const sy = Math.sqrt(row0[0] * row0[0] + row1[0] * row1[0]);
  const pitch = Math.atan2(row2[1], row2[2]);
  const yaw = Math.atan2(-row2[0], sy);
  const toDeg = 180 / Math.PI;
  return { yaw: yaw * toDeg, pitch: pitch * toDeg };
};

/** Average luma of a downscaled copy of the frame, used as a cheap exposure check. */
const sampleBrightness = (video: HTMLVideoElement, canvas: HTMLCanvasElement): number => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || video.videoWidth === 0 || video.videoHeight === 0) return 0;
  const size = 32;
  canvas.width = size;
  canvas.height = size;
  ctx.drawImage(video, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  }
  return sum / (data.length / 4) / 255;
};

/**
 * Reduce one MediaPipe result to the handful of numbers the liveness rules need.
 * Returns null when no face is usable (none detected, or a degenerate box).
 */
export const extractMetrics = (
  result: FaceLandmarkerResult,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement
): FaceFrameMetrics | null => {
  const faces = result.faceLandmarks;
  if (!faces || faces.length === 0) return null;

  // Largest face wins: a second person in frame must not take over the session.
  let bestIndex = 0;
  let bestWidth = -1;
  for (let i = 0; i < faces.length; i += 1) {
    const points = faces[i];
    if (!points || points.length === 0) continue;
    let minX = 1;
    let maxX = 0;
    for (const point of points) {
      if (!Number.isFinite(point.x)) continue;
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
    }
    const width = maxX - minX;
    if (width > bestWidth) {
      bestWidth = width;
      bestIndex = i;
    }
  }

  const points = faces[bestIndex];
  if (!points || points.length === 0 || bestWidth <= 0 || !Number.isFinite(bestWidth)) return null;

  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }

  const faceWidthFrac = maxX - minX;
  if (!Number.isFinite(faceWidthFrac) || faceWidthFrac <= 0) return null;

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const { yaw, pitch } = eulerFromMatrix(result.facialTransformationMatrixes?.[bestIndex] as unknown as number[][]);

  const blinkScore = Math.max(
    blendshapeScore(result, bestIndex, 'eyeBlinkLeft'),
    blendshapeScore(result, bestIndex, 'eyeBlinkRight')
  );

  return {
    faceWidthFrac,
    centerOffsetX: Math.abs(centerX - 0.5) * 2,
    centerOffsetY: Math.abs(centerY - 0.5) * 2,
    blinkScore,
    yawDeg: Number.isFinite(yaw) ? yaw : 0,
    pitchDeg: Number.isFinite(pitch) ? pitch : 0,
    brightness: sampleBrightness(video, canvas),
  };
};

export interface StageProgress {
  stageIndex: number;
  /** 0..1 progress within the current stage. */
  progress: number;
  /** Set on the frame that completes the final stage. */
  completed: boolean;
  hint: string;
}

/**
 * Stateful liveness tracker. One instance per capture session; feed it metrics
 * in order, call `advance()` after each stage is captured.
 */
export class LivenessTracker {
  private readonly stages: LivenessStage[];

  private readonly startedAt: number;

  private stageIndex = 0;

  private centerSince: number | null = null;

  private centerBadFrames = 0;

  private closedSince: number | null = null;

  private maxClosedScore = 0;

  private blinkBaseline: number | null = null;

  private yawBaseline: number | null = null;

  private stageYaw: number | null = null;

  private lastYaw: number | null = null;

  private stageBlinkCount = 0;

  private firstTurnSign = 0;

  private yawMin = Number.POSITIVE_INFINITY;

  private yawMax = Number.NEGATIVE_INFINITY;

  private frames = 0;

  private maxWidth = 0;

  private brightnessSum = 0;

  private blinks: LivenessBlink[] = [];

  constructor(stages: LivenessStage[], now: number) {
    if (stages.length === 0) throw new Error('Liveness stages must not be empty.');
    this.stages = stages;
    this.startedAt = now;
  }

  get currentStage(): LivenessStage {
    return this.stages[Math.min(this.stageIndex, this.stages.length - 1)];
  }

  get isDone(): boolean {
    return this.stageIndex >= this.stages.length;
  }

  /** Index of the stage currently being tracked. */
  get currentIndex(): number {
    return this.stageIndex;
  }

  /** Move to the next stage, resetting the per-stage trackers. */
  advance(now: number): void {
    void now;
    if (this.isDone) return;
    const finished = this.currentStage;
    if (finished.id === 'turn-a' && this.firstTurnSign === 0 && this.stageYaw !== null && this.lastYaw !== null) {
      this.firstTurnSign = Math.sign(this.lastYaw - this.stageYaw) || 1;
    }
    this.stageIndex += 1;
    this.centerSince = null;
    this.centerBadFrames = 0;
    this.stageYaw = null;
    this.stageBlinkCount = this.blinks.length;
  }

  push(metrics: FaceFrameMetrics, now: number): StageProgress {
    const stage = this.currentStage;
    const result: StageProgress = {
      stageIndex: this.stageIndex,
      progress: 0,
      completed: false,
      hint: stage.hint,
    };

    if (this.isDone) {
      result.progress = 1;
      return result;
    }

    if (!Number.isFinite(metrics.blinkScore) || !Number.isFinite(metrics.yawDeg)) {
      return result;
    }

    this.frames += 1;
    if (metrics.faceWidthFrac > this.maxWidth) this.maxWidth = metrics.faceWidthFrac;
    if (metrics.faceWidthFrac > 0 && metrics.faceWidthFrac <= 2) {
      this.brightnessSum += metrics.brightness;
    }
    if (metrics.yawDeg < this.yawMin) this.yawMin = metrics.yawDeg;
    if (metrics.yawDeg > this.yawMax) this.yawMax = metrics.yawDeg;
    if (this.yawBaseline === null) this.yawBaseline = metrics.yawDeg;
    this.lastYaw = metrics.yawDeg;
    if (this.stageYaw === null) this.stageYaw = metrics.yawDeg;
    if (this.blinkBaseline === null || metrics.blinkScore < this.blinkBaseline) {
      this.blinkBaseline = metrics.blinkScore;
    }

    this.trackBlink(metrics, now);

    const { centered, framed } = describeFraming(metrics);

    if (centered && framed) {
      this.centerBadFrames = 0;
      if (this.centerSince === null) this.centerSince = now;
    } else {
      this.centerBadFrames += 1;
      if (this.centerBadFrames > CENTER_TOLERANCE_FRAMES) this.centerSince = null;
    }

    switch (stage.id) {
      case 'center': {
        const held = this.centerSince !== null ? now - this.centerSince : 0;
        result.progress = clamp01(held / CENTER_HOLD_MS);
        result.completed = held >= CENTER_HOLD_MS;
        break;
      }
      case 'blink': {
        const blinksInStage = this.blinks.length - this.stageBlinkCount;
        result.progress = clamp01(blinksInStage);
        result.completed = blinksInStage > 0;
        break;
      }
      case 'turn-a':
      case 'turn-b': {
        const reference = this.stageYaw ?? this.yawBaseline ?? metrics.yawDeg;
        const delta = metrics.yawDeg - reference;
        if (stage.id === 'turn-a') {
          result.progress = clamp01(Math.abs(delta) / YAW_TURN_THRESHOLD_DEG);
          result.completed = Math.abs(delta) >= YAW_TURN_THRESHOLD_DEG;
        } else {
          // Must swing back past centre to the opposite side.
          const signed = -delta * (this.firstTurnSign || 1);
          result.progress = clamp01(signed / YAW_TURN_THRESHOLD_DEG);
          result.completed = signed >= YAW_TURN_THRESHOLD_DEG;
        }
        break;
      }
      default:
        break;
    }

    return result;
  }

  snapshot(now: number): LivenessSnapshot {
    const span = this.yawMax - this.yawMin;
    return {
      version: 1,
      blinks: this.blinks,
      framesProcessed: this.frames,
      faceWidthFrac: Number(this.maxWidth.toFixed(3)),
      yawRangeDeg: Number((Number.isFinite(span) ? span : 0).toFixed(1)),
      brightness: Number((this.brightnessSum / Math.max(1, this.frames)).toFixed(3)),
      durationMs: now - this.startedAt,
      startedAt: new Date(this.startedAt).toISOString(),
    };
  }

  private trackBlink(metrics: FaceFrameMetrics, now: number): void {
    const closed = metrics.blinkScore > BLINK_CLOSED_SCORE;
    const baseline = this.blinkBaseline ?? metrics.blinkScore;

    if (closed) {
      if (this.closedSince === null) {
        this.closedSince = now;
        this.maxClosedScore = metrics.blinkScore;
      } else if (metrics.blinkScore > this.maxClosedScore) {
        this.maxClosedScore = metrics.blinkScore;
      }
      return;
    }

    if (this.closedSince !== null) {
      const durationMs = now - this.closedSince;
      const depth = this.maxClosedScore - baseline;
      if (durationMs >= BLINK_MIN_MS && durationMs <= BLINK_MAX_MS && depth >= BLINK_MIN_DEPTH) {
        this.blinks.push({ depth: Number(depth.toFixed(3)), durationMs, frames: this.frames });
      }
      this.closedSince = null;
      this.maxClosedScore = 0;
    }
  }
}
