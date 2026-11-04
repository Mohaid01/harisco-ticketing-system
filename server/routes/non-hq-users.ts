import bcrypt from 'bcryptjs';
import { Router } from 'express';

import type {
  ApiAuthRequest,
  ApiResponse,
  AuthRequest,
  CreateNonHqUserRequestBody,
  CreateNonHqUserResponse,
  DbUser,
  DeleteNonHqUserResponse,
  NonHqUsersResponse,
  ResetNonHqUserPasswordRequestBody,
  ResetNonHqUserPasswordResponse,
  UpdateNonHqUserRequestBody,
  UpdateNonHqUserResponse,
} from '../types/index.ts';

import { getDb } from '../db.ts';
import { authenticateToken } from '../middleware/auth.ts';
import logger from '../utils/logger.ts';

const router = Router();

// GET /api/non-hq/users
router.get('/users', authenticateToken, async (req: AuthRequest, res: ApiResponse<NonHqUsersResponse>) => {
  try {
    const db = getDb();
    const currentUser = req.user;

    if (!currentUser) {
      return res.status(401).json({ error: 'Unauthorized. User data missing.' });
    }

    // Only IT users can access non hq users
    if (currentUser.role !== 'it') {
      return res.status(403).json({ error: 'Forbidden. Access denied.' });
    }

    const selectFields =
      'SELECT id, name, email, username, role, avatar, department, designation, isDepartmentHead, loginEnabled, is_active, offboarded_at, offboarded_by, offboard_reason FROM non_hq_users';

    const users = await db.all<DbUser[]>(selectFields);
    return res.json(users);
  } catch (error) {
    logger.error('Error fetching non hq users data:', error);
    return res.status(500).json({ error: 'Failed to fetch non hq users data.' });
  }
});

// POST /api/non-hq/users
router.post(
  '/users',
  authenticateToken,
  async (req: ApiAuthRequest<CreateNonHqUserRequestBody>, res: ApiResponse<CreateNonHqUserResponse>) => {
    if (!req.user || req.user.role !== 'it') {
      res.status(403).json({
        error: 'Forbidden. Non HQ user administration requires IT role.',
      });
      return;
    }

    const { username, password, name, email, department, designation, active } = req.body;

    if (!username || !name) {
      res.status(400).json({ error: 'Username and name are required.' });
      return;
    }

    const finalUsername = username.toLowerCase().trim();

    try {
      const db = getDb();

      const existingUsername = await db.get('SELECT id FROM non_hq_users WHERE username = ?', [finalUsername]);
      if (existingUsername) {
        res.status(400).json({ error: 'User with this username already exists.' });
        return;
      }

      const passwordHash = password ? await bcrypt.hash(password, 10) : await bcrypt.hash('DefaultPassword', 10);
      const userId = `usr-${Date.now()}`;

      await db.run(
        'INSERT INTO non_hq_users (id, name, email, username, role, avatar, passwordHash, needsPasswordReset, department, designation, isDepartmentHead, loginEnabled, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)',
        [
          userId,
          name.trim(),
          email || null,
          finalUsername,
          'non_hq_user',
          '',
          passwordHash,
          department || null,
          designation || null,
          0,
          1,
          active ? 1 : 0,
        ]
      );

      const response: CreateNonHqUserResponse = {
        id: userId,
        name: name.trim(),
        email: email || null,
        username: finalUsername,
        role: 'non_hq_user',
        avatar: '',
        department: department || null,
        designation: designation || null,
        isDepartmentHead: 0,
        loginEnabled: 1,
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error('Failed to create non hq user:', error);
      res.status(500).json({ error: 'Failed to register new non hq user.' });
    }
  }
);

// DELETE /api/non-hq/users/:id
router.delete('/users/:id', authenticateToken, async (req: AuthRequest, res: ApiResponse<DeleteNonHqUserResponse>) => {
  if (!req.user || req.user.role !== 'it') {
    res.status(403).json({
      error: 'Forbidden. Non HQ user deletion requires IT role.',
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
    const result = await db.run('DELETE FROM non_hq_users WHERE id = ?', [userId]);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Non HQ user not found.' });
      return;
    }

    res.json({ message: 'Non HQ user deleted successfully.' });
  } catch {
    res.status(500).json({ error: 'Failed to delete non hq user.' });
  }
});

// PUT /api/non-hq/users/:id
router.put(
  '/users/:id',
  authenticateToken,
  async (req: ApiAuthRequest<UpdateNonHqUserRequestBody>, res: ApiResponse<UpdateNonHqUserResponse>) => {
    if (!req.user || req.user.role !== 'it') {
      res.status(403).json({
        error: 'Forbidden. Non HQ user modification requires IT role.',
      });
      return;
    }

    const userId = String(req.params.id);
    const { name, email, username, password, department, designation, active } = req.body;

    if (username && !username.trim()) {
      res.status(400).json({ error: 'Username is required.' });
      return;
    }

    try {
      const db = getDb();

      if (username) {
        const finalUsername = username.trim().toLowerCase();
        const existingUsername = await db.get('SELECT id FROM non_hq_users WHERE LOWER(username) = ? AND id != ?', [
          finalUsername,
          userId,
        ]);
        if (existingUsername) {
          res.status(400).json({ error: 'User with this username already exists.' });
          return;
        }
      }

      let query = 'UPDATE non_hq_users SET name = ?, email = ?, department = ?, designation = ?, active = ? WHERE id = ?';
      const params: (string | number | null)[] = [
        name.trim(),
        email || null,
        department || null,
        designation || null,
        active !== undefined ? (active ? 1 : 0) : null,
        userId,
      ];

      if (password && password.trim()) {
        const passwordHash = await bcrypt.hash(password.trim(), 10);
        query = 'UPDATE non_hq_users SET name = ?, email = ?, department = ?, designation = ?, passwordHash = ?, needsPasswordReset = 1, active = ? WHERE id = ?';
        params.splice(5, 0, passwordHash);
      }

      const result = await db.run(query, params);

      if (result.changes === 0) {
        res.status(404).json({ error: 'Non HQ user not found.' });
        return;
      }

      const updatedUser = await db.get<DbUser>(
        'SELECT id, name, email, username, role, avatar, department, designation, isDepartmentHead, loginEnabled, is_active FROM non_hq_users WHERE id = ?',
        [userId]
      );

      const response: UpdateNonHqUserResponse = {
        id: userId,
        name: updatedUser.name,
        email: updatedUser.email,
        username: updatedUser.username,
        role: updatedUser.role,
        avatar: updatedUser.avatar,
        department: updatedUser.department,
        designation: updatedUser.designation,
        isDepartmentHead: updatedUser.isDepartmentHead,
        loginEnabled: updatedUser.loginEnabled,
      };

      res.json(response);
    } catch (error) {
      logger.error('Failed to update non hq user:', error);
      res.status(500).json({ error: 'Failed to update non hq user details.' });
    }
  }
);

// POST /api/non-hq/users/:id/offboard
router.post(
  '/users/:id/offboard',
  authenticateToken,
  async (req: AuthRequest, res: ApiResponse<{ message: string }>) => {
    if (!req.user || req.user.role !== 'it') {
      res.status(403).json({
        error: 'Forbidden. Non HQ user offboarding requires IT role.',
      });
      return;
    }

    const userId = String(req.params.id);
    const { reason, offboarded_at } = req.body;

    if (!reason || !offboarded_at) {
      res.status(400).json({ error: 'Reason and offboard date are required.' });
      return;
    }

    try {
      const db = getDb();
      const result = await db.run(
        'UPDATE non_hq_users SET is_active = 0, offboarded_at = ?, offboarded_by = ?, offboard_reason = ? WHERE id = ?',
        [offboarded_at, req.user.id, reason, userId]
      );

      if (result.changes === 0) {
        res.status(404).json({ error: 'Non HQ user not found.' });
        return;
      }

      res.json({ message: 'Non HQ user offboarded successfully.' });
    } catch {
      res.status(500).json({ error: 'Failed to offboard non hq user.' });
    }
  }
);

// POST /api/non-hq/users/:id/reset-password
router.post(
  '/users/:id/reset-password',
  authenticateToken,
  async (req: ApiAuthRequest<ResetNonHqUserPasswordRequestBody>, res: ApiResponse<ResetNonHqUserPasswordResponse>) => {
    if (!req.user || req.user.role !== 'it') {
      res.status(403).json({
        error: 'Forbidden. Non HQ user password reset requires IT role.',
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
      const user = await db.get<{ id: string }>('SELECT id FROM non_hq_users WHERE id = ?', [userId]);
      if (!user) {
        res.status(404).json({ error: 'Non HQ user not found.' });
        return;
      }

      const passwordHash = await bcrypt.hash(newPassword.trim(), 10);
      await db.run('UPDATE non_hq_users SET passwordHash = ?, needsPasswordReset = 1 WHERE id = ?', [
        passwordHash,
        userId,
      ]);

      res.json({
        message: 'Password reset successfully. User will be prompted to set a new password on next login.',
      });
    } catch (error) {
      logger.error('Failed to reset non hq user password:', error);
      res.status(500).json({ error: 'Failed to reset password.' });
    }
  }
);

export default router;
