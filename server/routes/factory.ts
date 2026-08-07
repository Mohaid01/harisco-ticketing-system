import bcrypt from 'bcryptjs';
import { Response, Router } from 'express';

import type {
  AddFactoryManualAttendanceRequestBody,
  AddFactoryManualAttendanceResponse,
  ApiAuthRequest,
  ApiResponse,
  AuthRequest,
  ClearFactoryAttendanceResponse,
  CreateFactoryUserRequestBody,
  CreateFactoryUserResponse,
  DbUser,
  DeleteFactoryAttendanceLogResponse,
  DeleteFactoryUserResponse,
  FactoryAttendanceLogsResponse,
  FactoryUsersResponse,
  ResetFactoryUserPasswordRequestBody,
  ResetFactoryUserPasswordResponse,
  UpdateFactoryUserRequestBody,
  UpdateFactoryUserResponse,
} from '../types/index.ts';

import { getDb } from '../db.ts';
import { authenticateToken } from '../middleware/auth.ts';
import { sseClients } from '../middleware/sse.ts';
import logger from '../utils/logger.ts';

const router = Router();

// GET /api/factory/users
router.get('/users', authenticateToken, async (req: AuthRequest, res: ApiResponse<FactoryUsersResponse>) => {
  try {
    const db = getDb();
    const currentUser = req.user;

    if (!currentUser) {
      return res.status(401).json({ error: 'Unauthorized. User data missing.' });
    }

    const selectFields =
      'SELECT id, name, email, username, role, avatar, department, designation, isDepartmentHead, loginEnabled, default_shift as defaultShift FROM factory_users';

    let query = '';
    const params: (string | undefined)[] = [];

    if (['factory_manager', 'factory_it', 'it', 'manager'].includes(currentUser.role)) {
      query = `${selectFields} ORDER BY username ASC`;
    } else if (currentUser.isDepartmentHead && currentUser.department) {
      query = `${selectFields} WHERE department = ? ORDER BY username ASC`;
      params.push(currentUser.department);
    } else {
      query = `${selectFields} WHERE id = ?`;
      params.push(currentUser.id);
    }

    if (['factory_manager', 'factory_it', 'it', 'manager'].includes(currentUser.role) || currentUser.isDepartmentHead) {
      const users = await db.all<DbUser[]>(query, params);
      return res.json(users.map((u) => ({ ...u, defaultShift: u.defaultShift })));
    } else {
      const user = await db.get<DbUser>(query, params);
      if (!user) {
        return res.status(404).json({ error: 'User profile not found.' });
      }
      return res.json([{ ...user, defaultShift: user.defaultShift }]);
    }
  } catch (error) {
    logger.error('Error fetching factory users data:', error);
    return res.status(500).json({ error: 'Failed to fetch factory users data.' });
  }
});

// POST /api/factory/users
router.post(
  '/users',
  authenticateToken,
  async (req: ApiAuthRequest<CreateFactoryUserRequestBody>, res: ApiResponse<CreateFactoryUserResponse>) => {
    if (!req.user || (req.user.role !== 'factory_it' && req.user.role !== 'it')) {
      res.status(403).json({
        error: 'Forbidden. Factory user administration requires Factory IT or Factory Manager role.',
      });
      return;
    }

    const {
      name,
      email,
      username,
      role,
      password,
      avatar,
      department,
      designation,
      isDepartmentHead,
      loginEnabled,
      defaultShift,
    } = req.body;

    if (!name || !username || !role) {
      res.status(400).json({ error: 'Name, username, and role are required.' });
      return;
    }

    const validFactoryRoles = ['factory_employee', 'factory_it', 'factory_manager'];
    if (!validFactoryRoles.includes(role)) {
      res.status(400).json({ error: 'Invalid factory role.' });
      return;
    }

    const finalEmail = email && email.trim() ? email.trim().toLowerCase() : null;
    const defaultPassword = process.env.VITE_DEFAULT_USER_PASSWORD;
    if (!defaultPassword) throw new Error('DEFAULT_USER_PASSWORD required');
    const clearPassword = password || defaultPassword;

    const normalizedIsDepartmentHead = isDepartmentHead ? 1 : 0;
    const normalizedLoginEnabled = loginEnabled === false || loginEnabled === 0 ? 0 : 1;

    try {
      const db = getDb();

      if (finalEmail) {
        const existingEmail = await db.get('SELECT id FROM factory_users WHERE email = ?', [finalEmail]);
        if (existingEmail) {
          res.status(400).json({ error: 'User with this email already exists.' });
          return;
        }
      }

      const existingUsername = await db.get('SELECT id FROM factory_users WHERE username = ?', [
        username.toLowerCase().trim(),
      ]);
      if (existingUsername) {
        res.status(400).json({ error: 'User with this username already exists.' });
        return;
      }

      const passwordHash = await bcrypt.hash(clearPassword, 10);
      const userId = `usr-${Date.now()}`;

      await db.run(
        'INSERT INTO factory_users (id, name, email, username, role, avatar, passwordHash, needsPasswordReset, department, designation, isDepartmentHead, loginEnabled, default_shift) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)',
        [
          userId,
          name,
          finalEmail,
          username.toLowerCase().trim(),
          role,
          avatar ? avatar.trim() : '',
          passwordHash,
          department ? department.trim() : null,
          designation ? designation.trim() : null,
          normalizedIsDepartmentHead,
          normalizedLoginEnabled,
          defaultShift || 'general',
        ]
      );

      const response: CreateFactoryUserResponse = {
        id: userId,
        name,
        email: finalEmail,
        username: username.toLowerCase().trim(),
        role,
        avatar: avatar ? avatar.trim() : '',
        department: department ? department.trim() : null,
        designation: designation ? designation.trim() : null,
        isDepartmentHead: normalizedIsDepartmentHead,
        loginEnabled: normalizedLoginEnabled,
        defaultShift: defaultShift || 'general',
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error('Failed to create factory user:', error);
      res.status(500).json({ error: 'Failed to register new factory user.' });
    }
  }
);

// DELETE /api/factory/users/:id
router.delete(
  '/users/:id',
  authenticateToken,
  async (req: AuthRequest, res: ApiResponse<DeleteFactoryUserResponse>) => {
    if (!req.user || (req.user.role !== 'factory_it' && req.user.role !== 'it')) {
      res.status(403).json({
        error: 'Forbidden. Factory user deletion requires Factory IT or Factory Manager role.',
      });
      return;
    }

    const userId = req.params.id;
    if (userId === req.user?.id) {
      res.status(400).json({
        error: 'Cannot delete your own logged-in account.',
      });
      return;
    }

    try {
      const db = getDb();
      const result = await db.run('DELETE FROM factory_users WHERE id = ?', [userId]);

      if (result.changes === 0) {
        res.status(404).json({ error: 'Factory user not found.' });
        return;
      }

      res.json({ message: 'Factory user deleted successfully.' });
    } catch {
      res.status(500).json({ error: 'Failed to delete factory user.' });
    }
  }
);

// PUT /api/factory/users/:id
router.put(
  '/users/:id',
  authenticateToken,
  async (req: ApiAuthRequest<UpdateFactoryUserRequestBody>, res: ApiResponse<UpdateFactoryUserResponse>) => {
    if (!req.user || (req.user.role !== 'factory_it' && req.user.role !== 'it')) {
      res.status(403).json({
        error: 'Forbidden. Factory user modification requires Factory IT or Factory Manager role.',
      });
      return;
    }

    const userId = String(req.params.id);
    const { name, email, department, designation, avatar, isDepartmentHead, loginEnabled, defaultShift } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Name is required.' });
      return;
    }

    const finalEmail = email && email.trim() ? email.trim().toLowerCase() : null;
    const finalDepartment = department && department.trim() ? department.trim() : null;
    const finalDesignation = designation && designation.trim() ? designation.trim() : null;

    const normalizedIsDepartmentHead = isDepartmentHead ? 1 : 0;
    const normalizedLoginEnabled = loginEnabled === false || loginEnabled === 0 ? 0 : 1;

    try {
      const db = getDb();

      if (finalEmail) {
        const existingEmail = await db.get('SELECT id FROM factory_users WHERE LOWER(email) = ? AND id != ?', [
          finalEmail,
          userId,
        ]);
        if (existingEmail) {
          res.status(400).json({ error: 'User with this email already exists.' });
          return;
        }
      }

      const result = await db.run(
        'UPDATE factory_users SET name = ?, email = ?, department = ?, designation = ?, avatar = ?, isDepartmentHead = ?, loginEnabled = ?, default_shift = ? WHERE id = ?',
        [
          name.trim(),
          finalEmail,
          finalDepartment,
          finalDesignation,
          avatar ? avatar.trim() : '',
          normalizedIsDepartmentHead,
          normalizedLoginEnabled,
          defaultShift || 'general',
          userId,
        ]
      );

      if (result.changes === 0) {
        res.status(404).json({ error: 'Factory user not found.' });
        return;
      }

      const response: UpdateFactoryUserResponse = {
        id: userId,
        name: name.trim(),
        email: finalEmail,
        department: finalDepartment,
        designation: finalDesignation,
        avatar: avatar ? avatar.trim() : '',
        isDepartmentHead: normalizedIsDepartmentHead,
        loginEnabled: normalizedLoginEnabled,
        defaultShift: defaultShift || 'general',
      };

      res.json(response);
    } catch (error) {
      logger.error('Failed to update factory user:', error);
      res.status(500).json({ error: 'Failed to update factory user details.' });
    }
  }
);

// POST /api/factory/users/:id/reset-password
router.post(
  '/users/:id/reset-password',
  authenticateToken,
  async (
    req: ApiAuthRequest<ResetFactoryUserPasswordRequestBody>,
    res: ApiResponse<ResetFactoryUserPasswordResponse>
  ) => {
    if (!req.user || (req.user.role !== 'factory_it' && req.user.role !== 'it')) {
      res.status(403).json({
        error: 'Forbidden. Factory password reset requires Factory IT or Factory Manager role.',
      });
      return;
    }

    const userId = req.params.id;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.trim().length < 4) {
      res.status(400).json({ error: 'Password must be at least 4 characters long.' });
      return;
    }

    try {
      const db = getDb();
      const user = await db.get<{ id: string }>('SELECT id FROM factory_users WHERE id = ?', [userId]);
      if (!user) {
        res.status(404).json({ error: 'Factory user not found.' });
        return;
      }

      const passwordHash = await bcrypt.hash(newPassword.trim(), 10);
      await db.run('UPDATE factory_users SET passwordHash = ?, needsPasswordReset = 1 WHERE id = ?', [
        passwordHash,
        userId,
      ]);

      res.json({
        message: 'Password reset successfully. User will be prompted to set a new password on next login.',
      });
    } catch (error) {
      logger.error('Failed to reset factory user password:', error);
      res.status(500).json({ error: 'Failed to reset factory user password.' });
    }
  }
);

// GET /api/factory/attendance
router.get(
  '/attendance',
  authenticateToken,
  async (req: AuthRequest, res: ApiResponse<FactoryAttendanceLogsResponse>) => {
    try {
      const db = getDb();
      const currentUser = req.user;

      if (!currentUser) {
        return res.status(401).json({ error: 'Unauthorized. User data missing.' });
      }

      let query = '';
      const params: (string | undefined)[] = [];

      if (['factory_manager', 'factory_it', 'it'].includes(currentUser.role)) {
        query = `
          SELECT id, name, userId, ioTime, method, status, timestamp 
          FROM factory_attendance_logs 
          ORDER BY timestamp DESC
        `;
      } else if (currentUser.isDepartmentHead && currentUser.department) {
        query = `
          SELECT l.id, l.name, l.userId, l.ioTime, l.method, l.status, l.timestamp 
          FROM factory_attendance_logs l
          JOIN factory_users u ON l.name = u.name
          WHERE u.department = ?
          ORDER BY l.timestamp DESC
        `;
        params.push(currentUser.department);
      } else {
        query = `
          SELECT id, name, userId, ioTime, method, status, timestamp 
          FROM factory_attendance_logs 
          WHERE name = ?
          ORDER BY timestamp DESC
        `;
        params.push(currentUser.name);
      }

      const logs = await db.all(query, params);
      return res.json(logs);
    } catch (error) {
      logger.error('Failed to retrieve factory attendance logs:', error);
      res.status(500).json({ error: 'Failed to retrieve factory attendance logs.' });
    }
  }
);

// POST /api/factory/attendance/manual
router.post(
  '/attendance/manual',
  authenticateToken,
  async (
    req: ApiAuthRequest<AddFactoryManualAttendanceRequestBody>,
    res: ApiResponse<AddFactoryManualAttendanceResponse>
  ) => {
    if (req.user?.role !== 'factory_manager') {
      res.status(403).json({
        error: 'Forbidden. Only Factory IT or Factory Manager can add manual attendance.',
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

      const ioTime = `${date} ${time}:00`;

      const user = await db.get('SELECT name FROM factory_users WHERE id = ?', [userId]);
      if (!user) {
        res.status(404).json({ error: 'Factory employee not found.' });
        return;
      }

      await db.run(
        'INSERT INTO factory_attendance_logs (name, userId, ioTime, method, status, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
        [user.name, userId, ioTime, 'Manual', status, ioTime]
      );

      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to add manual factory attendance:', error);
      res.status(500).json({ error: 'Failed to add manual factory attendance.' });
    }
  }
);

// DELETE /api/factory/attendance
router.delete(
  '/attendance',
  authenticateToken,
  async (req: AuthRequest, res: ApiResponse<ClearFactoryAttendanceResponse>) => {
    if (req.user?.role !== 'factory_manager') {
      res.status(403).json({
        error: 'Forbidden. Clearing factory attendance logs requires Factory IT or Factory Manager role.',
      });
      return;
    }
    try {
      const db = getDb();
      await db.run('DELETE FROM factory_attendance_logs');
      res.json({
        success: true,
        message: 'All factory attendance logs cleared.',
      });
    } catch (error) {
      logger.error('Failed to clear factory attendance logs:', error);
      res.status(500).json({ error: 'Failed to clear factory attendance logs.' });
    }
  }
);

// DELETE /api/factory/attendance/:id
router.delete(
  '/attendance/:id',
  authenticateToken,
  async (req: AuthRequest, res: ApiResponse<DeleteFactoryAttendanceLogResponse>) => {
    if (req.user?.role !== 'factory_manager') {
      res.status(403).json({
        error: 'Forbidden. Factory attendance log deletion requires Factory IT or Factory Manager role.',
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
      const log = await db.get('SELECT status FROM factory_attendance_logs WHERE id = ?', [logId]);
      if (!log) {
        res.status(404).json({ error: 'Factory attendance log not found.' });
        return;
      }

      await db.run('DELETE FROM factory_attendance_logs WHERE id = ?', [logId]);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to delete factory attendance log.' });
    }
  }
);

// GET /api/factory/attendance/stream
router.get('/attendance/stream', authenticateToken, (req: AuthRequest, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.add(res);
});

// GET /api/factory/shift-overrides/:userId/:date
router.get('/shift-overrides/:userId/:date', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const db = getDb();
    const { userId, date } = req.params;
    const currentUser = req.user;

    if (!currentUser) return res.status(401).json({ error: 'Unauthorized.' });

    const canView = currentUser.id === userId || ['factory_it', 'factory_manager', 'it'].includes(currentUser.role);
    if (!canView) return res.status(403).json({ error: 'Forbidden.' });

    const override = await db.get<{ shift: string }>(
      'SELECT shift FROM user_shift_overrides WHERE userId = ? AND date = ?',
      [userId, date]
    );
    return res.json({ shift: override?.shift ?? null });
  } catch (error) {
    logger.error('Error fetching shift override:', error);
    return res.status(500).json({ error: 'Failed to fetch shift override.' });
  }
});

// PUT /api/factory/shift-overrides/:userId/:date
router.put('/shift-overrides/:userId/:date', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const db = getDb();
    const { userId, date } = req.params;
    const { shift } = req.body as { shift: string };
    const currentUser = req.user;

    if (!currentUser) return res.status(401).json({ error: 'Unauthorized.' });

    const todayStr = new Date().toISOString().split('T')[0];

    const canWrite =
      (currentUser.id === userId && date === todayStr) ||
      ['factory_it', 'factory_manager', 'it'].includes(currentUser.role);
    if (!canWrite)
      return res.status(403).json({ error: 'Forbidden. Employees can only override their own current day shift.' });

    const validShifts = ['general', 'day', 'night', 'extended'];
    if (!validShifts.includes(shift)) return res.status(400).json({ error: 'Invalid shift code.' });

    await db.run(
      'INSERT INTO user_shift_overrides (userId, date, shift) VALUES (?, ?, ?) ON CONFLICT(userId, date) DO UPDATE SET shift = excluded.shift',
      [userId, date, shift]
    );
    return res.json({ success: true, userId, date, shift });
  } catch (error) {
    logger.error('Error saving shift override:', error);
    return res.status(500).json({ error: 'Failed to save shift override.' });
  }
});

export default router;
