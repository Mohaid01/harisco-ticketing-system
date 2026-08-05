import type { NextFunction, Request, Response } from 'express';

import { RequestWithId } from '@types';

import { logger } from './logger.ts';

export const requestId = (req: Request, res: Response, next: NextFunction) => {
  const requestId =
    req.headers['x-request-id']?.toString() || `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  (req as RequestWithId).requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
};

export const performanceTiming = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    if (durationMs > 1000) {
      logger.warn(
        JSON.stringify({
          level: 'warn',
          timestamp: new Date().toISOString(),
          message: 'Slow request',
          path: req.path,
          method: req.method,
          durationMs,
          statusCode: res.statusCode,
        })
      );
    }
  });
  next();
};
