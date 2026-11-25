import { Camera, CheckCircle, Loader, XCircle } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { detectFace, loadHuman, type FaceCaptureResult, type LivenessSnapshot } from '../lib/humanVision';

type CaptureStatus = 'idle' | 'starting' | 'running' | 'done' | 'error';

interface FaceCaptureProps {
  stages: ('center' | 'blink' | 'turn-a' | 'turn-b')[];
  onCaptured: (result: FaceCaptureResult) => void;
  disabled?: boolean;
}

const FRAME_INTERVAL_MS = 66; // ~15 fps
const CENTER_HOLD_MS = 600; // Hold still for ~0.6s
const CENTER_TOLERANCE_FRAMES = 5; // Allow 5 dropped frames before resetting hold timer
const YAW_TURN_THRESHOLD = 9; // 9 degrees natural head turn

const STAGE_CONFIG: Record<string, { title: string; hint: string }> = {
  center: {
    title: 'Fit your face in the frame',
    hint: 'Hold still and look directly into the camera',
  },
  blink: {
    title: 'Blink to confirm you are present',
    hint: 'A natural blink confirms you are live',
  },
  'turn-a': {
    title: 'Turn your head slightly',
    hint: 'Turn your head slowly to one side',
  },
  'turn-b': {
    title: 'Turn head the other way',
    hint: 'Now turn your head slowly the other way',
  },
};

const describeCameraError = (error: unknown): string => {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Camera permission denied. Allow camera access in your browser settings and retry.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No camera was found on this device.';
  }
  if (name === 'NotReadableError') {
    return 'The camera is in use by another app.';
  }
  return error instanceof Error ? error.message : 'Could not start the camera.';
};

export const FaceCapture: React.FC<FaceCaptureProps> = ({ stages, onCaptured, disabled }) => {
  // Video and stream refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const mountedRef = useRef(true);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const humanRef = useRef<any>(null);
  const lastFrameAtRef = useRef(0);

  // Flow and state tracking refs (bypass React state closures in rAF)
  const stageIndexRef = useRef(0);
  const embeddingsRef = useRef<number[][]>([]);
  const finishingRef = useRef(false);
  const advancingRef = useRef(false);
  const lastDiagRef = useRef<string | null>(null);

  // Stage condition refs
  const centerHoldStartRef = useRef<number | null>(null);
  const centerLostFramesRef = useRef(0);
  const blinkCountRef = useRef(0);
  const blinkPhaseRef = useRef<'waiting' | 'closed' | 'opened'>('waiting');
  const blinkClosedFramesRef = useRef(0);
  const turnASignRef = useRef(0);
  const yawRangeRef = useRef(0);
  const sessionStartRef = useRef(0);
  const detectionHealth = useRef({ attempted: 0, detected: 0 });

  // Component State
  const [status, setStatus] = useState<CaptureStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [hint, setHint] = useState<string>(STAGE_CONFIG[stages[0]]?.hint ?? 'Look straight at the camera');
  const [frameMessage, setFrameMessage] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  const [faceVisible, setFaceVisible] = useState(false);
  const [isFramed, setIsFramed] = useState(false);
  const [faceBox, setFaceBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const logDiag = (msg: string) => {
    if (lastDiagRef.current !== msg) {
      lastDiagRef.current = msg;
      console.log('[FaceCapture]', msg);
    }
  };

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    const video = videoRef.current;
    if (video) video.srcObject = null;
    setFaceVisible(false);
    setIsFramed(false);
    setFaceBox(null);
    setCameraReady(false);
    if (humanRef.current) {
      try {
        humanRef.current.models.reset();
      } catch {
        // ignore
      }
      humanRef.current = null;
    }
  }, []);

  const failWith = useCallback(
    (message: string) => {
      if (!mountedRef.current) return;
      setStatus('error');
      setError(message);
      logDiag(message);
      stopCamera();
    },
    [stopCamera]
  );

  const captureEmbedding = useCallback(async (): Promise<number[] | null> => {
    const human = humanRef.current;
    const video = videoRef.current;
    if (!human || !video || video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }
    const detected = await detectFace(human, video);
    return detected ? detected.embedding ?? null : null;
  }, []);

  const runLoop = useCallback(() => {
    let consecutiveErrors = 0;

    const step = async () => {
      rafRef.current = requestAnimationFrame(() => {
        void step();
      });

      const video = videoRef.current;
      const human = humanRef.current;
      if (!video || !human || !mountedRef.current) return;
      if (document.visibilityState === 'hidden') return;

      const now = performance.now();
      if (now - lastFrameAtRef.current < FRAME_INTERVAL_MS) return;
      if (video.readyState < 2) return;
      lastFrameAtRef.current = now;

      try {
        const detected = await detectFace(human, video);
        consecutiveErrors = 0;
        detectionHealth.current.attempted += 1;

        if (!detected) {
          centerLostFramesRef.current += 1;
          if (centerLostFramesRef.current > CENTER_TOLERANCE_FRAMES) {
            centerHoldStartRef.current = null;
            setProgress(0);
          }
          setFaceVisible(false);
          setIsFramed(false);
          setFaceBox(null);
          setFrameMessage('Position your face in the oval');
          setDiagnostic(
            `Camera: on | Model: loaded | Face: not detected | frames ${detectionHealth.current.detected}/${detectionHealth.current.attempted}`
          );
          return;
        }

        detectionHealth.current.detected += 1;
        setFaceVisible(true);

        const { boxRaw, gaze, blink } = detected;
        const faceWidthFrac = boxRaw[2];
        const centerOffsetX = Math.abs(boxRaw[0] + boxRaw[2] / 2 - 0.5) * 2;
        const centerOffsetY = Math.abs(boxRaw[1] + boxRaw[3] / 2 - 0.5) * 2;

        const centered = centerOffsetX < 0.35 && centerOffsetY < 0.35;
        const framed = faceWidthFrac >= 0.12 && faceWidthFrac <= 0.88;
        const currentlyFramed = centered && framed;

        setIsFramed(currentlyFramed);
        setFaceBox({
          x: Math.max(0, boxRaw[0]),
          y: Math.max(0, boxRaw[1]),
          width: Math.min(1, boxRaw[2]),
          height: Math.min(1, boxRaw[3]),
        });

        let frameMsg = 'Position your face in the oval';
        if (!framed) {
          frameMsg =
            faceWidthFrac < 0.12
              ? 'Move closer to the camera'
              : 'Move back a little — your face is too close';
        } else if (!centered) {
          frameMsg = 'Center your face in the oval';
        } else {
          frameMsg = 'Hold still';
        }
        setFrameMessage(frameMsg);

        // Track yaw range for liveness evidence
        if (gaze) {
          const yaw = gaze.yaw;
          if (yawRangeRef.current === 0) yawRangeRef.current = yaw;
          if (yaw < yawRangeRef.current) yawRangeRef.current = yaw;
          if (yaw > yawRangeRef.current) yawRangeRef.current = yaw;
        }

        // Current stage from Ref (avoids state closure bugs)
        const currentStageIdx = stageIndexRef.current;
        const stage = stages[currentStageIdx];
        let stageProgress = 0;
        let stageComplete = false;

        if (stage === 'center') {
          if (currentlyFramed) {
            centerLostFramesRef.current = 0;
            if (centerHoldStartRef.current === null) {
              centerHoldStartRef.current = now;
            }
            const held = now - centerHoldStartRef.current;
            stageProgress = Math.min(1, held / CENTER_HOLD_MS);
            stageComplete = held >= CENTER_HOLD_MS;
          } else {
            centerLostFramesRef.current += 1;
            if (centerLostFramesRef.current > CENTER_TOLERANCE_FRAMES) {
              centerHoldStartRef.current = null;
              stageProgress = 0;
              stageComplete = false;
            } else if (centerHoldStartRef.current !== null) {
              stageProgress = Math.min(1, (now - centerHoldStartRef.current) / CENTER_HOLD_MS);
            }
          }
        } else if (stage === 'blink') {
          if (blink) {
            blinkClosedFramesRef.current += 1;
            blinkPhaseRef.current = 'closed';
            stageProgress = 0.65;
            if (blinkClosedFramesRef.current >= 2) {
              stageProgress = 0.9;
            }
          } else {
            // Eyes opened! If we previously saw them closed, a complete blink was made
            if (blinkPhaseRef.current === 'closed' || blinkClosedFramesRef.current >= 1) {
              blinkCountRef.current += 1;
              blinkPhaseRef.current = 'opened';
              stageProgress = 1;
              stageComplete = true;
            }
            blinkClosedFramesRef.current = 0;
          }
        } else if (stage === 'turn-a') {
          const yaw = gaze?.yaw ?? 0;
          const isTurned =
            Math.abs(yaw) >= YAW_TURN_THRESHOLD || detected.isFacingLeft || detected.isFacingRight;
          stageProgress = Math.min(1, Math.max(Math.abs(yaw) / YAW_TURN_THRESHOLD, isTurned ? 1 : 0));
          stageComplete = isTurned;
        } else if (stage === 'turn-b') {
          const yaw = gaze?.yaw ?? 0;
          const sign = turnASignRef.current || 1;
          const signed = -yaw * sign;
          const isOpposite =
            (sign > 0 && (detected.isFacingLeft || yaw <= -YAW_TURN_THRESHOLD)) ||
            (sign < 0 && (detected.isFacingRight || yaw >= YAW_TURN_THRESHOLD));
          stageProgress = Math.min(
            1,
            Math.max(0, Math.max(signed / YAW_TURN_THRESHOLD, isOpposite ? 1 : 0))
          );
          stageComplete = signed >= YAW_TURN_THRESHOLD || isOpposite;
        }

        setProgress(stageProgress);
        const stageInfo = STAGE_CONFIG[stage] ?? { title: stage, hint: stage };
        setHint(currentlyFramed ? stageInfo.hint : frameMsg);

        const diag = `Face: detected | ${currentlyFramed ? 'Framed OK' : frameMsg} | yaw: ${(gaze?.yaw ?? 0).toFixed(1)}° | blink: ${blink ? 'YES' : 'no'} | stage: ${stage}`;
        setDiagnostic(diag);
        logDiag(diag);

        // Advance to next stage or finish
        if (stageComplete && !finishingRef.current && !advancingRef.current) {
          advancingRef.current = true;
          const emb = await captureEmbedding();
          if (!mountedRef.current) return;

          if (emb) {
            embeddingsRef.current.push(emb);
          }

          const curIdx = stageIndexRef.current;
          if (curIdx >= stages.length - 1) {
            finishingRef.current = true;
            const evidence: LivenessSnapshot = {
              version: 1,
              blinks: Math.max(1, blinkCountRef.current),
              framesProcessed: detectionHealth.current.detected,
              faceWidthFrac,
              yawRangeDeg: Math.abs(yawRangeRef.current),
              brightness: 0.5,
              durationMs: now - sessionStartRef.current,
              startedAt: new Date(sessionStartRef.current).toISOString(),
            };
            setProgress(1);
            setStatus('done');
            stopCamera();
            onCaptured({ embeddings: embeddingsRef.current, evidence });
            return;
          }

          if (stage === 'turn-a') {
            turnASignRef.current =
              detected.isFacingLeft ? -1 : detected.isFacingRight ? 1 : Math.sign(gaze?.yaw ?? 0) || 1;
          }

          stageIndexRef.current = curIdx + 1;
          setStageIndex(stageIndexRef.current);
          centerHoldStartRef.current = null;
          centerLostFramesRef.current = 0;
          blinkPhaseRef.current = 'waiting';
          blinkClosedFramesRef.current = 0;
          setProgress(0);
          const nextStage = stages[stageIndexRef.current];
          const nextInfo = STAGE_CONFIG[nextStage] ?? { title: nextStage, hint: nextStage };
          setHint(nextInfo.hint);

          advancingRef.current = false;
        }
      } catch {
        consecutiveErrors += 1;
        if (consecutiveErrors > 15) {
          failWith('The face tracker stopped responding. Please try again.');
        }
      }
    };

    rafRef.current = requestAnimationFrame(() => {
      void step();
    });
  }, [captureEmbedding, failWith, onCaptured, stopCamera, stages]);

  const start = useCallback(async () => {
    setError(null);
    setStatus('starting');
    setProgress(0);
    setStageIndex(0);
    setFaceVisible(false);
    setIsFramed(false);
    setFaceBox(null);
    setCameraReady(false);
    setDiagnostic(null);

    stageIndexRef.current = 0;
    finishingRef.current = false;
    advancingRef.current = false;
    embeddingsRef.current = [];
    blinkCountRef.current = 0;
    turnASignRef.current = 0;
    yawRangeRef.current = 0;
    centerHoldStartRef.current = null;
    centerLostFramesRef.current = 0;
    sessionStartRef.current = performance.now();
    blinkPhaseRef.current = 'waiting';
    blinkClosedFramesRef.current = 0;
    detectionHealth.current = { attempted: 0, detected: 0 };

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error');
      setError('Camera API is not available in this browser.');
      return;
    }
    if (
      !window.isSecureContext &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      setStatus('error');
      setError('Camera access needs HTTPS. Open this page over HTTPS or localhost.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        video.srcObject = stream;
        try {
          await video.play();
          logDiag(`Camera: video playing ${video.videoWidth}x${video.videoHeight} readyState=${video.readyState}`);
        } catch (playErr) {
          logDiag(`Camera: play() failed ${playErr instanceof Error ? playErr.message : playErr}`);
          setStatus('error');
          setError('Camera started but video won’t play. Allow camera access in browser settings and retry.');
          return;
        }
      }
      setCameraReady(true);
      setStatus('running');
      setDiagnostic('Camera: on | Model: loading…');

      void loadHuman()
        .then((human) => {
          if (mountedRef.current) {
            humanRef.current = human;
            setModelReady(true);
            setDiagnostic('Camera: on | Model: loaded | Waiting for face…');
            logDiag('Camera: on | Model: loaded');
          }
        })
        .catch((err) => {
          const m = `Model failed to load: ${err instanceof Error ? err.message : err}`;
          setError(m);
          logDiag(m);
          console.error('[FaceCapture]', m);
        });

      runLoop();
    } catch (err) {
      setStatus('error');
      setError(describeCameraError(err));
      console.error('[FaceCapture] camera start failed', err);
    }
  }, [runLoop]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const activeStageKey = stages[Math.min(stageIndex, Math.max(0, stages.length - 1))];
  const activeStageConfig = STAGE_CONFIG[activeStageKey] ?? {
    title: activeStageKey?.replace('-', ' ') ?? 'Face scan',
    hint: 'Position your face in the oval',
  };
  const isWorking = status === 'starting' || status === 'running';

  return (
    <div className="attendance-capture">
      <div className="attendance-capture-head">
        <div className="attendance-step-icon face">
          <Camera size={20} />
        </div>
        <div>
          <h2 className="attendance-step-title">
            {status === 'done' ? 'Face captured' : activeStageConfig.title}
          </h2>
          <p className="attendance-step-desc">
            {status === 'done' ? 'All checks passed.' : hint}
          </p>
        </div>
      </div>

      <div className="attendance-capture-stage">
        <div className={`attendance-capture-frame ${cameraReady ? 'is-visible' : ''}`}>
          <video ref={videoRef} autoPlay playsInline muted className="attendance-capture-video" />

          {/* Oval guide (where face should be) */}
          <div className={`attendance-capture-oval ${isFramed ? 'is-framed' : faceVisible ? 'is-detected' : ''}`} />

          {/* Face tracking bounding box (where face is) */}
          {faceVisible && faceBox && (
            <div
              className={`attendance-face-box ${isFramed ? 'framed' : 'unframed'}`}
              style={{
                left: `${(faceBox.x * 100).toFixed(1)}%`,
                top: `${(faceBox.y * 100).toFixed(1)}%`,
                width: `${(faceBox.width * 100).toFixed(1)}%`,
                height: `${(faceBox.height * 100).toFixed(1)}%`,
              }}
            >
              <div className="face-box-corner tl" />
              <div className="face-box-corner tr" />
              <div className="face-box-corner bl" />
              <div className="face-box-corner br" />
            </div>
          )}

          {!isWorking && status !== 'done' && !faceVisible && (
            <div className="attendance-capture-placeholder">
              <Camera size={30} strokeWidth={1.6} />
              <span>{status === 'error' ? 'Camera unavailable' : 'Camera is off'}</span>
            </div>
          )}
          {status === 'running' && frameMessage && <div className="attendance-capture-badge">{frameMessage}</div>}
          {(status === 'running' || status === 'error') && diagnostic && (
            <div className="attendance-capture-diag">{diagnostic}</div>
          )}
        </div>

        <div className="attendance-capture-steps">
          {stages.map((stage, index) => {
            const state = index < stageIndex ? 'done' : index === stageIndex ? 'active' : 'pending';
            const stageTitle = STAGE_CONFIG[stage]?.title ?? stage.replace('-', ' ');
            return (
              <div key={stage} className={`attendance-capture-step step-${state}`}>
                <span className="attendance-capture-step-dot">
                  {state === 'done' ? <CheckCircle size={13} strokeWidth={2.4} /> : index + 1}
                </span>
                <span className="attendance-capture-step-label">{stageTitle}</span>
              </div>
            );
          })}
        </div>

        <div className="attendance-capture-progress">
          <div className="attendance-capture-progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      </div>

      {error && (
        <div className="attendance-error">
          <XCircle size={16} />
          {error}
        </div>
      )}

      <div className="attendance-action-bar">
        {status === 'idle' && (
          <button
            type="button"
            onClick={() => void start()}
            className="btn btn-primary"
            disabled={disabled}
            style={{ width: '100%', padding: '0.85rem 1.5rem', fontSize: '1rem', fontWeight: 600 }}
          >
            Start Face Scan
          </button>
        )}
        {status === 'starting' && (
          <button type="button" className="btn btn-primary" disabled style={{ width: '100%' }}>
            <Loader size={18} strokeWidth={2} /> Starting camera…
          </button>
        )}
        {status === 'running' && (
          <button
            type="button"
            className="btn btn-primary"
            disabled
            style={{ width: '100%', padding: '0.85rem 1.5rem', fontSize: '1rem', fontWeight: 600 }}
          >
            <Loader size={18} strokeWidth={2} />{' '}
            {modelReady ? 'Scanning — follow the prompts' : 'Loading face model…'}
          </button>
        )}
        {status === 'error' && (
          <button
            type="button"
            onClick={() => void start()}
            className="btn btn-outline"
            style={{ width: '100%', padding: '0.85rem 1.5rem', fontSize: '1rem', fontWeight: 600 }}
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
};

export default FaceCapture;
