import { logger } from '@utils';
import { Router } from 'express';

import type {
  ApiAuthRequest,
  ApiResponse,
  AuthRequest,
  CreateLeaveRequestBody,
  CreateLeaveResponse,
  LeavesResponse,
  UpdateLeaveStatusRequestBody,
  UpdateLeaveStatusResponse,
} from '../types/index.ts';

import { getDb } from '../db.ts';
import { authenticateToken } from '../middleware/auth.ts';

const router = Router();

// GET /api/leaves
router.get('/', authenticateToken, async (req: AuthRequest, res: ApiResponse<LeavesResponse>) => {
  const userId = req.user?.id;
  const userRole = req.user?.role;

  try {
    const db = getDb();
    const currentUser = await db.get('SELECT role, department, isDepartmentHead FROM users WHERE id = ?', [userId]);
    let query = 'SELECT * FROM leave_applications ORDER BY appliedAt DESC';
    const params: (string | undefined)[] = [];

    if (userRole === 'executive' || userRole === 'manager') {
      query = `
          SELECT l.*, u.username AS userCode FROM leave_applications l
          JOIN users u ON l.userId = u.id
          ORDER BY l.appliedAt DESC
        `;
    } else if (currentUser?.isDepartmentHead) {
      query = `
          SELECT l.*, u.username AS userCode FROM leave_applications l
          JOIN users u ON l.userId = u.id
          WHERE l.userId = ? OR u.department = ?
          ORDER BY l.appliedAt DESC
        `;
      params.push(userId, currentUser.department);
    } else {
      query = `
          SELECT l.*, u.username AS userCode FROM leave_applications l
          JOIN users u ON l.userId = u.id
          WHERE l.userId = ? 
          ORDER BY l.appliedAt DESC
        `;
      params.push(userId);
    }

    const leaves = await db.all(query, params);
    res.json(leaves);
  } catch (error) {
    logger.error('Failed to fetch leaves:', error);
    res.status(500).json({ error: 'Failed to retrieve leave applications.' });
  }
});

// POST /api/leaves
router.post(
  '/',
  authenticateToken,
  async (req: ApiAuthRequest<CreateLeaveRequestBody>, res: ApiResponse<CreateLeaveResponse>) => {
    const { category, startDate, endDate, reason } = req.body;
    if (!category || !startDate || !endDate || !reason) {
      res.status(400).json({ error: 'All fields are required.' });
      return;
    }

    try {
      const db = getDb();

      const existingDuty = await db.get(
        "SELECT id FROM site_duty_applications WHERE userId = ? AND status = 'approved' AND startDate <= ? AND endDate >= ?",
        [req.user?.id, endDate, startDate]
      );
      if (existingDuty) {
        res.status(400).json({
          error: 'Cannot apply for leave on a date with an approved site duty.',
        });
        return;
      }

      const existingLeave = await db.get(
        "SELECT id FROM leave_applications WHERE userId = ? AND status = 'approved' AND startDate <= ? AND endDate >= ?",
        [req.user?.id, endDate, startDate]
      );
      if (existingLeave) {
        res.status(400).json({
          error: 'Cannot apply for leave on a date with an already approved leave.',
        });
        return;
      }

      const leaveId = `leave-${Date.now()}`;
      const timestamp = new Date().toISOString();

      await db.run(
        `INSERT INTO leave_applications (
              id, userId, userName, category, startDate, endDate, reason, status, appliedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [leaveId, req.user?.id, req.user?.name, category, startDate, endDate, reason, 'pending', timestamp]
      );

      res.status(201).json({ success: true, id: leaveId });
    } catch (error) {
      logger.error('Failed to submit leave:', error);
      res.status(500).json({ error: 'Failed to submit leave application.' });
    }
  }
);

// PUT /api/leaves/:id/status
router.put(
  '/:id/status',
  authenticateToken,
  async (req: ApiAuthRequest<UpdateLeaveStatusRequestBody>, res: ApiResponse<UpdateLeaveStatusResponse>) => {
    const db = getDb();
    const leaveId = String(req.params.id);
    const leave = await db.get<{ userId: string }>('SELECT userId FROM leave_applications WHERE id = ?', [leaveId]);
    if (!leave) {
      res.status(404).json({ error: 'Leave application not found.' });
      return;
    }

    const applicant = await db.get<{ department: string | null }>('SELECT department FROM users WHERE id = ?', [
      leave.userId,
    ]);
    const approver = await db.get<{
      isDepartmentHead: number;
      department: string | null;
    }>('SELECT isDepartmentHead, department FROM users WHERE id = ?', [req.user?.id]);

    if (!approver?.isDepartmentHead || approver.department !== applicant?.department) {
      res.status(403).json({
        error: 'Forbidden. Only the department head can approve this leave.',
      });
      return;
    }

    const { status } = req.body;
    if (!status || !['approved', 'rejected'].includes(status)) {
      res.status(400).json({ error: 'Valid status (approved/rejected) is required.' });
      return;
    }

    try {
      const db = getDb();
      const leaveId = String(req.params.id);

      const result = await db.run('UPDATE leave_applications SET status = ? WHERE id = ?', [status, leaveId]);

      if (result.changes === 0) {
        res.status(404).json({ error: 'Leave application not found.' });
        return;
      }

      if (status === 'approved') {
        const leave = await db.get('SELECT * FROM leave_applications WHERE id = ?', [leaveId]);
        if (leave) {
          const start = new Date(leave.startDate);
          const end = new Date(leave.endDate);

          let daysToDeduct = 0;

          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dayOfWeek = d.getDay();
            if (dayOfWeek === 0) continue;

            daysToDeduct++;

            const checkInTime = '--';
            const checkOutTime = '--';

            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');

            const getUtcTimestamp = (y: string, m: string, d2: string, timeStr: string) => {
              const pktDateStr = `${y}-${m}-${d2}T${timeStr}+05:00`;
              const pktDate = new Date(pktDateStr);
              const uYear = pktDate.getUTCFullYear();
              const uMonth = String(pktDate.getUTCMonth() + 1).padStart(2, '0');
              const uDay = String(pktDate.getUTCDate()).padStart(2, '0');
              const uHours = String(pktDate.getUTCHours()).padStart(2, '0');
              const uMinutes = String(pktDate.getUTCMinutes()).padStart(2, '0');
              const uSeconds = String(pktDate.getUTCSeconds()).padStart(2, '0');
              return `${uYear}-${uMonth}-${uDay} ${uHours}:${uMinutes}:${uSeconds}`;
            };

            const checkInTimestamp = getUtcTimestamp(String(year), month, day, checkInTime);
            const checkOutTimestamp = getUtcTimestamp(String(year), month, day, checkOutTime);

            await db.run(
              'INSERT INTO attendance_logs (name, userId, ioTime, method, status, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
              [leave.userName, leave.userId, checkInTimestamp, 'System', 'On Leave', checkInTimestamp]
            );

            await db.run(
              'INSERT INTO attendance_logs (name, userId, ioTime, method, status, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
              [leave.userName, leave.userId, checkOutTimestamp, 'System', 'On Leave', checkOutTimestamp]
            );
          }

          if (daysToDeduct > 0) {
            let columnToUpdate = 'casualLeaves';
            if (leave.category === 'annual') columnToUpdate = 'annualLeaves';
            else if (leave.category === 'medical') columnToUpdate = 'medicalLeaves';

            const queryText = [
              'UPDATE users SET',
              columnToUpdate + ' = MAX(0, ' + columnToUpdate + ' - ?)',
              'WHERE id = ?',
            ].join(' ');

            await db.run(queryText, [daysToDeduct, leave.userId]);
          }
        }
      }

      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to update leave status:', error);
      res.status(500).json({ error: 'Failed to update leave status.' });
    }
  }
);

export default router;
