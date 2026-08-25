import { Router } from 'express';

import type {
  ApiAuthRequest,
  ApiResponse,
  AuthRequest,
  CreateNoticeRequestBody,
  CreateNoticeResponse,
  DeleteNoticeResponse,
  NoticesResponse,
  UpdateNoticeRequestBody,
  UpdateNoticeResponse,
} from '../types/index.ts';

import { getDb } from '../db.ts';
import { authenticateToken } from '../middleware/auth.ts';
import logger from '../utils/logger.ts';

const router = Router();

// GET /api/notices
router.get('/', authenticateToken, async (req: AuthRequest, res: ApiResponse<NoticesResponse>) => {
  try {
    const db = getDb();
    const now = new Date().toISOString();
    let notices;

    if (req.user?.role === 'employee') {
      notices = await db.all(
        `SELECT n.id, n.type, n.authorName, n.authorRole, n.createdAt, n.expiresAt, 
                  n.enTitle, n.enContent, n.urTitle, n.urContent, 
                  u.avatar AS authorAvatar, u.department AS authorDepartment, u.designation AS authorDesignation
           FROM notices n
           LEFT JOIN users u ON n.authorName = u.name
           WHERE n.expiresAt IS NULL OR n.expiresAt > ? 
           ORDER BY n.createdAt DESC`,
        [now]
      );
    } else {
      notices = await db.all(
        `SELECT n.id, n.type, n.authorName, n.authorRole, n.createdAt, n.expiresAt, 
                  n.enTitle, n.enContent, n.urTitle, n.urContent, 
                  u.avatar AS authorAvatar, u.department AS authorDepartment, u.designation AS authorDesignation
           FROM notices n
           LEFT JOIN users u ON n.authorName = u.name
           ORDER BY n.createdAt DESC`
      );
    }

    const structuredNotices: NoticesResponse = notices.map((row) => ({
      id: row.id,
      type: row.type,
      authorName: row.authorName,
      authorRole: row.authorRole,
      authorAvatar: row.authorAvatar || '',
      authorDepartment: row.authorDepartment || '',
      authorDesignation: row.authorDesignation || '',
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      en: {
        title: row.enTitle,
        content: row.enContent,
      },
      ur: {
        title: row.urTitle,
        content: row.urContent,
      },
    }));

    return res.json(structuredNotices);
  } catch (error) {
    logger.error('Failed to fetch notices:', error);
    return res.status(500).json({ error: 'Failed to fetch notices.' });
  }
});

// POST /api/notices
router.post(
  '/',
  authenticateToken,
  async (req: ApiAuthRequest<CreateNoticeRequestBody>, res: ApiResponse<CreateNoticeResponse>) => {
    if (req.user?.role !== 'it' && req.user?.role !== 'manager' && req.user?.role !== 'executive') {
      res.status(403).json({
        error: 'Forbidden. Administrative privileges required to post notices.',
      });
      return;
    }

    const { type, en, ur, expiresAt } = req.body;

    if (!type || !en?.title || !en?.content || !ur?.title || !ur?.content) {
      res.status(400).json({
        error: 'Category, English fields, and Urdu fields are all required.',
      });
      return;
    }

    try {
      const db = getDb();
      const noticeId = `ntc-${Date.now()}`;
      const createdAt = new Date().toISOString();

      await db.run(
        `INSERT INTO notices (
              id, type, authorName, authorRole, createdAt, expiresAt, 
              enTitle, enContent, urTitle, urContent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ? )`,
        [
          noticeId,
          type,
          req.user.name || 'System',
          req.user.role,
          createdAt,
          expiresAt || null,
          en.title.trim(),
          en.content.trim(),
          ur.title.trim(),
          ur.content.trim(),
        ]
      );

      const response: CreateNoticeResponse = {
        id: noticeId,
        type,
        authorName: req.user.name || 'System',
        authorRole: req.user.role,
        createdAt,
        expiresAt: expiresAt || null,
        en,
        ur,
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error('Failed to create notice:', error);
      res.status(500).json({ error: 'Failed to publish notice.' });
    }
  }
);

// PUT /api/notices/:id
router.put(
  '/:id',
  authenticateToken,
  async (req: ApiAuthRequest<UpdateNoticeRequestBody>, res: ApiResponse<UpdateNoticeResponse>) => {
    if (req.user?.role !== 'it' && req.user?.role !== 'manager' && req.user?.role !== 'executive') {
      res.status(403).json({
        error: 'Forbidden. Administrative privileges required to edit notices.',
      });
      return;
    }

    const noticeId = req.params.id;
    const { type, en, ur, expiresAt } = req.body;

    if (!type || !en?.title || !en?.content || !ur?.title || !ur?.content) {
      res.status(400).json({ error: 'Missing required update properties.' });
      return;
    }

    try {
      const db = getDb();
      // 2. Fetch the notice from DB to check existence and ownership
      const existingNotice = await db.get<{ authorName: string }>('SELECT authorName FROM notices WHERE id = ?', [
        noticeId,
      ]);
      if (!existingNotice) {
        res.status(404).json({ error: 'Notice not found.' });
        return;
      }
      // 3. Verify that the authenticated user is the author
      if (existingNotice.authorName !== req.user?.name) {
        res.status(403).json({
          error: 'Forbidden. Only the author of this notice can edit it.',
        });
        return;
      }

      const result = await db.run(
        `UPDATE notices SET 
              type = ?, 
              expiresAt = ?, 
              enTitle = ?, 
              enContent = ?, 
              urTitle = ?, 
              urContent = ? 
             WHERE id = ?`,
        [type, expiresAt || null, en.title.trim(), en.content.trim(), ur.title.trim(), ur.content.trim(), noticeId]
      );

      if (result.changes === 0) {
        res.status(404).json({ error: 'Notice not found.' });
        return;
      }

      res.json({ message: 'Notice updated successfully.' });
    } catch (error) {
      logger.error('Failed to update notice:', error);
      res.status(500).json({ error: 'Failed to update notice.' });
    }
  }
);

// DELETE /api/notices/:id
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: ApiResponse<DeleteNoticeResponse>) => {
  if (req.user?.role !== 'it' && req.user?.role !== 'manager' && req.user?.role !== 'executive') {
    res.status(403).json({
      error: 'Forbidden. Administrative privileges required to delete notices.',
    });
    return;
  }

  const noticeId = req.params.id;

  try {
    const db = getDb();
    const result = await db.run('DELETE FROM notices WHERE id = ?', [noticeId]);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Notice not found.' });
      return;
    }

    res.json({ message: 'Notice deleted successfully.' });
  } catch (error) {
    logger.error('Failed to delete notice:', error);
    res.status(500).json({ error: 'Failed to discard notice.' });
  }
});

export default router;
