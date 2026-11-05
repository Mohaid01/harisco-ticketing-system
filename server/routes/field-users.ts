import bcrypt from 'bcryptjs';
import { Router } from 'express';

import type {
  ApiAuthRequest,
  ApiResponse,
  AuthRequest,
  CreateFieldUserRequestBody,
  CreateFieldUserResponse,
  DbUser,
  DeleteFieldUserResponse,
  FieldUsersResponse,
  ResetFieldUserPasswordRequestBody,
  ResetFieldUserPasswordResponse,
  UpdateFieldUserRequestBody,
  UpdateFieldUserResponse,
} from '../types/index.ts';

import { getDb } from '../db.ts';
import { authenticateToken } from '../middleware/auth.ts';
import logger from '../utils/logger.ts';

const router = Router();

// GET /api/field/users
router.get('/users', authenticateToken, async (req: AuthRequest, res: ApiResponse<FieldUsersResponse>) => {
  try {
    const db = getDb();
    const currentUser = req.user;

    if (!currentUser) {
      return res.status(401).json({ error: 'Unauthorized. User data missing.' });
    }

    // Only IT users can access field users
    if (currentUser.role !== 'it') {
      return res.status(403).json({ error: 'Forbidden. Access denied.' });
    }

    const selectFields =
      'SELECT id, name, email, username, role, avatar, department, designation, isDepartmentHead, loginEnabled, is_active, offboarded_at, offboarded_by, offboard_reason FROM field_users';

    const users = await db.all<DbUser[]>(selectFields);
    return res.json(users);
  } catch (error) {
    logger.error('Error fetching field users data:', error);
    return res.status(500).json({ error: 'Failed to fetch field users data.' });
  }
});

// POST /api/field/users
router.post(
  '/users',
  authenticateToken,
  async (req: ApiAuthRequest<CreateFieldUserRequestBody>, res: ApiResponse<CreateFieldUserResponse>) => {
    if (!req.user || req.user.role !== 'it') {
      res.status(403).json({
        error: 'Forbidden. Field user administration requires IT role.',
      });
      return;
    }

    const { username, password, name, email, department, designation, active } = req.body;

    if (!username || !name) {
      res.status(400).json({ error: 'Username and name are required.' });
      return;
    }

    // Format employee code to HC-XXXXX
    const rawUsername = username.trim();
    const numericPart = rawUsername.replace(/\D/g, '');
    const formattedUsername = numericPart ? `HC-${numericPart.padStart(5, '0')}` : `HC-${rawUsername}`;

    try {
      const db = getDb();

      // Check username uniqueness across ALL user tables
      const tables = ['users', 'factory_users', 'external_users', 'field_users', 'non_hq_users'];
      for (const table of tables) {
        const existing = await db.get(`SELECT id FROM ${table} WHERE LOWER(username) = ?`, [
          formattedUsername.toLowerCase(),
        ]);
        if (existing) {
          res.status(400).json({ error: 'Employee code already exists across user tables.' });
          return;
        }
      }

      const passwordHash = password ? await bcrypt.hash(password, 10) : await bcrypt.hash('DefaultPassword', 10);
      const userId = `usr-${Date.now()}`;

      await db.run(
        'INSERT INTO field_users (id, name, email, username, role, avatar, passwordHash, needsPasswordReset, department, designation, isDepartmentHead, loginEnabled, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)',
        [
          userId,
          name.trim(),
          email || null,
          formattedUsername,
          'field_user',
          '',
          passwordHash,
          department || null,
          designation || null,
          0,
          1,
          active ? 1 : 0,
        ]
      );

      const response: CreateFieldUserResponse = {
        id: userId,
        name: name.trim(),
        email: email || null,
        username: formattedUsername,
        role: 'field_user',
        avatar: '',
        department: department || null,
        designation: designation || null,
        isDepartmentHead: 0,
        loginEnabled: 1,
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error('Failed to create field user:', error);
      res.status(500).json({ error: 'Failed to register new field user.' });
    }
  }
);

// DELETE /api/field/users/:id
router.delete('/users/:id', authenticateToken, async (req: AuthRequest, res: ApiResponse<DeleteFieldUserResponse>) => {
  if (!req.user || req.user.role !== 'it') {
    res.status(403).json({
      error: 'Forbidden. Field user deletion requires IT role.',
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
    const result = await db.run('DELETE FROM field_users WHERE id = ?', [userId]);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Field user not found.' });
      return;
    }

    res.json({ message: 'Field user deleted successfully.' });
  } catch {
    res.status(500).json({ error: 'Failed to delete field user.' });
  }
});

// PUT /api/field/users/:id
router.put(
  '/users/:id',
  authenticateToken,
  async (req: ApiAuthRequest<UpdateFieldUserRequestBody>, res: ApiResponse<UpdateFieldUserResponse>) => {
    if (!req.user || req.user.role !== 'it') {
      res.status(403).json({
        error: 'Forbidden. Field user modification requires IT role.',
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
        // Format employee code to HC-XXXXX
        const rawUsername = username.trim();
        const numericPart = rawUsername.replace(/\D/g, '');
        const formattedUsername = numericPart ? `HC-${numericPart.padStart(5, '0')}` : `HC-${rawUsername}`;

        // Check username uniqueness across ALL user tables (excluding current user)
        const tables = ['users', 'factory_users', 'external_users', 'field_users', 'non_hq_users'];
        for (const table of tables) {
          const existing = await db.get(`SELECT id FROM ${table} WHERE LOWER(username) = ? AND id != ?`, [
            formattedUsername.toLowerCase(),
            userId,
          ]);
          if (existing) {
            res.status(400).json({ error: 'Employee code already exists across user tables.' });
            return;
          }
        }
      }

      let query =
        'UPDATE field_users SET name = ?, email = ?, department = ?, designation = ?, active = ? WHERE id = ?';
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
        query =
          'UPDATE field_users SET name = ?, email = ?, department = ?, designation = ?, passwordHash = ?, needsPasswordReset = 1, active = ? WHERE id = ?';
        params.splice(5, 0, passwordHash);
      }

      const result = await db.run(query, params);

      if (result.changes === 0) {
        res.status(404).json({ error: 'Field user not found.' });
        return;
      }

      // If username was updated, apply the formatted username
      if (username) {
        await db.run('UPDATE field_users SET username = ? WHERE id = ?', [formattedUsername, userId]);
      }

      const updatedUser = await db.get<DbUser>(
        'SELECT id, name, email, username, role, avatar, department, designation, isDepartmentHead, loginEnabled, is_active FROM field_users WHERE id = ?',
        [userId]
      );

      const response: UpdateFieldUserResponse = {
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
      logger.error('Failed to update field user:', error);
      res.status(500).json({ error: 'Failed to update field user details.' });
    }
  }
);

// POST /api/field/users/:id/offboard
router.post(
  '/users/:id/offboard',
  authenticateToken,
  async (req: AuthRequest, res: ApiResponse<{ message: string }>) => {
    if (!req.user || req.user.role !== 'it') {
      res.status(403).json({
        error: 'Forbidden. Field user offboarding requires IT role.',
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
        'UPDATE field_users SET is_active = 0, offboarded_at = ?, offboarded_by = ?, offboard_reason = ? WHERE id = ?',
        [offboarded_at, req.user.id, reason, userId]
      );

      if (result.changes === 0) {
        res.status(404).json({ error: 'Field user not found.' });
        return;
      }

      res.json({ message: 'Field user offboarded successfully.' });
    } catch {
      res.status(500).json({ error: 'Failed to offboard field user.' });
    }
  }
);

// POST /api/field/users/:id/reset-password
router.post(
  '/users/:id/reset-password',
  authenticateToken,
  async (req: ApiAuthRequest<ResetFieldUserPasswordRequestBody>, res: ApiResponse<ResetFieldUserPasswordResponse>) => {
    if (!req.user || req.user.role !== 'it') {
      res.status(403).json({
        error: 'Forbidden. Field user password reset requires IT role.',
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
      const user = await db.get<{ id: string }>('SELECT id FROM field_users WHERE id = ?', [userId]);
      if (!user) {
        res.status(404).json({ error: 'Field user not found.' });
        return;
      }

      const passwordHash = await bcrypt.hash(newPassword.trim(), 10);
      await db.run('UPDATE field_users SET passwordHash = ?, needsPasswordReset = 1 WHERE id = ?', [
        passwordHash,
        userId,
      ]);

      res.json({
        message: 'Password reset successfully. User will be prompted to set a new password on next login.',
      });
    } catch (error) {
      logger.error('Failed to reset field user password:', error);
      res.status(500).json({ error: 'Failed to reset password.' });
    }
  }
);

export default router;
