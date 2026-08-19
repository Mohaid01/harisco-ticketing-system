import { ApiAuthRequest, ApiResponse, CreateUserRequestBody, CreateUserResponse } from '@types';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';

import { globalLimiter, PORT, writeLimiter } from './constants.ts';
import { getDb, initDb } from './db.js';
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
              styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
              imgSrc: ["'self'", 'data:', 'https:'],
              connectSrc: ["'self'", 'ws:', 'wss:'],
              fontSrc: ["'self'", 'https://fonts.gstatic.com'],
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

app.post('/adduser', async (req: ApiAuthRequest<CreateUserRequestBody>, res: ApiResponse<CreateUserResponse>) => {
  if (req.user?.role !== 'it') {
    res.status(403).json({
      error: 'Forbidden. User administration requires IT role.',
    });
    return;
  }

  const {
    name,
    email,
    username,
    role,
    password,
    avatar,
    department,
    designation,
    isDepartmentHead,
    loginEnabled,
    shift,
  } = req.body;
  if (!name || !username || !role || !shift) {
    res.status(400).json({ error: 'Name, username, role, and shift are required.' });
    return;
  }

  const finalEmail = email && email.trim() ? email.trim().toLowerCase() : null;
  const defaultPassword = process.env.VITE_DEFAULT_USER_PASSWORD;
  if (!defaultPassword) throw new Error('DEFAULT_USER_PASSWORD required');
  const clearPassword = password || defaultPassword;

  const normalizedIsDepartmentHead = isDepartmentHead ? 1 : 0;
  const normalizedLoginEnabled = loginEnabled === false || loginEnabled === 0 ? 0 : 1;

  try {
    const db = getDb();

    if (finalEmail) {
      const existingEmail = await db.get('SELECT id FROM users WHERE email = ?', [finalEmail]);
      if (existingEmail) {
        res.status(400).json({ error: 'User with this email already exists.' });
        return;
      }
    }

    const existingUsername = await db.get('SELECT id FROM users WHERE username = ?', [username.toLowerCase().trim()]);
    if (existingUsername) {
      res.status(400).json({ error: 'User with this username already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(clearPassword, 10);
    const userId = `usr-${Date.now()}`;

    await db.run(
      'INSERT INTO users (id, name, email, username, role, avatar, passwordHash, needsPasswordReset, department, designation, isDepartmentHead, loginEnabled) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)',
      [
        userId,
        name,
        finalEmail,
        username.toLowerCase().trim(),
        role,
        avatar ? avatar.trim() : '',
        passwordHash,
        department ? department.trim() : null,
        designation ? designation.trim() : null,
        normalizedIsDepartmentHead,
        normalizedLoginEnabled,
      ]
    );

    const response: CreateUserResponse = {
      id: userId,
      name,
      email: finalEmail,
      username: username.toLowerCase().trim(),
      role,
      avatar: avatar ? avatar.trim() : '',
      department: department ? department.trim() : null,
      designation: designation ? designation.trim() : null,
      isDepartmentHead: normalizedIsDepartmentHead,
      loginEnabled: normalizedLoginEnabled,
      shift,
    };

    res.status(201).json(response);
  } catch (error) {
    logger.error('Failed to create user:', error);
    res.status(500).json({ error: 'Failed to register new user.' });
  }
});

startServer();
