import exifreader from 'exifreader';
import { Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';

import type {
  ApiAuthRequest,
  ApiResponse,
  AuthRequest,
  FieldAttendanceFaceReferencesResponse,
  FieldAttendanceFaceReference,
  FieldAttendanceLog,
  FieldAttendanceSetting,
  FieldAttendanceLogsResponse,
  FieldAttendanceSettingsResponse,
  PhotoUploadResponse,
  PunchFieldAttendanceRequestBody,
  PunchFieldAttendanceResponse,
  UploadFaceReferenceRequestBody,
  UploadFaceReferenceResponse,
  UpsertFieldAttendanceSettingRequestBody,
  UpsertFieldAttendanceSettingResponse,
} from '../types/index.ts';

import { getDb } from '../db.ts';
import { authenticateToken } from '../middleware/auth.ts';
import logger from '../utils/logger.ts';

const router = Router();

const toRad = (deg: number): number => (deg * Math.PI) / 180;

const haversineMeters = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
};

const uploadDir = path.resolve(process.cwd(), 'public/uploads/field-attendance');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const faceRefDir = path.resolve(process.cwd(), 'public/uploads/face-reference');
if (!fs.existsSync(faceRefDir)) {
  fs.mkdirSync(faceRefDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const faceRefStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, faceRefDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed.'));
    }
  },
});

const faceRefUpload = multer({
  storage: faceRefStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed.'));
    }
  },
});

const dmsToDecimal = (
  degrees: number,
  minutes: number,
  seconds: number,
  direction: string
): number => {
  let decimal = degrees + minutes / 60 + seconds / 3600;
  if (direction === 'S' || direction === 'W') {
    decimal = -decimal;
  }
  return decimal;
};

const getTagValues = (tag: unknown): number[] | null => {
  if (!tag) return null;
  const raw = (tag as { values?: unknown; value?: unknown }).values ?? (tag as { value?: unknown }).value;
  if (!raw) return null;
  if (Array.isArray(raw)) {
    return raw.map((v) => toNumber(v)).filter((n): n is number => n !== null);
  }
  const single = toNumber(raw);
  return single === null ? null : [single];
};

const toNumber = (v: unknown): number | null => {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isNaN(n) ? null : n;
  }
  if (typeof v === 'object') {
    const obj = v as { numerator?: number; denominator?: number; value?: number };
    if (obj.numerator !== undefined && obj.denominator !== undefined && obj.denominator !== 0) {
      return obj.numerator / obj.denominator;
    }
    if (obj.value !== undefined) return toNumber(obj.value);
  }
  return null;
};

const getTagString = (tag: unknown): string | null => {
  if (!tag) return null;
  const raw = (tag as { value?: unknown }).value;
  if (raw == null) return null;
  return String(raw);
};

const extractGpsFromExif = (filePath: string): {
  lat: number | null;
  lng: number | null;
  takenAt: string | null;
} => {
  try {
    const fileContent = fs.readFileSync(filePath);
    const tags = exifreader.load(fileContent);

    const gpsLatitude = tags.GPSLatitude;
    const gpsLongitude = tags.GPSLongitude;
    const gpsLatitudeRef = tags.GPSLatitudeRef;
    const gpsLongitudeRef = tags.GPSLongitudeRef;
    const dateTimeOriginal = tags.DateTimeOriginal;

    const latValues = getTagValues(gpsLatitude);
    const lngValues = getTagValues(gpsLongitude);
    const latRef = getTagString(gpsLatitudeRef);
    const lngRef = getTagString(gpsLongitudeRef);

    logger.info(
      `[FIELD ATTENDANCE EXIF] file=${filePath} hasGps=${!!(latValues && lngValues && latRef && lngRef)} gpsLatRaw=${latValues ? JSON.stringify(latValues) : null} gpsLngRaw=${lngValues ? JSON.stringify(lngValues) : null} latRef=${latRef} lngRef=${lngRef} dateTimeOriginal=${getTagString(dateTimeOriginal)}`
    );

    let lat: number | null = null;
    let lng: number | null = null;

    if (latValues && latValues.length >= 3 && lngValues && lngValues.length >= 3 && latRef && lngRef) {
      lat = dmsToDecimal(latValues[0], latValues[1], latValues[2], latRef);
      lng = dmsToDecimal(lngValues[0], lngValues[1], lngValues[2], lngRef);
    }

    let takenAt: string | null = null;
    if (dateTimeOriginal) {
      takenAt = getTagString(dateTimeOriginal);
    }

    logger.info(
      `[FIELD ATTENDANCE EXIF RESULT] file=${filePath} extractedLat=${lat} extractedLng=${lng} takenAt=${takenAt}`
    );

    return { lat, lng, takenAt };
  } catch (err) {
    logger.error(`[FIELD ATTENDANCE EXIF ERROR] file=${filePath}`, err);
    return { lat: null, lng: null, takenAt: null };
  }
};

// GET /api/field/attendance
router.get(
  '/',
  authenticateToken,
  async (req: AuthRequest, res: ApiResponse<FieldAttendanceLogsResponse>) => {
    if (req.user?.role !== 'it') {
      return res.status(403).json({ error: 'Forbidden. IT role required.' });
    }

    try {
      const db = getDb();
      const logs = await db.all<FieldAttendanceLog[]>(
        'SELECT id, name, userId, ioTime, method, status, timestamp, gpsLat, gpsLng, faceMatchScore, faceMatchConfidence, photoUrl, verified, withinRadius, distanceMeters, debugInfo FROM field_attendance_logs ORDER BY timestamp DESC'
      );
      return res.json(logs);
    } catch (error) {
      logger.error('Failed to retrieve field attendance logs:', error);
      res.status(500).json({ error: 'Failed to retrieve field attendance logs.' });
    }
  }
);

// POST /api/field/attendance/punch — server-side face match + GPS + liveness verification
router.post(
  '/punch',
  authenticateToken,
  async (
    req: ApiAuthRequest<PunchFieldAttendanceRequestBody>,
    res: ApiResponse<PunchFieldAttendanceResponse>
  ) => {
    if (req.user?.role !== 'it') {
      return res.status(403).json({ error: 'Forbidden. IT role required.' });
    }

    const {
      userId,
      name,
      method,
      status,
      gpsLat,
      gpsLng,
      photoUrl,
      debugInfo,
      faceDescriptor,
      livenessPassed,
      challenge,
    } = req.body;

    if (!userId || !name || !method || !status) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    try {
      const db = getDb();

      // --- GPS radius check ---
      let withinRadius = false;
      let distanceMeters: number | null = null;
      let matchedSettingId: number | null = null;

      if (gpsLat !== null && gpsLat !== undefined && gpsLng !== null && gpsLng !== undefined) {
        const settings = await db.all<FieldAttendanceSetting[]>(
          'SELECT id, centerLat, centerLng, radiusMeters FROM field_attendance_settings WHERE isActive = 1'
        );

        for (const setting of settings) {
          const dist = haversineMeters(
            Number(gpsLat),
            Number(gpsLng),
            setting.centerLat,
            setting.centerLng
          );
          distanceMeters = dist;
          if (dist <= setting.radiusMeters) {
            withinRadius = true;
            matchedSettingId = setting.id;
            break;
          }
        }
      }

      // --- Face match + liveness verification ---
      let serverFaceMatchScore: number | null = null;
      const serverLivenessPassed = livenessPassed === true;

      if (faceDescriptor && Array.isArray(faceDescriptor) && faceDescriptor.length > 0) {
        const references = await db.all<{
          id: number;
          userId: string;
          photoUrl: string;
          descriptor: string;
        }>('SELECT id, userId, photoUrl, descriptor FROM field_attendance_face_references WHERE userId = ?', [
          userId,
        ]);

        let bestScore = 0;
        for (const ref of references) {
          try {
            const refDescriptor = JSON.parse(ref.descriptor) as number[];
            const score = cosineSimilarity(faceDescriptor as number[], refDescriptor);
            if (score > bestScore) bestScore = score;
          } catch {
            // skip malformed descriptor
          }
        }
        serverFaceMatchScore = bestScore;
      }

      const faceOk =
        serverFaceMatchScore !== null &&
        serverFaceMatchScore !== undefined &&
        serverFaceMatchScore >= 0.6;

      const debugParts: string[] = [];
      if (challenge) debugParts.push(`challenge=${challenge}`);
      if (serverFaceMatchScore !== null) debugParts.push(`faceScore=${serverFaceMatchScore.toFixed(3)}`);
      if (serverLivenessPassed) debugParts.push('liveness=passed');
      else debugParts.push('liveness=failed');
      if (gpsLat !== null && gpsLat !== undefined) {
        debugParts.push(`gps=${gpsLat.toFixed(4)},${gpsLng.toFixed(4)}`);
      }
      debugParts.push(`withinRadius=${withinRadius}`);
      const finalDebugInfo = [debugInfo, debugParts.join(' | ')].filter(Boolean).join('; ');

      const verified =
        faceOk && serverLivenessPassed && (withinRadius || !gpsLat) ? 1 : 0;

      const result = await db.run(
        'INSERT INTO field_attendance_logs (name, userId, ioTime, method, status, gpsLat, gpsLng, faceMatchScore, faceMatchConfidence, photoUrl, verified, withinRadius, distanceMeters, debugInfo) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          name,
          userId,
          method,
          status,
          gpsLat ?? null,
          gpsLng ?? null,
          serverFaceMatchScore ?? null,
          serverFaceMatchScore !== null ? serverFaceMatchScore.toFixed(3) : null,
          photoUrl ?? null,
          verified,
          withinRadius ? 1 : 0,
          distanceMeters ?? null,
          finalDebugInfo,
        ]
      );

      logger.info(
        `[FIELD ATTENDANCE PUNCH] userId=${userId} name=${name} status=${status} verified=${verified === 1} withinRadius=${withinRadius} faceScore=${serverFaceMatchScore ?? 'null'} liveness=${serverLivenessPassed} distanceMeters=${distanceMeters ?? 'null'}`
      );

      res.json({
        success: true,
        id: Number(result.lastID),
        verified: verified === 1,
        withinRadius,
        matchedSettingId,
        distanceMeters,
        faceMatchScore: serverFaceMatchScore,
        livenessPassed: serverLivenessPassed,
        debugInfo: finalDebugInfo,
      });
    } catch (error) {
      logger.error('Failed to record field attendance punch:', error);
      res.status(500).json({ error: 'Failed to record field attendance punch.' });
    }
  }
);

// POST /api/field/attendance/photo — upload image, extract EXIF GPS
router.post(
  '/photo',
  authenticateToken,
  upload.single('photo'),
  async (req: AuthRequest, res: ApiResponse<PhotoUploadResponse>) => {
    if (req.user?.role !== 'it') {
      return res.status(403).json({ error: 'Forbidden. IT role required.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No photo file provided.' });
    }

    const photoUrl = `/uploads/field-attendance/${req.file.filename}`;
    const { lat, lng, takenAt } = extractGpsFromExif(req.file.path);

    logger.info(
      `[FIELD ATTENDANCE PHOTO] userId=${req.user?.id} file=${req.file.originalname} path=${req.file.path} photoUrl=${photoUrl} gpsLat=${lat} gpsLng=${lng} exifTakenAt=${takenAt}`
    );

    res.json({
      photoUrl,
      gpsLat: lat,
      gpsLng: lng,
      exifTakenAt: takenAt,
    });
  }
);

// GET /api/field/attendance/face-reference/:userId — list enrolled reference photos
router.get(
  '/face-reference/:userId',
  authenticateToken,
  async (req: AuthRequest, res: ApiResponse<FieldAttendanceFaceReferencesResponse>) => {
    if (req.user?.role !== 'it') {
      return res.status(403).json({ error: 'Forbidden. IT role required.' });
    }

    const userId = String(req.params.userId);
    if (!userId) {
      return res.status(400).json({ error: 'Missing user ID.' });
    }

    try {
      const db = getDb();
      const references = await db.all<{
        id: number;
        userId: string;
        photoUrl: string;
        descriptor: string;
        createdAt: string;
      }>('SELECT id, userId, photoUrl, descriptor, createdAt FROM field_attendance_face_references WHERE userId = ? ORDER BY createdAt DESC', [
        userId,
      ]);

      const result: FieldAttendanceFaceReference[] = references.map((r) => ({
        id: r.id,
        userId: r.userId,
        photoUrl: r.photoUrl,
        descriptor: JSON.parse(r.descriptor) as number[],
        createdAt: r.createdAt,
      }));

      return res.json(result);
    } catch (error) {
      logger.error('Failed to retrieve face references:', error);
      res.status(500).json({ error: 'Failed to retrieve face references.' });
    }
  }
);

// POST /api/field/attendance/face-reference — upload reference photo + descriptor
router.post(
  '/face-reference',
  authenticateToken,
  faceRefUpload.single('photo'),
  async (
    req: ApiAuthRequest<UploadFaceReferenceRequestBody>,
    res: ApiResponse<UploadFaceReferenceResponse>
  ) => {
    if (req.user?.role !== 'it') {
      return res.status(403).json({ error: 'Forbidden. IT role required.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No photo file provided.' });
    }

    const { userId, descriptor } = req.body;
    if (!userId || !descriptor || !Array.isArray(descriptor) || descriptor.length === 0) {
      return res.status(400).json({ error: 'Missing userId or descriptor.' });
    }

    const photoUrl = `/uploads/face-reference/${req.file.filename}`;

    try {
      const db = getDb();
      const result = await db.run(
        'INSERT INTO field_attendance_face_references (userId, photoUrl, descriptor) VALUES (?, ?, ?)',
        [userId, photoUrl, JSON.stringify(descriptor)]
      );
      res.json({ success: true, id: Number(result.lastID) });
    } catch (error) {
      logger.error('Failed to upload face reference:', error);
      res.status(500).json({ error: 'Failed to upload face reference.' });
    }
  }
);

// GET /api/field/attendance/settings
router.get(
  '/settings',
  authenticateToken,
  async (_req: AuthRequest, res: ApiResponse<FieldAttendanceSettingsResponse>) => {
    try {
      const db = getDb();
      const settings = await db.all<FieldAttendanceSetting[]>(
        'SELECT id, label, centerLat, centerLng, radiusMeters, isActive, createdAt FROM field_attendance_settings ORDER BY createdAt DESC'
      );
      return res.json(settings);
    } catch (error) {
      logger.error('Failed to retrieve field attendance settings:', error);
      res.status(500).json({ error: 'Failed to retrieve field attendance settings.' });
    }
  }
);

// POST /api/field/attendance/settings
router.post(
  '/settings',
  authenticateToken,
  async (
    req: ApiAuthRequest<UpsertFieldAttendanceSettingRequestBody>,
    res: ApiResponse<UpsertFieldAttendanceSettingResponse>
  ) => {
    if (req.user?.role !== 'it') {
      return res.status(403).json({ error: 'Forbidden. IT role required.' });
    }

    const { label, centerLat, centerLng, radiusMeters, isActive = 1 } = req.body;
    if (!label || centerLat === undefined || centerLng === undefined || radiusMeters === undefined) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    try {
      const db = getDb();
      const result = await db.run(
        'INSERT INTO field_attendance_settings (label, centerLat, centerLng, radiusMeters, isActive) VALUES (?, ?, ?, ?, ?)',
        [label, centerLat, centerLng, radiusMeters, isActive]
      );
      res.json({ success: true, id: Number(result.lastID) });
    } catch (error) {
      logger.error('Failed to create field attendance setting:', error);
      res.status(500).json({ error: 'Failed to create field attendance setting.' });
    }
  }
);

// DELETE /api/field/attendance/settings/:id
router.delete(
  '/settings/:id',
  authenticateToken,
  async (req: AuthRequest, res: ApiResponse<{ success: boolean }>) => {
    if (req.user?.role !== 'it') {
      return res.status(403).json({ error: 'Forbidden. IT role required.' });
    }

    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid setting ID.' });
    }

    try {
      const db = getDb();
      const result = await db.run('DELETE FROM field_attendance_settings WHERE id = ?', [id]);
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Setting not found.' });
      }
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete field attendance setting:', error);
      res.status(500).json({ error: 'Failed to delete field attendance setting.' });
    }
  }
);

export default router;
