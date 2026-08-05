import type { Response } from 'express';

import { logger } from '@utils';
import { Router } from 'express';

import type {
  AddManualAttendanceRequestBody,
  AddManualAttendanceResponse,
  ApiAuthRequest,
  ApiResponse,
  AttendanceLogsResponse,
  AuthRequest,
  ClearAttendanceResponse,
  DeleteAttendanceLogResponse,
} from '../types/index.ts';

import { getDb } from '../db.ts';
import { authenticateToken } from '../middleware/auth.ts';
import { sseClients } from '../middleware/sse.ts';

const router = Router();

// GET /api/attendance
router.get('/', authenticateToken, async (req: AuthRequest, res: ApiResponse<AttendanceLogsResponse>) => {
  try {
    const db = getDb();
    const currentUser = req.user;

    if (!currentUser) {
      return res.status(401).json({ error: 'Unauthorized. User data missing.' });
    }

    let query = '';
    const params: (string | undefined)[] = [];

    if (['executive', 'manager', 'it'].includes(currentUser.role)) {
      query = `
          SELECT id, name, userId, ioTime, method, status, timestamp
          FROM attendance_logs
          ORDER BY timestamp DESC
        `;
    } else if (currentUser.isDepartmentHead) {
      query = `
          SELECT l.id, l.name, l.userId, l.ioTime, l.method, l.status, l.timestamp
          FROM attendance_logs l
          JOIN users u ON l.name = u.name
          WHERE u.department = ?
          ORDER BY l.timestamp DESC
        `;
      params.push(currentUser.department ?? undefined);
    } else {
      query = `
          SELECT id, name, userId, ioTime, method, status, timestamp
          FROM attendance_logs
          WHERE name = ?
          ORDER BY timestamp DESC
        `;
      params.push(currentUser.name);
    }

    const logs = await db.all(query, params);
    return res.json(logs);
  } catch (error) {
    logger.error('Failed to retrieve attendance logs:', error);
    res.status(500).json({ error: 'Failed to retrieve attendance logs.' });
  }
});

// POST /api/attendance/manual
router.post(
  '/manual',
  authenticateToken,
  async (req: ApiAuthRequest<AddManualAttendanceRequestBody>, res: ApiResponse<AddManualAttendanceResponse>) => {
    if (req.user?.role !== 'it' && req.user?.role !== 'manager') {
      res.status(403).json({
        error: 'Forbidden. Only managers or IT can add manual attendance.',
      });
      return;
    }

    const { userId, date, time, status } = req.body;
    if (!userId || !date || !time || !status) {
      res.status(400).json({ error: 'Missing required fields.' });
      return;
    }

    try {
      const db = getDb();

      const holiday = await db.get('SELECT name FROM holidays WHERE date = ?', [date]);
      if (holiday) {
        res.status(400).json({
          error: `Cannot mark attendance on a gazetted holiday: ${holiday.name}.`,
        });
        return;
      }

      const pktDateStr = `${date}T${time}:00+05:00`;
      const pktDate = new Date(pktDateStr);

      if (isNaN(pktDate.getTime())) {
        res.status(400).json({ error: 'Invalid date or time.' });
        return;
      }

      const year = pktDate.getUTCFullYear();
      const month = String(pktDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(pktDate.getUTCDate()).padStart(2, '0');
      const hours = String(pktDate.getUTCHours()).padStart(2, '0');
      const minutes = String(pktDate.getUTCMinutes()).padStart(2, '0');
      const seconds = String(pktDate.getUTCSeconds()).padStart(2, '0');

      const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

      const user = await db.get('SELECT name FROM users WHERE id = ?', [userId]);
      if (!user) {
        res.status(404).json({ error: 'Employee not found.' });
        return;
      }

      await db.run(
        'INSERT INTO attendance_logs (name, userId, ioTime, method, status, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
        [user.name, userId, timestamp, 'Manual', status, timestamp]
      );

      if (status === 'On Leave' && (time === '09:30' || time === '10:00')) {
        const u = await db.get('SELECT casualLeaves, annualLeaves, medicalLeaves FROM users WHERE id = ?', [userId]);
        if (u) {
          if (u.casualLeaves > 0) {
            await db.run('UPDATE users SET casualLeaves = casualLeaves - 1 WHERE id = ?', [userId]);
          } else if (u.annualLeaves > 0) {
            await db.run('UPDATE users SET annualLeaves = annualLeaves - 1 WHERE id = ?', [userId]);
          } else if (u.medicalLeaves > 0) {
            await db.run('UPDATE users SET medicalLeaves = medicalLeaves - 1 WHERE id = ?', [userId]);
          }
        }
      }

      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to add manual attendance:', error);
      res.status(500).json({ error: 'Failed to add manual attendance.' });
    }
  }
);

// DELETE /api/attendance
router.delete('/', authenticateToken, async (req: AuthRequest, res: ApiResponse<ClearAttendanceResponse>) => {
  if (req.user?.role !== 'it') {
    res.status(403).json({
      error: 'Forbidden. Clearing attendance logs requires IT role.',
    });
    return;
  }
  try {
    const db = getDb();
    await db.run('DELETE FROM attendance_logs');
    res.json({ success: true, message: 'All attendance logs cleared.' });
  } catch (error) {
    logger.error('Failed to clear attendance logs:', error);
    res.status(500).json({ error: 'Failed to clear attendance logs.' });
  }
});

// DELETE /api/attendance/:id
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: ApiResponse<DeleteAttendanceLogResponse>) => {
  if (req.user?.role !== 'manager') {
    res.status(403).json({
      error: 'Forbidden. Attendance log deletion requires Manager role.',
    });
    return;
  }

  const logId = parseInt(String(req.params.id), 10);
  if (isNaN(logId)) {
    res.status(400).json({ error: 'Invalid log ID.' });
    return;
  }

  try {
    const db = getDb();
    const log = await db.get('SELECT status FROM attendance_logs WHERE id = ?', [logId]);
    if (!log) {
      res.status(404).json({ error: 'Attendance log not found.' });
      return;
    }

    const result = await db.run('DELETE FROM attendance_logs WHERE id = ?', [logId]);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Attendance log not found.' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete attendance log:', error);
    res.status(500).json({ error: 'Failed to delete attendance log.' });
  }
});

// GET /api/attendance/stream
router.get('/stream', authenticateToken, (req: AuthRequest, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.add(res);
});

export default router;
