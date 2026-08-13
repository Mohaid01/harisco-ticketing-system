import bcrypt from 'bcryptjs';
import { Router } from 'express';

import type {
  ApiAuthRequest,
  ApiResponse,
  AuthRequest,
  CreateUserRequestBody,
  CreateUserResponse,
  DbUser,
  DeleteUserResponse,
  OffboardUserRequestBody,
  OffboardUserResponse,
  ResetUserPasswordRequestBody,
  ResetUserPasswordResponse,
  UpdateUserRequestBody,
  UpdateUserResponse,
  UsersResponse,
} from '../types/index.ts';

import { getDb } from '../db.ts';
import { authenticateToken } from '../middleware/auth.ts';
import logger from '../utils/logger.ts';

const router = Router();

// GET /api/users
router.get('/', authenticateToken, async (req: AuthRequest, res: ApiResponse<UsersResponse>) => {
  try {
    const db = getDb();
    const currentUser = req.user;

    if (!currentUser) {
      return res.status(401).json({ error: 'Unauthorized. User data missing.' });
    }

    const selectFields =
      'SELECT id, name, email, username, role, avatar, department, designation, isDepartmentHead, loginEnabled, casualLeaves, annualLeaves, medicalLeaves, is_active FROM users';

    let query = '';
    const params: (string | undefined)[] = [];

    if (['executive', 'manager', 'it'].includes(currentUser.role)) {
      query = `${selectFields} ORDER BY username ASC`;
    } else if (currentUser.isDepartmentHead) {
      query = `${selectFields} WHERE department = ? ORDER BY username ASC`;
      params.push(currentUser.department ?? undefined);
    } else {
      query = `${selectFields} WHERE id = ?`;
      params.push(currentUser.id);
    }

    if (['executive', 'manager', 'it'].includes(currentUser.role) || currentUser.isDepartmentHead) {
      const users = await db.all<DbUser[]>(query, params);
      return res.json(users);
    } else {
      const user = await db.get<DbUser>(query, params);
      if (!user) {
        return res.status(404).json({ error: 'User profile not found.' });
      }
      return res.json([user]);
    }
  } catch (error) {
    logger.error('Error fetching users data:', error);
    return res.status(500).json({ error: 'Failed to fetch users data.' });
  }
});

// POST /api/users
router.post(
  '/',
  authenticateToken,
  async (req: ApiAuthRequest<CreateUserRequestBody>, res: ApiResponse<CreateUserResponse>) => {
    if (req.user?.role !== 'it') {
      res.status(403).json({
        error: 'Forbidden. User administration requires IT role.',
      });
      return;
    }

    const { name, email, username, role, password, avatar, department, designation, isDepartmentHead, loginEnabled } =
      req.body;
    if (!name || !username || !role) {
      res.status(400).json({ error: 'Name, username, and role are required.' });
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
        const existingEmail = await db.get('SELECT id FROM users WHERE email = ?', [finalEmail]);
        if (existingEmail) {
          res.status(400).json({ error: 'User with this email already exists.' });
          return;
        }
      }

      const existingUsername = await db.get('SELECT id FROM users WHERE username = ?', [username.toLowerCase().trim()]);
      if (existingUsername) {
        res.status(400).json({ error: 'User with this username already exists.' });
        return;
      }

      const passwordHash = await bcrypt.hash(clearPassword, 10);
      const userId = `usr-${Date.now()}`;

      await db.run(
        'INSERT INTO users (id, name, email, username, role, avatar, passwordHash, needsPasswordReset, department, designation, isDepartmentHead, loginEnabled) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)',
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
        ]
      );

      const response: CreateUserResponse = {
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
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error('Failed to create user:', error);
      res.status(500).json({ error: 'Failed to register new user.' });
    }
  }
);

// DELETE /api/users/:id
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: ApiResponse<DeleteUserResponse>) => {
  if (req.user?.role !== 'it') {
    res.status(403).json({
      error: 'Forbidden. User deletion requires IT role.',
    });
    return;
  }

  const userId = String(req.params.id);
  if (userId === req.user?.id) {
    res.status(400).json({
      error: 'Cannot delete your own logged-in account.',
    });
    return;
  }

  try {
    const db = getDb();
    const result = await db.run('DELETE FROM users WHERE id = ?', [userId]);

    if (result.changes === 0) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    res.json({ message: 'User deleted successfully.' });
  } catch {
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

// POST /api/users/:id/offboard
router.post(
  '/:id/offboard',
  authenticateToken,
  async (req: ApiAuthRequest<OffboardUserRequestBody>, res: ApiResponse<OffboardUserResponse>) => {
    if (req.user?.role !== 'it') {
      res.status(403).json({
        error: 'Forbidden. User offboarding requires IT role.',
      });
      return;
    }

    const userId = String(req.params.id);
    const { reason } = req.body;

    if (userId === req.user?.id) {
      res.status(400).json({
        error: 'Cannot offboard your own logged-in account.',
      });
      return;
    }

    try {
      const db = getDb();
      const user = await db.get<{ id: string }>('SELECT id FROM users WHERE id = ? AND is_active = 1', [userId]);
      if (!user) {
        res.status(404).json({ error: 'Active user not found.' });
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      await db.run(
        'UPDATE users SET is_active = 0, offboarded_at = ?, offboarded_by = ?, offboard_reason = ? WHERE id = ?',
        [today, req.user?.id, reason ? reason.trim() : null, userId]
      );

      res.json({ message: 'User offboarded successfully.' });
    } catch {
      res.status(500).json({ error: 'Failed to offboard user.' });
    }
  }
);

// POST /api/users/:id/reset-password
router.post(
  '/:id/reset-password',
  authenticateToken,
  async (req: ApiAuthRequest<ResetUserPasswordRequestBody>, res: ApiResponse<ResetUserPasswordResponse>) => {
    if (req.user?.role !== 'it') {
      res.status(403).json({
        error: 'Forbidden. Password reset requires IT role.',
      });
      return;
    }

    const userId = String(req.params.id);
    const { newPassword } = req.body;

    if (!newPassword || newPassword.trim().length < 4) {
      res.status(400).json({ error: 'Password must be at least 4 characters long.' });
      return;
    }

    try {
      const db = getDb();
      const user = await db.get<{ id: string }>('SELECT id FROM users WHERE id = ?', [userId]);
      if (!user) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }

      const passwordHash = await bcrypt.hash(newPassword.trim(), 10);
      await db.run('UPDATE users SET passwordHash = ?, needsPasswordReset = 1 WHERE id = ?', [passwordHash, userId]);

      res.json({
        message: 'Password reset successfully. User will be prompted to set a new password on next login.',
      });
    } catch (error) {
      logger.error('Failed to reset user password:', error);
      res.status(500).json({ error: 'Failed to reset password.' });
    }
  }
);

// PUT /api/users/:id
router.put(
  '/:id',
  authenticateToken,
  async (req: ApiAuthRequest<UpdateUserRequestBody>, res: ApiResponse<UpdateUserResponse>) => {
    if (req.user?.role !== 'it') {
      res.status(403).json({
        error: 'Forbidden. User modification requires IT role.',
      });
      return;
    }

    const userId = String(req.params.id);
    const { name, email, department, designation, avatar, isDepartmentHead, loginEnabled } = req.body;

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
        const existingEmail = await db.get('SELECT id FROM users WHERE LOWER(email) = ? AND id != ?', [
          finalEmail,
          userId,
        ]);
        if (existingEmail) {
          res.status(400).json({ error: 'User with this email already exists.' });
          return;
        }
      }

      const result = await db.run(
        'UPDATE users SET name = ?, email = ?, department = ?, designation = ?, avatar = ?, isDepartmentHead = ?, loginEnabled = ? WHERE id = ?',
        [
          name.trim(),
          finalEmail,
          finalDepartment,
          finalDesignation,
          avatar ? avatar.trim() : '',
          normalizedIsDepartmentHead,
          normalizedLoginEnabled,
          userId,
        ]
      );

      if (result.changes === 0) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }

      const response: UpdateUserResponse = {
        id: userId,
        name: name.trim(),
        email: finalEmail,
        department: finalDepartment,
        designation: finalDesignation,
        avatar: avatar ? avatar.trim() : '',
        isDepartmentHead: normalizedIsDepartmentHead,
        loginEnabled: normalizedLoginEnabled,
      };

      res.json(response);
    } catch (error) {
      logger.error('Failed to update user:', error);
      res.status(500).json({ error: 'Failed to update user details.' });
    }
  }
);

export default router;
