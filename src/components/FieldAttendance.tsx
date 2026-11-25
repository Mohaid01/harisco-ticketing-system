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

type AttendanceMode = 'register' | 'scan';

interface FieldAttendanceProps {
  currentUser: { id: string; name: string; role: string };
  token: string;
}

const STEPS: { id: 'gps' | 'face' | 'done'; label: string }[] = [
  { id: 'gps', label: 'GPS Location' },
  { id: 'face', label: 'Face Verification' },
  { id: 'done', label: 'Attendance Logged' },
];

const jsonHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

const readError = async (res: Response, fallback: string): Promise<string> => {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error || fallback;
};

export const FieldAttendance: React.FC<FieldAttendanceProps> = ({ currentUser, token }) => {
  const [logs, setLogs] = useState<FieldAttendanceLog[]>([]);
  const [settings, setSettings] = useState<FieldAttendanceSetting[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [settingsLoading, setSettingsLoading] = useState<boolean>(true);
  const [punchResult, setPunchResult] = useState<PunchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [punchStatus, setPunchStatus] = useState('Check-In');
  const [mode, setMode] = useState<AttendanceMode | null>(null);
  const [step, setStep] = useState<'gps' | 'face' | 'done'>('gps');
  const [hasRegisteredFace, setHasRegisteredFace] = useState<boolean | null>(null);

  const [punchGpsLat, setPunchGpsLat] = useState<number | null>(null);
  const [punchGpsLng, setPunchGpsLng] = useState<number | null>(null);
  const [geoPermission, setGeoPermission] = useState<'idle' | 'granted' | 'denied' | 'unsupported'>('idle');
  const [geoLoading, setGeoLoading] = useState(false);

  // Enrollment state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [capturedFrames, setCapturedFrames] = useState<string[]>([]); // data URLs

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [siteModalOpen, setSiteModalOpen] = useState<boolean>(false);
  const [siteLabel, setSiteLabel] = useState('');
  const [siteCenterLat, setSiteCenterLat] = useState<number | null>(null);
  const [siteCenterLng, setSiteCenterLng] = useState<number | null>(null);
  const [siteRadius, setSiteRadius] = useState<number | null>(50);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/field/attendance', { headers: jsonHeaders(token) });
      if (!res.ok) throw new Error(await readError(res, 'Failed to fetch logs'));
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
      const res = await fetch('/api/field/attendance/settings', { headers: jsonHeaders(token) });
      if (!res.ok) throw new Error(await readError(res, 'Failed to fetch settings'));
      const data = await res.json();
      startTransition(() => setSettings(data));
    } catch (err) {
      startTransition(() => setError(err instanceof Error ? err.message : 'Failed to fetch settings'));
    } finally {
      startTransition(() => setSettingsLoading(false));
    }
  }, [token]);

  // ---------- Enrollment camera ----------
  const startEnrollmentCamera = useCallback(async () => {
    setCameraError(null);
    setCameraLoading(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera API not supported by this browser.');
        setCameraLoading(false);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      setCameraActive(true);
      setCameraLoading(false);
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Failed to access camera.');
      setCameraActive(false);
      setCameraLoading(false);
    }
  }, []);

  const stopEnrollmentCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      streamRef.current = null;
    }
    const video = videoRef.current;
    if (video) video.srcObject = null;
    setCameraActive(false);
  }, []);

  // ---------- Scan camera ----------
  const [scanCameraActive, setScanCameraActive] = useState(false);
  const [scanCameraLoading, setScanCameraLoading] = useState(false);
  const [scanCameraError, setScanCameraError] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<'scanning' | 'matched' | 'matched-fail' | 'idle'>('scanning');

  const startScanCamera = useCallback(async () => {
    setScanCameraError(null);
    setScanCameraLoading(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setScanCameraError('Camera API not supported by this browser.');
        setScanCameraLoading(false);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      setScanCameraActive(true);
      setScanCameraLoading(false);
    } catch (err) {
      setScanCameraError(err instanceof Error ? err.message : 'Failed to access camera.');
      setScanCameraActive(false);
      setScanCameraLoading(false);
    }
  }, []);

  const stopScanCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    const video = videoRef.current;
    if (video) video.srcObject = null;
    setScanCameraActive(false);
  }, []);

  // Start/stop scan camera when entering/leaving face verification step
  useEffect(() => {
    if (mode === 'scan' && step === 'face') {
      startScanCamera();
    } else {
      stopScanCamera();
    }
    return () => {
      stopScanCamera();
    };
  }, [mode, step, startScanCamera, stopScanCamera]);

  const dataUrlToBlob = useCallback((dataUrl: string): Blob => {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
      throw new Error(`Invalid data URL: expected a data: URL string.`);
    }
    const parts = dataUrl.split(';base64,');
    if (parts.length !== 2) {
      throw new Error(`Invalid data URL format: missing base64 payload.`);
    }
    const contentType = parts[0].split(':')[1] || 'image/jpeg';
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
  }, []);

  // Auto-scan loop: capture frames and send to Python for face recognition
  useEffect(() => {
    if (mode !== 'scan' || step !== 'face' || !scanCameraActive || scanStatus !== 'scanning') return;

    let interval: number;

    const loop = async () => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const blob = dataUrlToBlob(dataUrl);

      const formData = new FormData();
      formData.append('file', blob, 'frame.jpg');
      formData.append('user_id', currentUser.id);

      try {
        const res = await fetch(`${window.location.origin === 'http://localhost:5174' ? 'http://localhost:8000' : window.location.origin}/api/face/recognize`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!res.ok) {
          // Service error, keep scanning
          return;
        }
        const data = await res.json();
        if (data.matched && data.user_id === currentUser.id) {
          setScanStatus('matched');
        } else {
          // Face detected but not matched, keep scanning
        }
      } catch {
        // Network error, keep scanning
      }
    };

    interval = window.setInterval(loop, 500);
    loop(); // Run immediately

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [scanCameraActive, scanStatus, currentUser.id, mode, step, dataUrlToBlob]);

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  }, []);

  const addCapturedFrame = useCallback(() => {
    const frame = captureFrame();
    if (!frame) {
      setCameraError('Could not capture frame. Try again.');
      return;
    }
    setCapturedFrames((prev) => [...prev, frame]);
    setCameraError(null);
  }, [captureFrame]);

  const removeCapturedFrame = useCallback((index: number) => {
    setCapturedFrames((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearCapturedFrames = useCallback(() => {
    setCapturedFrames([]);
  }, []);

  // ---------- Enrollment submission ----------
  const submitEnrollment = useCallback(async () => {
    if (capturedFrames.length === 0) {
      setCameraError('Capture at least one photo first.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);

    let stored = 0;
    try {
      for (let i = 0; i < capturedFrames.length; i++) {
        const dataUrl = capturedFrames[i];
        if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
          throw new Error(`Captured photo ${i + 1} is not a valid image data URL.`);
        }
        const blob = dataUrlToBlob(dataUrl);
        if (!(blob instanceof Blob)) throw new Error('Captured photo is not a valid Blob instance.');
        const formData = new FormData();
        formData.append('userId', currentUser.id);
        if (!(blob instanceof Blob)) throw new Error('Blob became invalid before image append.');
        formData.append('image', blob, `face_${i + 1}.jpg`);

        const res = await fetch('/api/face/register', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!res.ok) {
          throw new Error(await readError(res, `Enrollment failed on photo ${i + 1}.`));
        }
        stored += 1;
        setNotice(`Enrolled photo ${stored} of ${capturedFrames.length}.`);
      }

      setNotice(`Enrollment complete. ${stored} template${stored === 1 ? '' : 's'} stored for ${currentUser.name}.`);
      setHasRegisteredFace(true);
      setCapturedFrames([]);
      stopEnrollmentCamera();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enrollment failed.');
      setNotice(
        stored > 0
          ? `${stored} of ${capturedFrames.length} photos stored before the error. Capture more to complete.`
          : null
      );
    } finally {
      setSubmitting(false);
    }
  }, [capturedFrames, currentUser.id, currentUser.name, token, stopEnrollmentCamera]);

  // ---------- Geolocation ----------
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
  }, []);

  // ---------- Punch ----------
  const handleMarkAttendance = useCallback(async () => {
    setError(null);
    setPunchResult(null);
    setSubmitting(true);
    try {
      // Capture a frame for punch verification
      const video = videoRef.current;
      if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
        throw new Error('Camera not available for face verification.');
      }
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable.');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b instanceof Blob) resolve(b);
          else reject(new Error('Canvas did not produce a valid Blob.'));
        }, 'image/jpeg', 0.85);
      });

      const formData = new FormData();
      if (!(blob instanceof Blob)) throw new Error('Captured frame is not a Blob.');
      formData.append('frame', blob, 'frame.jpg');
      formData.append('user_id', currentUser.id);
      formData.append('method', 'Facial');
      formData.append('status', punchStatus);
      if (punchGpsLat !== null && punchGpsLng !== null) {
        formData.append('gpsLat', String(punchGpsLat));
        formData.append('gpsLng', String(punchGpsLng));
      }
      formData.append('debugInfo', 'Face verification via microservice');

      const res = await fetch('/api/field/attendance/punch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        throw new Error(await readError(res, 'Failed to mark attendance'));
      }
      const result: PunchResult = await res.json();
      setPunchResult(result);
      setStep('done');
      await fetchLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark attendance');
    } finally {
      setSubmitting(false);
    }
  }, [punchStatus, punchGpsLat, punchGpsLng, token, fetchLogs]);

  // ---------- Lifecycle ----------
  useEffect(() => {
    fetchLogs();
    fetchSettings();
  }, [token, fetchLogs, fetchSettings]);

  // Registration state decides which view the screen shows.
  useEffect(() => {
    let active = true;
    setMode(null);
    setHasRegisteredFace(null);
    setStep('gps');
    setPunchResult(null);
    setError(null);
    setNotice(null);
    (async () => {
      try {
        const res = await fetch(`/api/face/references/${currentUser.id}`, { headers: jsonHeaders(token) });
        if (!active) return;
        if (res.ok) {
          const data: { total_samples: number } = await res.json();
          setHasRegisteredFace(data.total_samples > 0);
        } else {
          setHasRegisteredFace(false);
        }
      } catch {
        if (active) setHasRegisteredFace(false);
      }
    })();
    return () => {
      active = false;
      stopEnrollmentCamera();
    };
  }, [currentUser.id, token, stopEnrollmentCamera]);

  useEffect(() => {
    if (hasRegisteredFace === null) return;
    setMode(hasRegisteredFace ? 'scan' : 'register');
  }, [hasRegisteredFace]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopEnrollmentCamera();
    };
  }, [stopEnrollmentCamera]);

  // ---------- Step status ----------
  const isStepDone = (id: 'gps' | 'face' | 'done') => {
    if (step === 'done') return true;
    if (step === 'face' && id === 'gps') return true;
    return false;
  };
  const isStepActive = (id: 'gps' | 'face' | 'done') => step === id;

  return (
    <div className="page-body">
      <div className="attendance-header">
        <h1 className="attendance-title">Field Attendance</h1>
        <p className="attendance-subtitle">
          {mode === 'register'
            ? 'Scan your face to enroll, then punch attendance from the site.'
            : 'Secure field attendance portal. Verify location → Prove identity → Log punch.'}
        </p>
      </div>

      {error && (
        <div className="attendance-error">
          <XCircle size={16} />
          {error}
        </div>
      )}

      {notice && !error && <div className="attendance-notice">{notice}</div>}

      <div className="attendance-main">
        <div className="attendance-step-card">
          {mode === null && (
            <div className="attendance-notice" style={{ textAlign: 'center' }}>
              <Loader size={16} strokeWidth={2} />
              <span>Checking your face enrollment…</span>
            </div>
          )}

          {/* View A: Register */}
          {mode === 'register' && (
            <>
              <div className="attendance-view-head">
                <h2>Enroll your face to start</h2>
                <p>
                  Capture 2–4 photos of your face from different angles. We store only a face template,
                  never a photo.
                </p>
              </div>

              <div className="attendance-capture-card">
                <div className="attendance-camera-panel">
                  <div className="attendance-camera-wrap">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: cameraActive ? 1 : 0,
                      }}
                    />
                    {!cameraActive && !cameraLoading && !cameraError && (
                      <button
                        type="button"
                        onClick={startEnrollmentCamera}
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '0.85rem 1.5rem', fontSize: '1rem', fontWeight: 600 }}
                      >
                        Start Camera
                      </button>
                    )}
                    {cameraLoading && (
                      <div className="attendance-loader-bar">
                        <div className="attendance-loader-bar-fill" />
                      </div>
                    )}
                    {cameraError && (
                      <div className="attendance-camera-error">{cameraError}</div>
                    )}
                  </div>
                </div>

                {cameraActive && (
                  <>
                    <div className="attendance-action-bar">
                      <button
                        type="button"
                        onClick={addCapturedFrame}
                        className="btn btn-primary"
                        disabled={submitting}
                        style={{ width: '100%', padding: '0.85rem 1.5rem', fontSize: '1rem', fontWeight: 600 }}
                      >
                        {submitting ? <Loader size={18} strokeWidth={2} /> : null} Capture Photo
                      </button>
                    </div>

                    {capturedFrames.length > 0 && (
                      <div className="attendance-captured-frames">
                                        {capturedFrames.map((frame, i) => (
                          <div key={i} className="attendance-captured-frame">
                            <img src={frame} alt={`Enrollment photo ${i + 1}`} />
                            <button
                              type="button"
                              onClick={() => removeCapturedFrame(i)}
                              className="btn btn-outline"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            >
                              <XCircle size={14} strokeWidth={2} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="attendance-action-bar">
                      <button
                        type="button"
                        onClick={submitEnrollment}
                        className="btn btn-primary"
                        disabled={capturedFrames.length === 0 || submitting}
                        style={{ width: '100%', padding: '0.85rem 1.5rem', fontSize: '1rem', fontWeight: 600 }}
                      >
                        {submitting ? <Loader size={18} strokeWidth={2} /> : null} Submit Enrollment ({capturedFrames.length})
                      </button>
                    </div>

                    <div className="attendance-action-bar">
                      <button
                        type="button"
                        onClick={clearCapturedFrames}
                        className="btn btn-outline"
                        style={{ width: '100%', padding: '0.85rem 1.5rem', fontSize: '1rem', fontWeight: 600 }}
                      >
                        Clear All Photos
                      </button>
                    </div>
                  </>
                )}
              </div>

              {submitting && (
                <div className="attendance-notice">
                  <Loader size={16} strokeWidth={2} />
                  <span>Storing your face template…</span>
                </div>
              )}
            </>
          )}

          {/* View B: Scan */}
          {mode === 'scan' && (
            <>
              <div className="attendance-stepper">
                {STEPS.map((stepItem, i) => {
                  const status = isStepDone(stepItem.id) ? 'done' : isStepActive(stepItem.id) ? 'active' : 'pending';
                  return (
                    <React.Fragment key={stepItem.id}>
                      <div className="attendance-step">
                        <div className={`attendance-step-marker ${status}`}>
                          {status === 'done' ? (
                            <CheckCircle size={14} strokeWidth={2} />
                          ) : status === 'active' ? (
                            <Loader size={14} strokeWidth={2} />
                          ) : (
                            i + 1
                          )}
                        </div>
                        <span className={`attendance-step-label label-${status}`}>{stepItem.label}</span>
                      </div>
                      {i < STEPS.length - 1 && <span className="attendance-step-connector" />}
                    </React.Fragment>
                  );
                })}
              </div>

              {step === 'gps' && (
                <>
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

                  <div className={`attendance-gps-box ${geoPermission === 'granted' ? 'granted' : ''}`}>
                    <p className="attendance-gps-label">Location Access</p>
                    {geoPermission === 'idle' && (
                      <div className="attendance-notice">
                        Location has not been captured yet. Click "Allow Location Access" below.
                      </div>
                    )}
                    {geoPermission === 'granted' && (
                      <div className="attendance-gps-value">
                        <span className="attendance-gps-dot" />
                        <span>
                          GPS captured — {punchGpsLat?.toFixed(6)}, {punchGpsLng?.toFixed(6)}
                        </span>
                      </div>
                    )}
                    {geoPermission === 'denied' && (
                      <div style={{ color: '#f43f5e', fontSize: '0.82rem' }}>
                        Location permission denied. Enable it in browser site settings.
                      </div>
                    )}
                    {geoPermission === 'unsupported' && (
                      <div style={{ color: '#f43f5e', fontSize: '0.82rem' }}>
                        Geolocation not supported by this browser.
                      </div>
                    )}
                  </div>

                  <div className="attendance-identity-line">
                    <span className="attendance-gps-dot" />
                    <span>
                      Punching as <strong>{currentUser.name}</strong> ({currentUser.id})
                    </span>
                  </div>

                  <form onSubmit={(e) => e.preventDefault()} style={{ marginTop: 0.5313 }}>
                    <label className="form-label">Status</label>
                    <select
                      className="form-input"
                      value={punchStatus}
                      onChange={(e) => setPunchStatus(e.target.value)}
                    >
                      <option value="Check-In">Check-In</option>
                      <option value="Check-Out">Check-Out</option>
                    </select>
                  </form>

                  <div className="attendance-action-bar">
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
                    {(geoPermission === 'denied' || geoPermission === 'unsupported') && (
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
                </>
              )}

              {step === 'face' && (
                <>
                  <div className="attendance-step-header">
                    <div className="attendance-step-icon face">
                      <Camera size={20} />
                    </div>
                    <div>
                      <h2 className="attendance-step-title">Face Verification</h2>
                      <p className="attendance-step-desc">
                        {scanStatus === 'scanning'
                          ? 'Scanning your face…'
                          : scanStatus === 'matched'
                            ? 'Face matched! Verifying…'
                            : scanStatus === 'matched-fail'
                              ? 'Face not recognized. Try again.'
                              : 'Position your face in the camera.'}
                      </p>
                    </div>
                  </div>

                  <div className="attendance-camera-panel">
                    <div className="attendance-camera-wrap">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          opacity: scanCameraActive ? 1 : 0,
                        }}
                      />
                      {!scanCameraActive && !scanCameraLoading && !scanCameraError && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={startScanCamera}
                            className="btn btn-primary"
                            style={{ padding: '0.85rem 1.5rem', fontSize: '1rem', fontWeight: 600 }}
                          >
                            Start Camera
                          </button>
                        </div>
                      )}
                      {scanCameraLoading && (
                        <div className="attendance-loader-bar">
                          <div className="attendance-loader-bar-fill" />
                        </div>
                      )}
                      {scanCameraError && (
                        <div className="attendance-camera-error">{scanCameraError}</div>
                      )}
                    </div>
                  </div>

                  {scanStatus === 'scanning' && (
                    <div className="attendance-action-bar">
                      <button
                        type="button"
                        onClick={() => {
                          setScanStatus('idle');
                          stopScanCamera();
                        }}
                        className="btn btn-outline"
                        style={{ width: '100%', padding: '0.85rem 1.5rem', fontSize: '1rem', fontWeight: 600 }}
                      >
                        Stop Scan
                      </button>
                    </div>
                  )}

                  {scanStatus === 'matched-fail' && (
                    <div className="attendance-action-bar">
                      <button
                        type="button"
                        onClick={() => {
                          setScanStatus('scanning');
                        }}
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '0.85rem 1.5rem', fontSize: '1rem', fontWeight: 600 }}
                      >
                        Try Again
                      </button>
                    </div>
                  )}

                  {scanStatus === 'matched' && (
                    <div className="attendance-action-bar">
                      <button
                        type="button"
                        onClick={handleMarkAttendance}
                        className="btn btn-primary"
                        disabled={submitting}
                        style={{ width: '100%', padding: '0.85rem 1.5rem', fontSize: '1rem', fontWeight: 600 }}
                      >
                        {submitting ? <Loader size={18} strokeWidth={2} /> : null} Verify & Log Attendance
                      </button>
                    </div>
                  )}
                </>
              )}

              {step === 'done' && (
                <>
                  <div className="attendance-done-card">
                    <div className="attendance-done-icon">✓</div>
                    <h2 className="attendance-done-title">Attendance Marked</h2>
                    <p className="attendance-done-desc">Your punch has been recorded successfully.</p>
                    {punchResult && (
                      <div className="attendance-punch-result">
                        <p><strong>User:</strong> {punchResult.id}</p>
                        <p><strong>Verified:</strong> {String(punchResult.verified)}</p>
                        <p><strong>Within Radius:</strong> {String(punchResult.withinRadius)}</p>
                        <p><strong>Distance:</strong> {punchResult.distanceMeters?.toFixed(2)} m</p>
                        <p><strong>Face Score:</strong> {punchResult.faceMatchScore?.toFixed(3)}</p>
                      </div>
                    )}
                  </div>

                  <div className="attendance-action-bar">
                    <button
                      type="button"
                      onClick={() => {
                        setStep('gps');
                        setPunchResult(null);
                        setGeoPermission('idle');
                        setPunchGpsLat(null);
                        setPunchGpsLng(null);
                        setNotice(null);
                      }}
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '0.85rem 1.5rem', fontSize: '1rem', fontWeight: 600 }}
                    >
                      Done
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {punchResult && (
        <div
          className={`attendance-punch-alert ${punchResult.verified ? 'attendance-punch-alert-verified' : 'attendance-punch-alert-failed'}`}
        >
          {punchResult.verified ? (
            <>
              <CheckCircle size={20} />
              <span>Attendance verified and logged successfully.</span>
            </>
          ) : (
            <>
              <XCircle size={20} />
              <span>Attendance punch failed. Please try again.</span>
            </>
          )}
        </div>
      )}

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
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Center Lat</th>
              <th style={thStyle}>Center Lng</th>
              <th style={thStyle}>Radius (m)</th>
              <th style={thStyle}>Active</th>
            </tr>
          </thead>
          <tbody>
            {settings.map((s) => (
              <tr key={s.id} style={{ borderBottom: '0.0531rem solid var(--border-color)' }}>
                <td style={tdStyle}>{s.label}</td>
                <td style={tdStyle}>{s.centerLat}</td>
                <td style={tdStyle}>{s.centerLng}</td>
                <td style={tdStyle}>{s.radiusMeters}</td>
                <td style={tdStyle}>{s.isActive ? 'Yes' : 'No'}</td>
              </tr>
            ))}
            {settings.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '0.7438rem 0.85rem', color: 'var(--text-muted)' }}>
                  No sites defined.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {settingsLoading && <p>Loading settings…</p>}
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2 className="panel-title" style={{ margin: 0 }}>
            Field Attendance Logs
          </h2>
        </div>
        {loading ? (
          <p>Loading logs…</p>
        ) : (
          <div className="table-wrapper">
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr style={{ borderBottom: '0.0531rem solid var(--border-color)' }}>
                  <th style={thStyle}>Time</th>
                  <th style={thStyle}>User</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>GPS Lat</th>
                  <th style={thStyle}>GPS Lng</th>
                  <th style={thStyle}>Verified</th>
                  <th style={thStyle}>Within Radius</th>
                  <th style={thStyle}>Distance (m)</th>
                  <th style={thStyle}>Debug</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 50).map((log) => (
                  <tr key={log.id} style={{ borderBottom: '0.0531rem solid var(--border-color)' }}>
                    <td style={tdStyle}>{log.timestamp}</td>
                    <td style={tdStyle}>{log.name} ({log.userId})</td>
                    <td style={tdStyle}>{log.status}</td>
                    <td style={tdStyle}>{log.gpsLat === null ? '-' : log.gpsLat.toFixed(4)}</td>
                    <td style={tdStyle}>{log.gpsLng === null ? '-' : log.gpsLng.toFixed(4)}</td>
                    <td
                      style={{ ...tdStyle, color: log.verified ? 'var(--status-closed)' : '#f43f5e', fontWeight: 600 }}
                    >
                      {log.verified ? 'Yes' : 'No'}
                    </td>
                    <td
                      style={{ ...tdStyle, color: log.withinRadius ? 'var(--status-closed)' : '#f43f5e', fontWeight: 600 }}
                    >
                      {log.withinRadius ? 'Yes' : 'No'}
                    </td>
                    <td style={tdStyle}>{log.distanceMeters === null ? '-' : log.distanceMeters.toFixed(2)}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{log.debugInfo ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {siteModalOpen && (
        <>
          <div className="modal-overlay" onClick={() => setSiteModalOpen(false)} />
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, marginBottom: 1, fontSize: '1.125rem', fontWeight: 600, color: 'white' }}>
              Define Site
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}
            >
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

const thStyle: React.CSSProperties = {
  padding: '0.6375rem 0.85rem',
  color: 'var(--text-secondary)',
  fontWeight: 600,
  fontSize: '0.78rem',
  textTransform: 'uppercase',
};

const tdStyle: React.CSSProperties = {
  padding: '0.7438rem 0.85rem',
  color: 'var(--text-primary)',
};

export default FieldAttendance;
