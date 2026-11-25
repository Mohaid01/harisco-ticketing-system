import { Request, Response, Router } from 'express';
import multer from 'multer';

import { authenticateToken } from '../middleware/auth.ts';
import {
  deleteFace,
  FaceServiceError,
  getFaceSampleCount,
  recognizeFace,
  registerFace,
} from '../services/face-service.ts';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// ---------------------------------------------------------------------------
// 1. Register face templates for a user (multipart: userId + image file)
//    Forwards the image to Python /register which extracts SFace embeddings.
// ---------------------------------------------------------------------------
router.post(
  '/register',
  upload.single('image'),
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.body as { userId: string };
      if (!req.file || !userId) {
        res.status(400).json({ error: 'userId and image file are required.' });
        return;
      }

      const result = await registerFace(
        userId,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof FaceServiceError) {
        res.status(error.status).json({ error: error.message });
      } else {
        const msg = error instanceof Error ? error.message : 'Unexpected face service failure.';
        res.status(500).json({ error: msg });
      }
    }
  }
);

// ---------------------------------------------------------------------------
// 2. Recognize / Verify a face embedding against stored templates (JSON body)
// ---------------------------------------------------------------------------
router.post('/recognize', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { embedding, userId } = req.body as { embedding: number[]; userId?: string };
    if (!embedding || !Array.isArray(embedding)) {
      res.status(400).json({ error: 'embedding array is required.' });
      return;
    }

    const targetUserId = userId || (req.user as { id?: string })?.id;
    if (!targetUserId) {
      res.status(400).json({ error: 'userId is required.' });
      return;
    }

    const result = await recognizeFace(embedding, targetUserId);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof FaceServiceError) {
      res.status(error.status).json({ error: error.message });
    } else {
      const msg = error instanceof Error ? error.message : 'Unexpected face service failure.';
      res.status(500).json({ error: msg });
    }
  }
});

// ---------------------------------------------------------------------------
// 3. Get number of registered samples for a user
// ---------------------------------------------------------------------------
router.get('/references/:userId', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    if (!userId) {
      res.status(400).json({ error: 'Missing user ID.' });
      return;
    }

    const totalSamples = await getFaceSampleCount(userId);
    if (totalSamples === 0) {
      res.status(404).json({ error: 'User not found.', total_samples: 0 });
      return;
    }
    res.status(200).json({ user_id: userId, total_samples: totalSamples });
  } catch (error) {
    if (error instanceof FaceServiceError) {
      res.status(error.status).json({ error: error.message });
    } else {
      const msg = error instanceof Error ? error.message : 'Unexpected face service failure.';
      res.status(500).json({ error: msg });
    }
  }
});

// ---------------------------------------------------------------------------
// 4. Delete a user's face data
// ---------------------------------------------------------------------------
router.delete('/register/:userId', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    if (!userId) {
      res.status(400).json({ error: 'Missing user ID.' });
      return;
    }

    await deleteFace(userId);
    res.status(200).json({ status: 'deleted', user_id: userId });
  } catch (error) {
    if (error instanceof FaceServiceError) {
      res.status(error.status).json({ error: error.message });
    } else {
      const msg = error instanceof Error ? error.message : 'Unexpected face service failure.';
      res.status(500).json({ error: msg });
    }
  }
});

export default router;
