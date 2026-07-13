import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import bcrypt from 'bcryptjs';
import path from 'path';

import fs from 'fs';

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
    driver: sqlite3.Database
  });

  // Create Users Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      username TEXT UNIQUE NOT NULL,
      role TEXT CHECK(role IN ('it', 'employee', 'manager')) NOT NULL,
      avatar TEXT NOT NULL,
      passwordHash TEXT NOT NULL,
      needsPasswordReset INTEGER DEFAULT 1,
      isDepartmentHead INTEGER DEFAULT 0,
      loginEnabled INTEGER DEFAULT 1
    )
  `);

  // Migrate existing users table if email is NOT NULL
  try {
    const tableInfo = await db.all<{ name: string; notnull: number }[]>(
      "PRAGMA table_info(users)",
    );
    const emailCol = tableInfo.find((c: any) => c.name === "email");
    if (emailCol && emailCol.notnull === 1) {
      console.log("Migrating users table to allow nullable email...");
      await db.exec("ALTER TABLE users RENAME TO users_old");
      await db.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          username TEXT UNIQUE NOT NULL,
          role TEXT CHECK(role IN ('it', 'employee', 'manager')) NOT NULL,
          avatar TEXT NOT NULL,
          passwordHash TEXT NOT NULL,
          needsPasswordReset INTEGER DEFAULT 1
        )
      `);
      await db.exec(
        "INSERT INTO users SELECT id, name, email, username, role, avatar, passwordHash, needsPasswordReset FROM users_old",
      );
      await db.exec("DROP TABLE users_old");
      console.log("Migration completed.");
    }
  } catch (err) {
    console.error("Migration check failed:", err);
  }

  // Create Tickets Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      type TEXT CHECK(type IN ('hardware', 'software', 'maintenance', 'upgrade')) NOT NULL,
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
    if (!adminPassword) throw new Error("ADMIN_INITIAL_PASSWORD required");
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    await db.run(
      'INSERT INTO users (id, name, email, username, role, avatar, passwordHash, needsPasswordReset, isDepartmentHead, loginEnabled) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 1)',
      [
        'usr-1',
        'Mohid Bin Shahid',
        'mohid@harisco.com',
        'HC-00653',
        'it',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80',
        passwordHash,
      ]
    );
    console.log('Seeded initial admin user.');
  }

  // No seed tickets — tickets will be created by users through the application
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized! Call initDb first.');
  }
  return db;
}
