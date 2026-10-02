import bcrypt from 'bcryptjs';
import { Router } from 'express';

import type {
  ApiAuthRequest,
  ApiResponse,
  AuthRequest,
  CreateExternalUserRequestBody,
  CreateExternalUserResponse,
  DbUser,
  DeleteExternalUserResponse,
  ExternalUsersResponse,
  UpdateExternalUserRequestBody,
  UpdateExternalUserResponse,
} from '../types/index.ts';

import { getDb } from '../db.ts';
import { authenticateToken } from '../middleware/auth.ts';
import logger from '../utils/logger.ts';

const router = Router();

// GET /api/external/users
router.get('/users', authenticateToken, async (req: AuthRequest, res: ApiResponse<ExternalUsersResponse>) => {
  try {
    const db = getDb();
    const currentUser = req.user;

    if (!currentUser) {
      return res.status(401).json({ error: 'Unauthorized. User data missing.' });
    }

    // Only IT can access external users
    if (currentUser.role !== 'it') {
      return res.status(403).json({ error: 'Forbidden. Access denied.' });
    }

    const selectFields =
      'SELECT id, name, email, username, role, avatar, department, designation, isDepartmentHead, loginEnabled, is_active, offboarded_at, offboarded_by, offboard_reason FROM external_users';

    const users = await db.all<DbUser[]>(selectFields, []);
    return res.json(users);
  } catch (error) {
    logger.error('Error fetching external users data:', error);
    return res.status(500).json({ error: 'Failed to fetch external users data.' });
  }
});

// POST /api/external/users
router.post(
  '/users',
  authenticateToken,
  async (req: ApiAuthRequest<CreateExternalUserRequestBody>, res: ApiResponse<CreateExternalUserResponse>) => {
    if (!req.user || req.user.role !== 'it') {
      res.status(403).json({
        error: 'Forbidden. External user administration requires IT role.',
      });
      return;
    }

    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required.' });
      return;
    }

    const finalUsername = username.toLowerCase().trim();

    try {
      const db = getDb();

      const existingUsername = await db.get('SELECT id FROM external_users WHERE username = ?', [finalUsername]);
      if (existingUsername) {
        res.status(400).json({ error: 'User with this username already exists.' });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const userId = `usr-${Date.now()}`;

      // Use 'external' role for external users
      await db.run(
        'INSERT INTO external_users (id, name, email, username, role, avatar, passwordHash, needsPasswordReset, department, designation, isDepartmentHead, loginEnabled) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)',
        [
          userId,
          finalUsername, // name same as username for external users
          null, // email
          finalUsername,
          'external', // role
          '', // avatar
          passwordHash,
          null, // department
          null, // designation
          0, // isDepartmentHead
          1, // loginEnabled
        ]
      );

      const response: CreateExternalUserResponse = {
        id: userId,
        name: finalUsername,
        email: null,
        username: finalUsername,
        role: 'external',
        avatar: '',
        department: null,
        designation: null,
        isDepartmentHead: 0,
        loginEnabled: 1,
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error('Failed to create external user:', error);
      res.status(500).json({ error: 'Failed to register new external user.' });
    }
  }
);

// DELETE /api/external/users/:id
router.delete(
  '/users/:id',
  authenticateToken,
  async (req: AuthRequest, res: ApiResponse<DeleteExternalUserResponse>) => {
    if (!req.user || req.user.role !== 'it') {
      res.status(403).json({
        error: 'Forbidden. External user deletion requires IT role.',
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
      const result = await db.run('DELETE FROM external_users WHERE id = ?', [userId]);

      if (result.changes === 0) {
        res.status(404).json({ error: 'External user not found.' });
        return;
      }

      res.json({ message: 'External user deleted successfully.' });
    } catch {
      res.status(500).json({ error: 'Failed to delete external user.' });
    }
  }
);

// PUT /api/external/users/:id
router.put(
  '/users/:id',
  authenticateToken,
  async (req: ApiAuthRequest<UpdateExternalUserRequestBody>, res: ApiResponse<UpdateExternalUserResponse>) => {
    if (!req.user || req.user.role !== 'it') {
      res.status(403).json({
        error: 'Forbidden. External user modification requires IT role.',
      });
      return;
    }

    const userId = String(req.params.id);
    const { username, password } = req.body;

    if (!username || !username.trim()) {
      res.status(400).json({ error: 'Username is required.' });
      return;
    }

    const finalUsername = username.trim().toLowerCase();

    try {
      const db = getDb();

      // Check if username already exists for another user
      const existingUsername = await db.get('SELECT id FROM external_users WHERE LOWER(username) = ? AND id != ?', [
        finalUsername,
        userId,
      ]);
      if (existingUsername) {
        res.status(400).json({ error: 'User with this username already exists.' });
        return;
      }

      let query = 'UPDATE external_users SET username = ? WHERE id = ?';
      const params: (string | undefined)[] = [finalUsername, userId];

      if (password && password.trim()) {
        const passwordHash = await bcrypt.hash(password.trim(), 10);
        query = 'UPDATE external_users SET username = ?, passwordHash = ?, needsPasswordReset = 1 WHERE id = ?';
        params.splice(1, 0, passwordHash);
      }

      const result = await db.run(query, params);

      if (result.changes === 0) {
        res.status(404).json({ error: 'External user not found.' });
        return;
      }

      const response: UpdateExternalUserResponse = {
        id: userId,
        username: finalUsername,
      };

      res.json(response);
    } catch (error) {
      logger.error('Failed to update external user:', error);
      res.status(500).json({ error: 'Failed to update external user details.' });
    }
  }
);

export default router;
