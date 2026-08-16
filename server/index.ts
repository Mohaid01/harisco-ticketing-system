import cors from 'cors';
import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';

import { globalLimiter, PORT, writeLimiter } from './constants.ts';
import { initDb } from './db.js';
import { setupDeviceHandlers } from './devices/index.ts';
import { sseClients } from './middleware/sse.ts';
import activityLogsRouter from './routes/activity-logs.ts';
import adminTicketsRouter from './routes/admin-tickets.ts';
import attendanceRouter from './routes/attendance.ts';
import authRouter from './routes/auth.ts';
import factoryRouter from './routes/factory.ts';
import healthRouter from './routes/health.ts';
import holidaysRouter from './routes/holidays.ts';
import leavesRouter from './routes/leaves.ts';
import noticesRouter from './routes/notices.ts';
import siteDutiesRouter from './routes/site-duties.ts';
import ticketsRouter from './routes/tickets.ts';
import usersRouter from './routes/users.ts';
import logger from './utils/logger.ts';
import { performanceTiming, requestId } from './utils/middleware.ts';

const app = express();

// Request ID middleware for correlation
app.use(requestId);

// Performance timing middleware
app.use(performanceTiming);

// Global crash handlers — log the exact error before process exits
process.on('uncaughtException', (err) => {
  logger.error('[FATAL] uncaughtException:', err);
});
process.on('unhandledRejection', (reason) => {
  logger.error('[FATAL] unhandledRejection:', reason);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Security Headers — keep CSP enabled in all environments; relax directives in dev for Vite HMR
app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === 'production'
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'https:'],
              connectSrc: ["'self'", 'ws:', 'wss:'],
              fontSrc: ["'self'"],
              objectSrc: ["'none'"],
              mediaSrc: ["'self'"],
              frameSrc: ["'none'"],
            },
          }
        : {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'http://localhost:5173'],
              styleSrc: ["'self'", "'unsafe-inline'", 'http://localhost:5173'],
              imgSrc: ["'self'", 'data:', 'https:', 'http://localhost:5173'],
              connectSrc: ["'self'", 'http://localhost:5173', 'ws://localhost:5173', 'wss:'],
              fontSrc: ["'self'", 'data:', 'http://localhost:5173'],
              objectSrc: ["'none'"],
              mediaSrc: ["'self'"],
              frameSrc: ["'none'"],
            },
          },
  })
);

// Required: trust Cloudflare Tunnel proxy so express-rate-limit reads X-Forwarded-For correctly
app.set('trust proxy', true);

// Strict CORS: allow Vite dev server locally, but restrict in production
app.use(
  cors({
    origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173',
  })
);

app.use(express.json({ limit: '10mb' }));

// Loose global tracker applied to every endpoint under /api
app.use('/api', globalLimiter);

// High-performance centralized wrapper for write operations
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  switch (req.method) {
    case 'POST':
    case 'PUT':
    case 'DELETE':
    case 'PATCH':
      return writeLimiter(req, res, next);
    default:
      next(); // Instant bypass for GET requests with zero allocation overhead
  }
});

app.use('/api/activity-logs', activityLogsRouter);
app.use('/api/admin-tickets', adminTicketsRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/auth', authRouter);
app.use('/api/factory', factoryRouter);
app.use('/api/health', healthRouter);
app.use('/api/holidays', holidaysRouter);
app.use('/api/leaves', leavesRouter);
app.use('/api/notices', noticesRouter);
app.use('/api/site-duties', siteDutiesRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/users', usersRouter);

// Start Database and Server
// Serve static frontend files in production
app.use(express.static(path.join(__dirname, '../dist')));

// Fallback all non-API routes to index.html (SPA routing)
app.get(/.*/, (_, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

async function startServer() {
  try {
    await initDb();
    const server = app.listen(PORT as number, '0.0.0.0', () => {
      logger.info(`Backend server is running on http://localhost:${PORT}`);
    });

    process.on('SIGINT', () => {
      logger.info('Shutting down gracefully...');
      sseClients.stop();
      server.close(() => process.exit(0));
    });

    setupDeviceHandlers(app, server);
  } catch (err) {
    logger.error('Failed to start database/server:', err);
    process.exit(1);
  }
}

startServer();
