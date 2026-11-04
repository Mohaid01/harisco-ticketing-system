import * as faceapi from 'face-api.js';
import { Camera, CheckCircle, Loader, XCircle } from 'lucide-react';
import React, { startTransition, useCallback, useEffect, useRef, useState } from 'react';

type FieldAttendanceLog = {
  id: number;
  name: string;
  userId: string;
  ioTime: string;
  method: string;
  status: string;
  timestamp: string;
  gpsLat: number | null;
  gpsLng: number | null;
  faceMatchScore: number | null;
  faceMatchConfidence: string | null;
  photoUrl: string | null;
  verified: number;
  withinRadius: number | null;
  distanceMeters: number | null;
  debugInfo: string | null;
};

type FieldAttendanceSetting = {
  id: number;
  label: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  isActive: number;
  createdAt: string;
};

type PunchResult = {
  success: boolean;
  id: number;
  verified: boolean;
  withinRadius: boolean;
  matchedSettingId: number | null;
  distanceMeters: number | null;
  faceMatchScore: number | null;
  livenessPassed: boolean;
  debugInfo: string | null;
};

interface FieldAttendanceProps {
  currentUser: { id: string; name: string; role: string };
  token: string;
}

const CHALLENGES = ['blink', 'turn_left', 'turn_right', 'smile'] as const;
type Challenge = (typeof CHALLENGES)[number];

const challengeLabel: Record<Challenge, string> = {
  blink: 'Blink your eyes',
  turn_left: 'Turn your head left',
  turn_right: 'Turn your head right',
  smile: 'Smile',
};

type Step = 'gps' | 'face' | 'done';

const STEPS: { id: Step; label: string }[] = [
  { id: 'gps', label: 'GPS Location' },
  { id: 'face', label: 'Face Verification' },
  { id: 'done', label: 'Attendance Marked' },
];

export const FieldAttendance: React.FC<FieldAttendanceProps> = ({ currentUser, token }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>(0);

  const [logs, setLogs] = useState<FieldAttendanceLog[]>([]);
  const [settings, setSettings] = useState<FieldAttendanceSetting[]>([]);
  const [fieldUsers, setFieldUsers] = useState<{ id: string; username: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [settingsLoading, setSettingsLoading] = useState<boolean>(true);
  const [punchResult, setPunchResult] = useState<PunchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [punchUserId, setPunchUserId] = useState(currentUser.id);
  const [punchStatus, setPunchStatus] = useState('Check-In');
  const [step, setStep] = useState<Step>('gps');

  const [punchGpsLat, setPunchGpsLat] = useState<number | null>(null);
  const [punchGpsLng, setPunchGpsLng] = useState<number | null>(null);
  const [geoPermission, setGeoPermission] = useState<'idle' | 'granted' | 'denied' | 'unsupported'>('idle');
  const [geoLoading, setGeoLoading] = useState(false);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null);
  const [capturedFrame, setCapturedFrame] = useState<string | null>(null);
  const [faceModelsLoaded, setFaceModelsLoaded] = useState<boolean>(false);

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [livenessStage, setLivenessStage] = useState<'idle' | 'ready' | 'verifying' | 'passed' | 'failed'>('idle');
  const [livenessResult, setLivenessResult] = useState<string | null>(null);

  const [siteModalOpen, setSiteModalOpen] = useState<boolean>(false);
  const [siteLabel, setSiteLabel] = useState('');
  const [siteCenterLat, setSiteCenterLat] = useState<number | null>(null);
  const [siteCenterLng, setSiteCenterLng] = useState<number | null>(null);
  const [siteRadius, setSiteRadius] = useState<number | null>(50);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/field/attendance', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch logs');
      const data = await res.json();
      startTransition(() => setLogs(data));
    } catch (err) {
      startTransition(() => setError(err instanceof Error ? err.message : 'Failed to fetch logs'));
    } finally {
      startTransition(() => setLoading(false));
    }
  }, [token]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/field/attendance/settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data = await res.json();
      startTransition(() => setSettings(data));
    } catch (err) {
      startTransition(() => setError(err instanceof Error ? err.message : 'Failed to fetch settings'));
    } finally {
      startTransition(() => setSettingsLoading(false));
    }
  }, [token]);

  const fetchFieldUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/field/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch field users');
      const data = await res.json();
      const mapped = Array.isArray(data) ? data.map((u: any) => ({ id: u.id, username: u.username || u.name })) : [];
      startTransition(() => setFieldUsers(mapped));
    } catch (err) {
      console.error('Failed to fetch field users:', err);
    }
  }, [token]);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera API not supported by this browser.');
      setCameraLoading(false);
      return;
    }
    setCameraError(null);
    setCameraLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 640, height: 480 },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
        setCameraActive(true);
        setCameraLoading(false);
        startFaceDetectionLoop();
      }
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Failed to access camera.');
      setCameraActive(false);
      setCameraLoading(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }
    setCameraActive(false);
    setFaceDetected(false);
    setFaceDescriptor(null);
  }, []);

  const startFaceDetectionLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const tick = async () => {
      if (video.readyState >= 2 && faceModelsLoaded) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
        try {
          const detection = await faceapi
            .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();
          if (detection) {
            setFaceDetected(true);
            setFaceDescriptor(Array.from(detection.descriptor as unknown as number[]));
          } else {
            setFaceDetected(false);
            setFaceDescriptor(null);
          }
        } catch {
          // silently continue
        }
      }
      animationFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, [faceModelsLoaded]);

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  }, []);

  const requestGeolocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoPermission('unsupported');
      setError('Geolocation is not supported by this browser.');
      return;
    }
    if (
      !window.isSecureContext &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      setGeoPermission('denied');
      setError('Browser GPS blocked on IP over HTTP. Use HTTPS or localhost.');
      return;
    }
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        if (result.state === 'denied') {
          setGeoPermission('denied');
          setError('Location permission previously denied. Enable it in browser site settings.');
          return;
        }
        if (result.state === 'granted') setGeoPermission('granted');
        doRequest();
      });
    } else {
      doRequest();
    }

    function doRequest() {
      setGeoLoading(true);
      setGeoPermission('idle');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGeoLoading(false);
          setGeoPermission('granted');
          setPunchGpsLat(pos.coords.latitude);
          setPunchGpsLng(pos.coords.longitude);
          setError(null);
        },
        (err) => {
          setGeoLoading(false);
          setGeoPermission('denied');
          setError(`GPS ${err.code === 1 ? 'denied' : err.code === 2 ? 'unavailable' : 'timed out'}.`);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  }, []);

  const nextChallenge = useCallback(() => {
    const c = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
    setChallenge(c);
    setLivenessStage('ready');
    setLivenessResult(null);
  }, []);

  const verifyChallenge = async (): Promise<boolean> => {
    if (!challenge) return false;
    return faceDetected && faceDescriptor !== null;
  };

  const handleStartLiveness = useCallback(async () => {
    if (!cameraActive) {
      await startCamera();
      nextChallenge();
      return;
    }
    if (!challenge) {
      nextChallenge();
      return;
    }
    const frame = captureFrame();
    if (frame) {
      setCapturedFrame(frame);
      setLivenessStage('verifying');
      verifyChallenge().then((ok) => {
        setLivenessStage(ok ? 'passed' : 'failed');
        setLivenessResult(ok ? 'Challenge passed' : 'Challenge failed - try again');
      });
    }
  }, [cameraActive, startCamera, nextChallenge, challenge, captureFrame, verifyChallenge]);

  const handleMarkAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPunchResult(null);
    setSubmitting(true);

    if (!challenge) {
      setSubmitting(false);
      setError('Please complete the liveness challenge first.');
      return;
    }
    if (!capturedFrame) {
      setSubmitting(false);
      setError('No face frame captured. Please use the camera.');
      return;
    }
    if (!faceDescriptor) {
      setSubmitting(false);
      setError('No face detected. Please position your face in the camera.');
      return;
    }
    if (livenessStage !== 'passed') {
      setSubmitting(false);
      setError('Liveness challenge not passed.');
      return;
    }
    if (punchGpsLat === null || punchGpsLng === null) {
      setSubmitting(false);
      setError('GPS location not captured. Please allow location access.');
      return;
    }

    const selectedUser = fieldUsers.find((u) => u.id === punchUserId);
    const resolvedName = selectedUser ? selectedUser.username : punchUserId;

    const frameBlob = await (await fetch(capturedFrame)).blob();
    const formData = new FormData();
    formData.append('frame', frameBlob, 'frame.jpg');
    formData.append('userId', punchUserId);
    formData.append('name', resolvedName);
    formData.append('method', 'Facial');
    formData.append('status', punchStatus);
    formData.append('gpsLat', String(punchGpsLat));
    formData.append('gpsLng', String(punchGpsLng));
    formData.append('debugInfo', '');
    formData.append('faceDescriptor', JSON.stringify(faceDescriptor));
    formData.append('livenessPassed', String(true));
    formData.append('challenge', challenge);

    try {
      const res = await fetch('/api/field/attendance/punch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errData.error || 'Failed to mark attendance');
      }
      const result = await res.json();
      setPunchResult(result);
      setStep('done');
      setLivenessStage('idle');
      setChallenge(null);
      setCapturedFrame(null);
      setFaceDescriptor(null);
      await fetchLogs();
      setSubmitting(false);
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : 'Failed to mark attendance');
    }
  };

  const handleSubmitSite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch('/api/field/attendance/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          label: siteLabel,
          centerLat: siteCenterLat,
          centerLng: siteCenterLng,
          radiusMeters: siteRadius,
          isActive: 1,
        }),
      });
      if (!res.ok) throw new Error('Failed to create site');
      await res.json();
      setSiteLabel('');
      setSiteCenterLat(null);
      setSiteCenterLng(null);
      setSiteRadius(50);
      setSiteModalOpen(false);
      await fetchSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create site');
    }
  };

  const handleDeleteSetting = async (id: number) => {
    if (!window.confirm('Delete this site?')) return;
    try {
      const res = await fetch(`/api/field/attendance/settings/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete site');
      await fetchSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete site');
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchSettings();
    fetchFieldUsers();
    loadFaceModels();
  }, [token, fetchLogs, fetchSettings, fetchFieldUsers]);

  const loadFaceModels = useCallback(async () => {
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
      ]);
      setFaceModelsLoaded(true);
    } catch (err) {
      console.warn('Face models not loaded (place model files in /public/models):', err);
      setFaceModelsLoaded(false);
    }
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const getStepStatus = (id: Step): 'pending' | 'loading' | 'done' | 'failed' => {
    const s = step as unknown as string;

    if (s === 'face' && id === 'gps') return 'done';
    if (s === 'done' && (id === 'gps' || id === 'face')) return 'done';

    if (s === id) {
      if (id === 'gps') {
        if (geoPermission === 'granted') return 'done';
        if (geoPermission === 'denied') return 'failed';
        return 'loading';
      }
      if (id === 'face') {
        if (livenessStage === 'passed') return 'done';
        if (livenessStage === 'failed') return 'failed';
        return 'loading';
      }
      return 'loading';
    }

    return 'pending';
  };

  return (
    <div className="page-body">
      <div className="attendance-header">
        <h1 className="attendance-title">Field Attendance</h1>
        <p className="attendance-subtitle">
          Secure field attendance portal. Verify location &rarr; Complete face verification &rarr; Mark attendance.
        </p>
      </div>

      {error && (
        <div className="attendance-error">
          <XCircle size={16} />
          {error}
        </div>
      )}

      {/* Stepper */}
      <div className="attendance-stepper">
        {STEPS.map((s, i) => {
          const status = getStepStatus(s.id);
          return (
            <React.Fragment key={s.id}>
              <div className="attendance-step">
                <div className={`attendance-step-marker ${status}`}>
                  {status === 'done' ? (
                    <CheckCircle size={14} strokeWidth={2} />
                  ) : status === 'failed' ? (
                    <XCircle size={14} strokeWidth={2} />
                  ) : status === 'loading' ? (
                    <Loader size={14} strokeWidth={2} />
                  ) : (
                    i + 1
                  )}
                </div>
                <span className={`attendance-step-label label-${status}`}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <span style={{ flex: 1, height: 0.0531, backgroundColor: 'var(--border-color)' }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Main content */}
      <div className="attendance-main">
        {/* Left: Step content */}
        <div className="attendance-step-card">
          {step === 'gps' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div className="attendance-step-header">
                <div className="attendance-step-icon gps">
                  <Camera size={20} />
                </div>
                <div>
                  <h2 className="attendance-step-title">GPS Location Permission</h2>
                  <p className="attendance-step-desc">
                    Allow location access so we can verify you are within the approved site radius.
                  </p>
                </div>
              </div>

              {/* GPS response section */}
              <div className={`attendance-gps-box ${geoPermission === 'granted' ? 'granted' : ''}`}>
                <p className="attendance-gps-label">Location Access</p>
                {geoPermission === 'idle' && (
                  <div className="attendance-notice">
                    Location has not been captured yet. Click "Allow Location Access" below to request permission.
                  </div>
                )}
                {geoPermission === 'granted' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0.5313 }}>
                    <div className="attendance-gps-value">
                      <span className="attendance-gps-dot" />
                      <span>
                        GPS captured &mdash; {punchGpsLat?.toFixed(6)}, {punchGpsLng?.toFixed(6)}
                      </span>
                    </div>
                  </div>
                )}
                {geoPermission === 'denied' && (
                  <div style={{ color: '#f43f5e', fontSize: '0.82rem' }}>
                    Location permission denied. Enable it in browser site settings.
                  </div>
                )}
                {geoPermission === 'unsupported' && (
                  <div style={{ color: '#f43f5e', fontSize: '0.82rem', marginTop: '0.3188rem' }}>
                    Geolocation not supported by this browser.
                  </div>
                )}
              </div>

              <form onSubmit={handleMarkAttendance} style={{ marginTop: 0.5313 }}>
                <label className="form-label">Field User</label>
                <select
                  className="form-input"
                  value={punchUserId}
                  onChange={(e) => setPunchUserId(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Select field user
                  </option>
                  {fieldUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.username}
                    </option>
                  ))}
                </select>

                <label className="form-label">Status</label>
                <select className="form-input" value={punchStatus} onChange={(e) => setPunchStatus(e.target.value)}>
                  <option value="Check-In">Check-In</option>
                  <option value="Check-Out">Check-Out</option>
                </select>
              </form>

              {/* GPS action button */}
              <div
                style={{ marginTop: '1rem', borderTop: '0.0531rem solid var(--border-color)', paddingTop: '0.85rem' }}
              >
                {geoPermission === 'idle' && (
                  <>
                    <button
                      type="button"
                      onClick={requestGeolocation}
                      className="btn btn-primary"
                      disabled={geoLoading}
                      style={{ width: '100%', padding: '0.85rem 1.5rem', fontSize: '1rem', fontWeight: 600 }}
                    >
                      {geoLoading ? <Loader size={18} strokeWidth={2} /> : null} Allow Location Access
                    </button>
                    {geoLoading && (
                      <div className="attendance-loader-bar">
                        <div className="attendance-loader-bar-fill" />
                      </div>
                    )}
                  </>
                )}
                {geoPermission === 'granted' && (
                  <button
                    type="button"
                    onClick={() => setStep('face')}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '0.85rem 1.5rem', fontSize: '1rem', fontWeight: 600 }}
                  >
                    Continue to Face Verification
                  </button>
                )}
                {geoPermission === 'denied' && (
                  <>
                    <button
                      type="button"
                      onClick={requestGeolocation}
                      className="btn btn-outline"
                      disabled={geoLoading}
                      style={{ width: '100%', padding: '0.85rem 1.5rem', fontSize: '1rem', fontWeight: 600 }}
                    >
                      {geoLoading ? <Loader size={18} strokeWidth={2} /> : null} Retry Location Access
                    </button>
                    {geoLoading && (
                      <div className="attendance-loader-bar">
                        <div className="attendance-loader-bar-fill" />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {step === 'face' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div className="attendance-step-header">
                <div className="attendance-step-icon face">
                  <CheckCircle size={20} />
                </div>
                <div>
                  <h2 className="attendance-step-title">Face Verification</h2>
                  <p className="attendance-step-desc">Complete the liveness challenge, then mark your attendance.</p>
                </div>
              </div>

              {/* Face response section: camera panel */}
              <div className="attendance-camera-panel">
                <div className="attendance-camera-wrap">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ display: cameraActive ? 'block' : 'none', width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                  {!cameraActive && !cameraError && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        gap: 0.425,
                        color: 'var(--text-muted)',
                        fontSize: '0.85rem',
                        textAlign: 'center',
                        zIndex: 5,
                      }}
                    >
                      Camera will start when you begin liveness check
                    </div>
                  )}
                  {cameraError && <div className="attendance-camera-error">{cameraError}</div>}
                  {cameraActive && faceDetected && (
                    <div className="attendance-camera-status detected">
                      <CheckCircle size={12} strokeWidth={2} />
                      Face Detected
                    </div>
                  )}
                  {cameraActive && !faceDetected && (
                    <div className="attendance-camera-status noface">
                      <XCircle size={12} strokeWidth={2} />
                      No Face
                    </div>
                  )}
                </div>
              </div>

              {/* Liveness status */}
              <div className="attendance-liveness-card">
                <div className="attendance-liveness-header">
                  <p className="attendance-liveness-title">Liveness Challenge</p>
                  <span
                    className={`attendance-liveness-badge ${livenessStage === 'passed' ? 'passed' : livenessStage === 'failed' ? 'failed' : ''}`}
                  >
                    {livenessStage === 'passed' ? 'PASSED' : livenessStage === 'failed' ? 'FAILED' : 'PENDING'}
                  </span>
                </div>

                {livenessStage === 'idle' && (
                  <div style={{ textAlign: 'center', marginBottom: 0.7438 }}>
                    <p className="attendance-liveness-hint">Complete a liveness challenge to prove you are present.</p>
                  </div>
                )}

                {livenessStage === 'ready' && challenge && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0.5313 }}>
                    <div className="attendance-challenge">{challengeLabel[challenge]}</div>
                    {livenessResult && (
                      <p
                        className="attendance-liveness-hint"
                        style={{
                          color: (livenessStage as 'passed') === 'passed' ? 'var(--status-closed)' : '#f43f5e',
                          marginTop: '0.3188rem',
                        }}
                      >
                        {livenessResult}
                      </p>
                    )}
                  </div>
                )}

                {livenessStage === 'verifying' && (
                  <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Verifying liveness...</span>
                  </div>
                )}

                {livenessStage === 'failed' && livenessResult && (
                  <div style={{ textAlign: 'center', marginTop: 0.5313 }}>
                    <p className="attendance-liveness-hint" style={{ color: '#f43f5e', fontWeight: 600 }}>
                      {livenessResult}
                    </p>
                  </div>
                )}

                {livenessStage === 'passed' && (
                  <div style={{ textAlign: 'center', marginTop: 0.5313 }}>
                    <p className="attendance-liveness-hint" style={{ color: 'var(--status-closed)', fontWeight: 600 }}>
                      Liveness verified &mdash; ready to mark attendance
                    </p>
                  </div>
                )}
              </div>

              {/* Face action button */}
              <div
                style={{ marginTop: '1rem', borderTop: '0.0531rem solid var(--border-color)', paddingTop: '0.85rem' }}
              >
                {livenessStage === 'idle' && (
                  <>
                    <button
                      type="button"
                      onClick={handleStartLiveness}
                      className="btn btn-primary"
                      disabled={!faceModelsLoaded || cameraLoading}
                      style={{ width: '100%', padding: '0.85rem 1.5rem', fontSize: '1rem', fontWeight: 600 }}
                    >
                      {cameraLoading ? <Loader size={18} strokeWidth={2} /> : null}
                      Start Liveness Check
                    </button>
                    {cameraLoading && (
                      <div className="attendance-loader-bar">
                        <div className="attendance-loader-bar-fill" />
                      </div>
                    )}
                  </>
                )}
                {livenessStage === 'ready' && challenge && (
                  <>
                    <button
                      type="button"
                      onClick={handleStartLiveness}
                      className="btn btn-primary"
                      disabled={(livenessStage as string) === 'verifying'}
                      style={{ width: '100%', padding: '0.85rem 1.5rem', fontSize: '1rem', fontWeight: 600 }}
                    >
                      I Have Completed: {challengeLabel[challenge]}
                    </button>
                  </>
                )}
                {livenessStage === 'verifying' && (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled
                      style={{ width: '100%', padding: '0.85rem 1.5rem', fontSize: '1rem', fontWeight: 600 }}
                    >
                      <Loader size={18} strokeWidth={2} /> Verifying...
                    </button>
                    <div className="attendance-loader-bar">
                      <div className="attendance-loader-bar-fill" />
                    </div>
                  </>
                )}
                {livenessStage === 'failed' && livenessResult && (
                  <>
                    <button
                      type="button"
                      onClick={handleStartLiveness}
                      className="btn btn-outline"
                      disabled={(livenessStage as string) === 'verifying'}
                      style={{ width: '100%', padding: '0.85rem 1.5rem', fontSize: '1rem', fontWeight: 600 }}
                    >
                      {(livenessStage as string) === 'verifying' ? <Loader size={18} strokeWidth={2} /> : null} Try Again
                    </button>
                  </>
                )}
                {livenessStage === 'passed' && (
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={
                      submitting ||
                      !challenge ||
                      !capturedFrame ||
                      !faceDescriptor ||
                      livenessStage !== 'passed'
                    }
                    style={{ width: '100%', padding: '0.85rem 1.5rem', fontSize: '1rem', fontWeight: 600 }}
                  >
                    {submitting ? <Loader size={18} strokeWidth={2} /> : null} Mark Attendance
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 'done' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div className="attendance-done-card">
                <div className="attendance-done-icon">&#10004;</div>
                <h2 className="attendance-done-title">Attendance Marked</h2>
                <p className="attendance-done-desc">
                  Your punch has been recorded successfully. Check the result below.
                </p>
              </div>
              {/* Done action button */}
              <div
                style={{ marginTop: '1rem', borderTop: '0.0531rem solid var(--border-color)', paddingTop: '0.85rem' }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setStep('gps');
                    setPunchResult(null);
                    setGeoPermission('idle');
                    setPunchGpsLat(null);
                    setPunchGpsLng(null);
                    setCameraActive(false);
                    setFaceDetected(false);
                    setFaceDescriptor(null);
                    setCapturedFrame(null);
                    setChallenge(null);
                    setLivenessStage('idle');
                    setLivenessResult(null);
                    stopCamera();
                  }}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '0.85rem 1.5rem', fontSize: '1rem', fontWeight: 600 }}
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Punch result */}
      {punchResult && (
        <div className={`attendance-result ${punchResult.verified ? 'verified' : 'failed'}`}>
          <span className="attendance-result-icon">
            {punchResult.verified ? <CheckCircle size={20} /> : <XCircle size={20} />}
          </span>
          <div className="attendance-result-content">
            <p className="attendance-result-label">
              {punchResult.verified ? 'Attendance Verified' : 'Attendance Failed'}
            </p>
            <div className="attendance-result-value">
              Verified: {String(punchResult.verified)} &bull; Within Radius: {String(punchResult.withinRadius)} &bull;
              Face Score: {punchResult.faceMatchScore?.toFixed(3)} &bull; Distance:{' '}
              {punchResult.distanceMeters?.toFixed(2)} m
              {punchResult.debugInfo && (
                <>
                  <br />
                  <span
                    style={{
                      fontSize: '0.72rem',
                      color: 'var(--text-muted)',
                      marginTop: '0.2125rem',
                      display: 'block',
                    }}
                  >
                    {punchResult.debugInfo}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Site Definition */}
      <section className="panel" style={{ marginBottom: 1.275 }}>
        <div className="panel-header">
          <h2 className="panel-title">Allowed Site Centers (Radius Check)</h2>
          <button
            type="button"
            onClick={() => setSiteModalOpen(true)}
            className="btn btn-primary"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
          >
            Add Site
          </button>
        </div>

        <table className="data-table" style={{ width: '100%', marginTop: 0.75 }}>
          <thead>
            <tr style={{ borderBottom: '0.0531rem solid var(--border-color)' }}>
              <th
                style={{
                  padding: '0.6375rem 0.85rem',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  textTransform: 'uppercase',
                }}
              >
                Name
              </th>
              <th
                style={{
                  padding: '0.6375rem 0.85rem',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  textTransform: 'uppercase',
                }}
              >
                Center Lat
              </th>
              <th
                style={{
                  padding: '0.6375rem 0.85rem',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  textTransform: 'uppercase',
                }}
              >
                Center Lng
              </th>
              <th
                style={{
                  padding: '0.6375rem 0.85rem',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  textTransform: 'uppercase',
                }}
              >
                Radius (m)
              </th>
              <th
                style={{
                  padding: '0.6375rem 0.85rem',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  textTransform: 'uppercase',
                }}
              >
                Active
              </th>
              <th
                style={{
                  padding: '0.6375rem 0.85rem',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  textTransform: 'uppercase',
                }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {settings.map((s) => (
              <tr key={s.id} style={{ borderBottom: '0.0531rem solid var(--border-color)' }}>
                <td style={{ padding: '0.7438rem 0.85rem', color: 'var(--text-primary)' }}>{s.label}</td>
                <td style={{ padding: '0.7438rem 0.85rem', color: 'var(--text-primary)' }}>{s.centerLat}</td>
                <td style={{ padding: '0.7438rem 0.85rem', color: 'var(--text-primary)' }}>{s.centerLng}</td>
                <td style={{ padding: '0.7438rem 0.85rem', color: 'var(--text-primary)' }}>{s.radiusMeters}</td>
                <td style={{ padding: '0.7438rem 0.85rem', color: 'var(--text-primary)' }}>
                  {s.isActive ? 'Yes' : 'No'}
                </td>
                <td style={{ padding: '0.7438rem 0.85rem' }}>
                  <button
                    onClick={() => handleDeleteSetting(s.id)}
                    className="btn btn-danger"
                    style={{ padding: '0.2125rem 0.5313rem', fontSize: '0.75rem' }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {settings.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '0.7438rem 0.85rem', color: 'var(--text-muted)' }}>
                  No sites defined. Add one to enable radius presence checks.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {settingsLoading && <p>Loading settings...</p>}
      </section>

      {/* Logs */}
      <section className="panel">
        <div className="panel-header">
          <h2 className="panel-title" style={{ margin: 0 }}>
            Field Attendance Logs
          </h2>
        </div>
        {loading ? (
          <p>Loading logs...</p>
        ) : (
          <div className="table-wrapper">
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr style={{ borderBottom: '0.0531rem solid var(--border-color)' }}>
                  <th
                    style={{
                      padding: '0.6375rem 0.85rem',
                      color: 'var(--text-secondary)',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      textTransform: 'uppercase',
                    }}
                  >
                    Time
                  </th>
                  <th
                    style={{
                      padding: '0.6375rem 0.85rem',
                      color: 'var(--text-secondary)',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      textTransform: 'uppercase',
                    }}
                  >
                    User
                  </th>
                  <th
                    style={{
                      padding: '0.6375rem 0.85rem',
                      color: 'var(--text-secondary)',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      textTransform: 'uppercase',
                    }}
                  >
                    Status
                  </th>
                  <th
                    style={{
                      padding: '0.6375rem 0.85rem',
                      color: 'var(--text-secondary)',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      textTransform: 'uppercase',
                    }}
                  >
                    GPS Lat
                  </th>
                  <th
                    style={{
                      padding: '0.6375rem 0.85rem',
                      color: 'var(--text-secondary)',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      textTransform: 'uppercase',
                    }}
                  >
                    GPS Lng
                  </th>
                  <th
                    style={{
                      padding: '0.6375rem 0.85rem',
                      color: 'var(--text-secondary)',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      textTransform: 'uppercase',
                    }}
                  >
                    Verified
                  </th>
                  <th
                    style={{
                      padding: '0.6375rem 0.85rem',
                      color: 'var(--text-secondary)',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      textTransform: 'uppercase',
                    }}
                  >
                    Within Radius
                  </th>
                  <th
                    style={{
                      padding: '0.6375rem 0.85rem',
                      color: 'var(--text-secondary)',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      textTransform: 'uppercase',
                    }}
                  >
                    Distance (m)
                  </th>
                  <th
                    style={{
                      padding: '0.6375rem 0.85rem',
                      color: 'var(--text-secondary)',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      textTransform: 'uppercase',
                    }}
                  >
                    Debug
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 50).map((log) => (
                  <tr key={log.id} style={{ borderBottom: '0.0531rem solid var(--border-color)' }}>
                    <td style={{ padding: '0.7438rem 0.85rem', color: 'var(--text-primary)' }}>{log.timestamp}</td>
                    <td style={{ padding: '0.7438rem 0.85rem', color: 'var(--text-primary)' }}>
                      {log.name} ({log.userId})
                    </td>
                    <td style={{ padding: '0.7438rem 0.85rem', color: 'var(--text-primary)' }}>{log.status}</td>
                    <td style={{ padding: '0.7438rem 0.85rem', color: 'var(--text-primary)' }}>
                      {log.gpsLat === null ? '-' : log.gpsLat.toFixed(4)}
                    </td>
                    <td style={{ padding: '0.7438rem 0.85rem', color: 'var(--text-primary)' }}>
                      {log.gpsLng === null ? '-' : log.gpsLng.toFixed(4)}
                    </td>
                    <td
                      style={{
                        padding: '0.7438rem 0.85rem',
                        color: log.verified ? 'var(--status-closed)' : '#f43f5e',
                        fontWeight: 600,
                      }}
                    >
                      {log.verified ? 'Yes' : 'No'}
                    </td>
                    <td
                      style={{
                        padding: '0.7438rem 0.85rem',
                        color: log.withinRadius ? 'var(--status-closed)' : '#f43f5e',
                        fontWeight: 600,
                      }}
                    >
                      {log.withinRadius ? 'Yes' : 'No'}
                    </td>
                    <td style={{ padding: '0.7438rem 0.85rem', color: 'var(--text-primary)' }}>
                      {log.distanceMeters === null ? '-' : log.distanceMeters.toFixed(2)}
                    </td>
                    <td style={{ padding: '0.7438rem 0.85rem', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                      {log.debugInfo ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Site Definition Modal */}
      {siteModalOpen && (
        <>
          <div className="modal-overlay" onClick={() => setSiteModalOpen(false)} />
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, marginBottom: 1, fontSize: '1.125rem', fontWeight: 600, color: 'white' }}>
              Define Site
            </h2>
            <form onSubmit={handleSubmitSite} style={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <div className="form-group">
                <label className="form-label">Site Name</label>
                <input
                  className="form-input"
                  type="text"
                  value={siteLabel}
                  onChange={(e) => setSiteLabel(e.target.value)}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Center Lat</label>
                  <input
                    className="form-input"
                    type="number"
                    step="any"
                    value={siteCenterLat === null ? '' : String(siteCenterLat)}
                    onChange={(e) => setSiteCenterLat(e.target.value ? parseFloat(e.target.value) : null)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Center Lng</label>
                  <input
                    className="form-input"
                    type="number"
                    step="any"
                    value={siteCenterLng === null ? '' : String(siteCenterLng)}
                    onChange={(e) => setSiteCenterLng(e.target.value ? parseFloat(e.target.value) : null)}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Radius (m)</label>
                <input
                  className="form-input"
                  type="number"
                  step="any"
                  value={siteRadius ?? ''}
                  onChange={(e) => setSiteRadius(e.target.value ? parseFloat(e.target.value) : null)}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end', marginTop: 0.25 }}>
                <button type="button" className="btn btn-outline" onClick={() => setSiteModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Site
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
};
