import { Router } from 'express';

import type {
  ApiAuthRequest,
  AuthRequest,
  GrantScreenAccessRequestBody,
  ApiResponse,
  ScreenOverridesResponse,
} from '../types/index.ts';

import { getDb } from '../db.ts';
import { authenticateToken } from '../middleware/auth.ts';
import { grantScreenAccessSchema } from '../schemas/index.ts';
import logger from '../utils/logger.ts';

const router = Router();

// GET /api/screen-overrides/:screenName/users
// Returns the list of users who have been granted access to a specific screen
// Only IT role users can view the access list
router.get(
  '/:screenName/users',
  authenticateToken,
  async (req: AuthRequest, res: ApiResponse<ScreenOverridesResponse>) => {
    const currentUser = req.user;
    if (!currentUser) {
      return res.status(401).json({ error: 'Unauthorized. User data missing.' });
    }

    if (currentUser.role !== 'it') {
      return res.status(403).json({ error: 'Forbidden. Only IT administrators can manage screen overrides.' });
    }

    const { screenName } = req.params;

    try {
      const db = getDb();
      const overrides = await db.all<
        {
          id: number;
          screen_name: string;
          user_id: string;
          granted_by: string;
          granted_at: string;
          name: string;
          avatar: string;
          role: string;
        }[]
      >(
        `SELECT so.id, so.screen_name, so.user_id, so.granted_by, so.granted_at,
                u.name, u.avatar, u.role
         FROM screen_overrides so
         JOIN users u ON so.user_id = u.id
         WHERE so.screen_name = ? AND u.is_active = 1
         ORDER BY u.name ASC`,
        [screenName]
      );

      const response: ScreenOverridesResponse = overrides.map((o) => ({
        id: o.id,
        screen_name: o.screen_name,
        user_id: o.user_id,
        granted_by: o.granted_by,
        granted_at: o.granted_at,
        user_name: o.name,
        user_avatar: o.avatar,
        user_role: o.role,
      }));

      return res.json(response);
    } catch (err) {
      logger.error('[screen-overrides] Failed to fetch overrides:', err);
      return res.status(500).json({ error: 'Failed to fetch screen overrides.' });
    }
  }
);

// POST /api/screen-overrides/:screenName
// Replaces the entire allow list for a screen (IT only)
// Body: { userIds: string[] }
router.post('/:screenName', authenticateToken, async (req: ApiAuthRequest<GrantScreenAccessRequestBody>, res) => {
  const currentUser = req.user;
  if (!currentUser) {
    return res.status(401).json({ error: 'Unauthorized. User data missing.' });
  }

  if (currentUser.role !== 'it') {
    return res.status(403).json({ error: 'Forbidden. Only IT administrators can manage screen overrides.' });
  }

  const { screenName } = req.params;
  const parsed = grantScreenAccessSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { userIds } = parsed.data;

  try {
    const db = getDb();

    // Verify all user IDs exist and are active
    for (const userId of userIds) {
      const user = await db.get('SELECT id FROM users WHERE id = ? AND is_active = 1', [userId]);
      if (!user) {
        return res.status(404).json({ error: `Active user with id "${userId}" not found.` });
      }
    }

    // Replace the entire list: delete all existing, insert new
    await db.run('DELETE FROM screen_overrides WHERE screen_name = ?', [screenName]);

    // If the current IT user isn't in the list, add them
    const finalUserIds = userIds.includes(currentUser.id) ? userIds : [...userIds, currentUser.id];

    for (const userId of finalUserIds) {
      await db.run(
        'INSERT OR IGNORE INTO screen_overrides (screen_name, user_id, granted_by, granted_at) VALUES (?, ?, ?, ?)',
        [screenName, userId, currentUser.id, new Date().toISOString()]
      );
    }

    logger.info(
      `[screen-overrides] Updated access list for "${screenName}" (${finalUserIds.length} users) by ${currentUser.username}`
    );

    return res.json({
      success: true,
      screen_name: screenName,
      count: finalUserIds.length,
    });
  } catch (err) {
    logger.error('[screen-overrides] Failed to update overrides:', err);
    return res.status(500).json({ error: 'Failed to update screen overrides.' });
  }
});

// GET /api/screen-overrides/:screenName/check
// Checks if the current user has access to a screen (any authenticated user)
router.get('/:screenName/check', authenticateToken, async (req: AuthRequest, res) => {
  const currentUser = req.user;
  if (!currentUser) {
    return res.status(401).json({ error: 'Unauthorized. User data missing.' });
  }

  const { screenName } = req.params;

  try {
    const db = getDb();

    // IT administrators always retain access
    if (currentUser.role === 'it') {
      return res.json({ hasAccess: true });
    }

    // Everyone else must be explicitly granted access by an IT administrator.
    // Closed by default: an empty allow list means nobody but IT can open the screen.
    const override = await db.get(
      `SELECT so.user_id
       FROM screen_overrides so
       JOIN users u ON so.user_id = u.id
       WHERE so.screen_name = ? AND so.user_id = ? AND u.is_active = 1`,
      [screenName, currentUser.id]
    );

    return res.json({ hasAccess: !!override });
  } catch (err) {
    logger.error('[screen-overrides] Failed to check access:', err);
    return res.status(500).json({ error: 'Failed to check screen access.' });
  }
});

export default router;
