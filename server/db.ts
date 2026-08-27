import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';

import logger from './utils/logger.ts';

let db: Database<sqlite3.Database, sqlite3.Statement>;

export async function initDb() {
  const dbPath = process.env.DB_PATH || path.resolve(process.cwd(), 'database.sqlite');

  if (process.env.DB_PATH) {
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  // Enable WAL mode for better concurrency (readers don't block writers, writers don't block readers)
  await db.exec('PRAGMA journal_mode = WAL');
  await db.exec('PRAGMA busy_timeout = 30000;');

  // Create Notices Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS notices (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      authorName TEXT NOT NULL,
      authorRole TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      expiresAt TEXT,
      enTitle TEXT NOT NULL,
      enContent TEXT NOT NULL,
      urTitle TEXT NOT NULL,
      urContent TEXT NOT NULL
    )
  `);

  // Create Users Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      username TEXT UNIQUE NOT NULL,
      role TEXT CHECK(role IN ('it', 'employee', 'manager', 'executive')) NOT NULL,
      avatar TEXT NOT NULL,
      passwordHash TEXT NOT NULL,
      needsPasswordReset INTEGER DEFAULT 1,
      isDepartmentHead INTEGER DEFAULT 0,
      loginEnabled INTEGER DEFAULT 1
    )
  `);

  // Migrate existing users table if email is NOT NULL
  try {
    const tableInfo = await db.all<{ name: string; notnull: number }[]>('PRAGMA table_info(users)');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const emailCol = tableInfo.find((c: any) => c.name === 'email');
    if (emailCol && emailCol.notnull === 1) {
      logger.info('Migrating users table to allow nullable email...');
      await db.exec('ALTER TABLE users RENAME TO users_old');
      await db.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          username TEXT UNIQUE NOT NULL,
          role TEXT CHECK(role IN ('it', 'employee', 'manager', 'executive')) NOT NULL,
          avatar TEXT NOT NULL,
          passwordHash TEXT NOT NULL,
          needsPasswordReset INTEGER DEFAULT 1
        )
      `);
      await db.exec(
        'INSERT INTO users SELECT id, name, email, username, role, avatar, passwordHash, needsPasswordReset FROM users_old'
      );
      await db.exec('DROP TABLE users_old');
      logger.info('Migration completed.');
    }
    const tableSchema = await db.get<{ sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='users'"
    );
    if (tableSchema && !tableSchema.sql.includes("'executive'")) {
      logger.info('Migrating users table structure...');
      await db.exec('ALTER TABLE users RENAME TO users_old');

      // Re-create the table keeping ALL required columns intact
      await db.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          username TEXT UNIQUE NOT NULL,
          role TEXT CHECK(role IN ('it', 'employee', 'manager', 'executive')) NOT NULL,
          avatar TEXT NOT NULL,
          passwordHash TEXT NOT NULL,
          needsPasswordReset INTEGER DEFAULT 1,
          isDepartmentHead INTEGER DEFAULT 0,
          loginEnabled INTEGER DEFAULT 1
        )
      `);

      // Determine columns available in old table to prevent crash if they don't exist yet
      const hasDeptHead = tableInfo.some(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c: any) => c.name === 'isDepartmentHead'
      );
      const hasLoginEnabled = tableInfo.some(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c: any) => c.name === 'loginEnabled'
      );

      await db.run(
        `
      INSERT INTO users (id, name, email, username, role, avatar, passwordHash, needsPasswordReset, isDepartmentHead, loginEnabled) 
        SELECT 
          id, name, email, username, role, avatar, passwordHash, needsPasswordReset,
          CASE WHEN ? = 1 THEN isDepartmentHead ELSE 0 END,
          CASE WHEN ? = 1 THEN loginEnabled ELSE 1 END
        FROM users_old
      `,
        [hasDeptHead ? 1 : 0, hasLoginEnabled ? 1 : 0]
      );

      await db.exec('DROP TABLE users_old');
      logger.info('Migration completed successfully.');
    }
  } catch (err) {
    logger.error('Migration check failed:', err);
  }

  // Create Tickets Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      type TEXT CHECK(type IN ('hardware', 'software', 'maintenance', 'upgrade', 'email', 'others')) NOT NULL,
      status TEXT CHECK(status IN ('open', 'awaiting_it_approval', 'awaiting_manager_approval', 'awaiting_handover', 'closed')) NOT NULL,
      justification TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      reporterId TEXT NOT NULL,
      reporterName TEXT NOT NULL,
      reporterEmail TEXT NOT NULL,
      assigneeId TEXT,
      assigneeName TEXT,
      quotation REAL
    )
  `);

  try {
  await db.exec('ALTER TABLE tickets ADD COLUMN quotation REAL');
} catch {
  // Column might already exist, ignore error
}

// ------------------------------------------------------------------
// 2. MIGRATION: Update 'type' CHECK constraint for EXISTING databases
// ------------------------------------------------------------------
try {
  // Check if existing table definition contains the new types (e.g., 'email')
  const ticketTable = await db.get<{ sql: string }>(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='tickets'"
  );

  if (ticketTable?.sql && (!ticketTable.sql.includes("email") || !ticketTable.sql.includes("others"))) {
    await db.exec(`
      PRAGMA foreign_keys=OFF;
      BEGIN TRANSACTION;

      CREATE TABLE tickets_new (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        type TEXT CHECK(type IN ('hardware', 'software', 'maintenance', 'upgrade', 'email', 'others')) NOT NULL,
        status TEXT CHECK(status IN ('open', 'awaiting_it_approval', 'awaiting_manager_approval', 'awaiting_handover', 'closed')) NOT NULL,
        justification TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        reporterId TEXT NOT NULL,
        reporterName TEXT NOT NULL,
        reporterEmail TEXT NOT NULL,
        assigneeId TEXT,
        assigneeName TEXT,
        quotation REAL
      );

      INSERT INTO tickets_new SELECT * FROM tickets;
      DROP TABLE tickets;
      ALTER TABLE tickets_new RENAME TO tickets;

      COMMIT;
      PRAGMA foreign_keys=ON;
    `);
  }
} catch (err) {
  console.error('Failed to migrate tickets type constraint:', err);
}

  try {
    await db.exec('ALTER TABLE users ADD COLUMN needsPasswordReset INTEGER DEFAULT 1');
  } catch {
    // Column might already exist, ignore error
  }

  try {
    await db.exec('ALTER TABLE users ADD COLUMN department TEXT');
  } catch {
    // Column might already exist, ignore error
  }

  try {
    await db.exec('ALTER TABLE users ADD COLUMN designation TEXT');
  } catch {
    // Column might already exist, ignore error
  }

  try {
    await db.exec('ALTER TABLE users ADD COLUMN isDepartmentHead INTEGER DEFAULT 0');
  } catch {
    // Column might already exist, ignore error
  }

  try {
    await db.exec('ALTER TABLE users ADD COLUMN loginEnabled INTEGER DEFAULT 1');
  } catch {
    // Column might already exist, ignore error
  }

  try {
    await db.exec('ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1');
  } catch {
    // Column might already exist, ignore error
  }

  try {
    await db.exec('ALTER TABLE users ADD COLUMN offboarded_at TEXT');
  } catch {
    // Column might already exist, ignore error
  }

  try {
    await db.exec('ALTER TABLE users ADD COLUMN offboarded_by TEXT');
  } catch {
    // Column might already exist, ignore error
  }

  try {
    await db.exec('ALTER TABLE users ADD COLUMN offboard_reason TEXT');
  } catch {
    // Column might already exist, ignore error
  }

  try {
    await db.exec('ALTER TABLE users ADD COLUMN casualLeaves INTEGER DEFAULT 12');
  } catch {
    // Column might already exist, ignore error
  }

  try {
    await db.exec('ALTER TABLE users ADD COLUMN annualLeaves INTEGER DEFAULT 14');
  } catch {
    // Column might already exist, ignore error
  }

  try {
    await db.exec('ALTER TABLE users ADD COLUMN medicalLeaves INTEGER DEFAULT 8');
  } catch {
    // Column might already exist, ignore error
  }

  try {
    await db.exec('ALTER TABLE users ADD COLUMN default_shift TEXT DEFAULT "headquarters"');
  } catch {
    // Column might already exist, ignore error
  }

  // Create Admin Tickets Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS admin_tickets (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT CHECK(status IN ('awaiting_admin_manager', 'awaiting_materials', 'awaiting_technician', 'awaiting_executive', 'resolved', 'rejected')) NOT NULL,
      previousStatus TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      reporterId TEXT NOT NULL,
      reporterName TEXT NOT NULL,
      reporterEmail TEXT NOT NULL,
      executiveId TEXT,
      executiveName TEXT
    )
  `);

  // Migrate admin_tickets to add rejected status and executive fields if missing
  try {
    const tableSchema = await db.get<{ sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='admin_tickets'"
    );
    if (tableSchema && (!tableSchema.sql.includes('executiveId') || !tableSchema.sql.includes("'rejected'"))) {
      logger.info('Migrating admin_tickets table to add rejected status...');
      await db.exec('ALTER TABLE admin_tickets RENAME TO admin_tickets_old');

      await db.exec(`
        CREATE TABLE admin_tickets (
          id TEXT PRIMARY KEY,
          description TEXT NOT NULL,
          category TEXT NOT NULL,
          status TEXT CHECK(status IN ('awaiting_admin_manager', 'awaiting_materials', 'awaiting_technician', 'awaiting_executive', 'resolved', 'rejected')) NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          reporterId TEXT NOT NULL,
          reporterName TEXT NOT NULL,
          reporterEmail TEXT NOT NULL,
          executiveId TEXT,
          executiveName TEXT
        )
      `);

      await db.exec(`
        INSERT INTO admin_tickets (id, description, category, status, createdAt, updatedAt, reporterId, reporterName, reporterEmail, executiveId, executiveName)
        SELECT id, description, category, status, createdAt, updatedAt, reporterId, reporterName, reporterEmail, executiveId, executiveName FROM admin_tickets_old
      `);

      await db.exec('DROP TABLE admin_tickets_old');
      logger.info('admin_tickets migration completed successfully.');
    }
  } catch (err) {
    logger.error('admin_tickets migration check failed:', err);
  }

  // Migrate admin_tickets to add previousStatus column if missing
  try {
    const adminTicketsCols = await db.all<{ name: string }>('PRAGMA table_info(admin_tickets)');
    if (!adminTicketsCols.some((c) => c.name === 'previousStatus')) {
      logger.info('Migrating admin_tickets table to add previousStatus column...');
      await db.exec('ALTER TABLE admin_tickets ADD COLUMN previousStatus TEXT');
      logger.info('Added previousStatus column to admin_tickets.');
    }
  } catch (err) {
    logger.error('Failed to add previousStatus column to admin_tickets:', err);
  }

  // Create Admin Comments Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS admin_comments (
      id TEXT PRIMARY KEY,
      ticketId TEXT NOT NULL,
      authorId TEXT NOT NULL,
      authorName TEXT NOT NULL,
      authorRole TEXT NOT NULL,
      content TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (ticketId) REFERENCES admin_tickets(id) ON DELETE CASCADE
    )
  `);

  // Create Admin Activity Logs Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS admin_activity_logs (
      id TEXT PRIMARY KEY,
      ticketId TEXT NOT NULL,
      action TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      performedByName TEXT NOT NULL,
      performedByRole TEXT NOT NULL,
      FOREIGN KEY (ticketId) REFERENCES admin_tickets(id) ON DELETE CASCADE
    )
  `);

  // Seed initial admin ticket numbering tracker
  try {
    await db.exec('ALTER TABLE admin_tickets ADD COLUMN sequence_num INTEGER DEFAULT 0');
  } catch {
    // Column might already exist, ignore error
  }

  // Create Comments Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      ticketId TEXT NOT NULL,
      authorId TEXT NOT NULL,
      authorName TEXT NOT NULL,
      authorRole TEXT NOT NULL,
      avatar TEXT NOT NULL,
      content TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (ticketId) REFERENCES tickets(id) ON DELETE CASCADE
    )
  `);

  // Create Activity Logs Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      ticketId TEXT NOT NULL,
      action TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      performedByName TEXT NOT NULL,
      performedByRole TEXT NOT NULL,
      FOREIGN KEY (ticketId) REFERENCES tickets(id) ON DELETE CASCADE
    )
  `);

  // Create Factory Users Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS factory_users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      username TEXT UNIQUE NOT NULL,
      role TEXT CHECK(role IN ('factory_employee', 'factory_it', 'factory_manager')) NOT NULL,
      avatar TEXT NOT NULL,
      passwordHash TEXT NOT NULL,
      needsPasswordReset INTEGER DEFAULT 1,
      department TEXT,
      designation TEXT,
      isDepartmentHead INTEGER DEFAULT 0,
      loginEnabled INTEGER DEFAULT 1,
      default_shift TEXT DEFAULT 'general'
    )
  `);

  try {
    await db.exec('ALTER TABLE factory_users ADD COLUMN default_shift TEXT DEFAULT "general"');
  } catch {
    // Column might already exist, ignore error
  }

  try {
    await db.exec('ALTER TABLE factory_users ADD COLUMN is_active INTEGER DEFAULT 1');
  } catch {
    // Column might already exist, ignore error
  }

  try {
    await db.exec('ALTER TABLE factory_users ADD COLUMN offboarded_at TEXT');
  } catch {
    // Column might already exist, ignore error
  }

  try {
    await db.exec('ALTER TABLE factory_users ADD COLUMN offboarded_by TEXT');
  } catch {
    // Column might already exist, ignore error
  }

  try {
    await db.exec('ALTER TABLE factory_users ADD COLUMN offboard_reason TEXT');
  } catch {
    // Column might already exist, ignore error
  }

  // Create User Shift Overrides Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_shift_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      date TEXT NOT NULL,
      shift TEXT NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(userId, date)
    )
  `);

  // Create indexes for factory_users table to improve query performance
  await db.exec('CREATE INDEX IF NOT EXISTS idx_factory_users_username ON factory_users(username)');
  await db.exec('CREATE INDEX IF NOT EXISTS idx_factory_users_role ON factory_users(role)');
  await db.exec('CREATE INDEX IF NOT EXISTS idx_factory_users_email ON factory_users(email)');

  // Create Factory Attendance Logs Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS factory_attendance_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      userId TEXT NOT NULL,
      ioTime TEXT NOT NULL,
      method TEXT NOT NULL,
      status TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create Attendance Logs Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS attendance_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      userId TEXT NOT NULL,
      ioTime TEXT NOT NULL,
      method TEXT NOT NULL,
      status TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes for attendance tables to improve query performance
  await db.exec('CREATE INDEX IF NOT EXISTS idx_attendance_logs_user_id ON attendance_logs(userId)');
  await db.exec('CREATE INDEX IF NOT EXISTS idx_attendance_logs_user_id_ioTime ON attendance_logs(userId, ioTime)');
  await db.exec('CREATE INDEX IF NOT EXISTS idx_factory_attendance_logs_user_id ON factory_attendance_logs(userId)');
  await db.exec(
    'CREATE INDEX IF NOT EXISTS idx_factory_attendance_logs_user_id_ioTime ON factory_attendance_logs(userId, ioTime)'
  );

  // Create Leave Applications Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS leave_applications (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      userName TEXT NOT NULL,
      category TEXT CHECK(category IN ('annual', 'casual', 'medical')) NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) NOT NULL,
      appliedAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create Site Duty Applications Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS site_duty_applications (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      userName TEXT NOT NULL,
      siteName TEXT NOT NULL,
      reason TEXT NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) NOT NULL,
      appliedAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create Holidays Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS holidays (
      date TEXT PRIMARY KEY,
      name TEXT NOT NULL
    )
  `);

  // Seed initial admin user if table is empty
  const userCount = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM users');
  if (userCount && userCount.count === 0) {
    const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
    if (!adminPassword) throw new Error('ADMIN_INITIAL_PASSWORD required');
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    await db.run(
      'INSERT INTO users (id, name, email, username, role, avatar, passwordHash, needsPasswordReset, isDepartmentHead, loginEnabled) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 1)',
      [
        'usr-1',
        'Default User',
        'it@harisco.com',
        'HC-00001',
        'it',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80',
        passwordHash,
      ]
    );
    logger.info('Seeded initial admin user.');
  }

  // No seed tickets — tickets will be created by users through the application
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized! Call initDb first.');
  }
  return db;
}
