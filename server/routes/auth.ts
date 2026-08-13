import bcrypt from 'bcryptjs';
import { Router } from 'express';
import jwt from 'jsonwebtoken';

import type {
  ApiAuthRequest,
  ApiRequest,
  ApiResponse,
  AuthRequest,
  ChangePasswordRequestBody,
  ChangePasswordResponse,
  DbUser,
  LoginRequestBody,
  LoginResponse,
  MeResponse,
  ResetPasswordRequestBody,
  ResetPasswordResponse,
} from '../types/index.ts';

import { JWT_SECRET, loginLimiter } from '../constants.ts';
import { getDb } from '../db.ts';
import { authenticateToken } from '../middleware/auth.ts';
import logger from '../utils/logger.ts';

const router = Router();

// POST /api/auth/login
router.post('/login', loginLimiter, async (req: ApiRequest<LoginRequestBody>, res: ApiResponse<LoginResponse>) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required.' });
    return;
  }

  try {
    const db = getDb();
    const normalizedUsername = username.toLowerCase().trim();

    let user = await db.get<DbUser>(
      'SELECT id, name, email, username, role, avatar, passwordHash, needsPasswordReset, department, designation, isDepartmentHead, loginEnabled, casualLeaves, annualLeaves, medicalLeaves FROM users WHERE LOWER(username) = ?',
      [normalizedUsername]
    );

    if (!user) {
      user = await db.get<DbUser>(
        'SELECT id, name, email, username, role, avatar, passwordHash, needsPasswordReset, department, designation, isDepartmentHead, loginEnabled, NULL as casualLeaves, NULL as annualLeaves, NULL as medicalLeaves FROM factory_users WHERE LOWER(username) = ?',
        [normalizedUsername]
      );
    }

    if (!user) {
      logger.security('Login failed - invalid credentials', {
        username: normalizedUsername,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    if (!user.loginEnabled) {
      logger.security('Login blocked - account disabled', {
        userId: user.id,
        username: user.username,
        ip: req.ip,
      });
      res.status(403).json({
        error: 'Your account is disabled. Please contact IT.',
      });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

      const jwtPayload = {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        needsPasswordReset: user.needsPasswordReset,
        department: user.department,
        isDepartmentHead: user.isDepartmentHead,
        loginEnabled: user.loginEnabled,
        is_active: user.is_active,
      };
    const token = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: '7d' });

    logger.info('Login successful', {
      userId: user.id,
      username: user.username,
      role: user.role,
      ip: req.ip,
    });
    res.json({
      token,
      user: {
        ...jwtPayload,
        avatar: user.avatar,
        designation: user.designation,
        loginEnabled: user.loginEnabled,
        casualLeaves: user.casualLeaves,
        annualLeaves: user.annualLeaves,
        medicalLeaves: user.medicalLeaves,
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Database or server error during login.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req: AuthRequest, res: ApiResponse<MeResponse>) => {
  try {
    const db = getDb();
    let user = await db.get<DbUser>(
      'SELECT id, name, email, username, role, avatar, needsPasswordReset, department, designation, isDepartmentHead, loginEnabled, casualLeaves, annualLeaves, medicalLeaves FROM users WHERE id = ?',
      [req.user?.id]
    );

    if (!user) {
      user = await db.get<DbUser>(
        'SELECT id, name, email, username, role, avatar, needsPasswordReset, department, designation, isDepartmentHead, loginEnabled, NULL as casualLeaves, NULL as annualLeaves, NULL as medicalLeaves FROM factory_users WHERE id = ?',
        [req.user?.id]
      );
    }

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    res.json({ user });
  } catch (err) {
    logger.error('[ME] Error in /api/auth/me handler:', err);
    res.status(500).json({ error: 'Failed to fetch current user.' });
  }
});

// POST /api/auth/reset-password
router.post(
  '/reset-password',
  authenticateToken,
  async (req: ApiAuthRequest<ResetPasswordRequestBody>, res: ApiResponse<ResetPasswordResponse>) => {
    const { password } = req.body;
    if (!password || password.trim().length < 4) {
      res.status(400).json({ error: 'Password must be at least 4 characters long.' });
      return;
    }

    try {
      const db = getDb();
      const passwordHash = await bcrypt.hash(password, 10);
      const userId = req.user?.id;

      const result = await db.run('UPDATE users SET passwordHash = ?, needsPasswordReset = 0 WHERE id = ?', [
        passwordHash,
        userId,
      ]);

      let user = await db.get<DbUser>(
        'SELECT id, name, email, username, role, avatar, needsPasswordReset FROM users WHERE id = ?',
        [userId]
      );

      if (!user || result.changes === 0) {
        await db.run('UPDATE factory_users SET passwordHash = ?, needsPasswordReset = 0 WHERE id = ?', [
          passwordHash,
          userId,
        ]);
        user = await db.get<DbUser>(
          'SELECT id, name, email, username, role, avatar, needsPasswordReset FROM factory_users WHERE id = ?',
          [userId]
        );
      }

      if (!user) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }

      const payload = {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        avatar: user.avatar,
        needsPasswordReset: user.needsPasswordReset,
      };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

      logger.info('Password reset successful', { userId: req.user?.id });
      res.json({
        token,
        user: payload,
      });
    } catch {
      res.status(500).json({ error: 'Failed to reset password.' });
    }
  }
);

// POST /api/auth/change-password
router.post(
  '/change-password',
  authenticateToken,
  async (req: ApiAuthRequest<ChangePasswordRequestBody>, res: ApiResponse<ChangePasswordResponse>) => {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword || newPassword.trim().length < 4) {
      res.status(400).json({ error: 'New password must be at least 4 characters long.' });
      return;
    }

    try {
      const db = getDb();
      const userId = req.user?.id;

      let user = await db.get<DbUser>('SELECT passwordHash FROM users WHERE id = ?', [userId]);

      if (!user) {
        user = await db.get<DbUser>('SELECT passwordHash FROM factory_users WHERE id = ?', [userId]);
      }

      if (!user) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }

      const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
      if (!isMatch) {
        res.status(400).json({ error: 'Incorrect old password.' });
        return;
      }

      const newPasswordHash = await bcrypt.hash(newPassword, 10);

      const result = await db.run('UPDATE users SET passwordHash = ?, needsPasswordReset = 0 WHERE id = ?', [
        newPasswordHash,
        userId,
      ]);

      if (result.changes === 0) {
        await db.run('UPDATE factory_users SET passwordHash = ?, needsPasswordReset = 0 WHERE id = ?', [
          newPasswordHash,
          userId,
        ]);
      }

      res.json({ message: 'Password updated successfully.' });
    } catch (error) {
      logger.error('Change password error:', error);
      res.status(500).json({ error: 'Failed to update password.' });
    }
  }
);

export default router;
