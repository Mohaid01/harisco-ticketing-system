import { AuthRequest } from '@types';
import { logger } from '@utils';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || (req.query.token as string);

  if (!token) {
    res.status(401).json({ error: 'Authentication token required.' });
    return;
  }

  jwt.verify(token, process.env.JWT_SECRET!, (err: any, decoded: any) => {
    if (err || !decoded || typeof decoded !== 'object') {
      logger.error('[AUTH] jwt.verify failed:', err?.message);
      res.status(403).json({ error: 'Invalid or expired token.' });
      return;
    }

    (req as AuthRequest).user = decoded;
    next();
  });
}
