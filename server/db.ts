import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import bcrypt from "bcryptjs";
import path from "path";

import fs from "fs";

let db: Database<sqlite3.Database, sqlite3.Statement>;

export async function initDb() {
  const dbPath =
    process.env.DB_PATH || path.resolve(process.cwd(), "database.sqlite");

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
  await db.exec("PRAGMA journal_mode = WAL");
  await db.exec("PRAGMA busy_timeout = 30000;");

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
          role TEXT CHECK(role IN ('it', 'employee', 'manager', 'executive')) NOT NULL,
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
    const tableSchema = await db.get<{ sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='users'",
    );
    if (tableSchema && !tableSchema.sql.includes("'executive'")) {
      console.log("Migrating users table structure...");
      await db.exec("ALTER TABLE users RENAME TO users_old");

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
        (c: any) => c.name === "isDepartmentHead",
      );
      const hasLoginEnabled = tableInfo.some(
        (c: any) => c.name === "loginEnabled",
      );

      // Dynamic column selection based on what the old table actually possessed
      const selectCols = [
        "id",
        "name",
        "email",
        "username",
        "role",
        "avatar",
        "passwordHash",
        "needsPasswordReset",
        hasDeptHead ? "isDepartmentHead" : "0 AS isDepartmentHead",
        hasLoginEnabled ? "loginEnabled" : "1 AS loginEnabled",
      ].join(", ");

      await db.exec(`
        INSERT INTO users (id, name, email, username, role, avatar, passwordHash, needsPasswordReset, isDepartmentHead, loginEnabled) 
        SELECT ${selectCols} FROM users_old
      `);

      await db.exec("DROP TABLE users_old");
      console.log("Migration completed successfully.");
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
    await db.exec("ALTER TABLE tickets ADD COLUMN quotation REAL");
  } catch {
    // Column might already exist, ignore error
  }

  try {
    await db.exec(
      "ALTER TABLE users ADD COLUMN needsPasswordReset INTEGER DEFAULT 1",
    );
  } catch {
    // Column might already exist, ignore error
  }

  try {
    await db.exec("ALTER TABLE users ADD COLUMN department TEXT");
  } catch {
    // Column might already exist, ignore error
  }

  try {
    await db.exec("ALTER TABLE users ADD COLUMN designation TEXT");
  } catch {
    // Column might already exist, ignore error
  }

  try {
    await db.exec(
      "ALTER TABLE users ADD COLUMN isDepartmentHead INTEGER DEFAULT 0",
    );
  } catch {
    // Column might already exist, ignore error
  }

  try {
    await db.exec(
      "ALTER TABLE users ADD COLUMN loginEnabled INTEGER DEFAULT 1",
    );
  } catch {
    // Column might already exist, ignore error
  }

  try {
    await db.exec(
      "ALTER TABLE users ADD COLUMN casualLeaves INTEGER DEFAULT 12",
    );
  } catch {
    // Column might already exist, ignore error
  }

  try {
    await db.exec(
      "ALTER TABLE users ADD COLUMN annualLeaves INTEGER DEFAULT 14",
    );
  } catch {
    // Column might already exist, ignore error
  }

  try {
    await db.exec(
      "ALTER TABLE users ADD COLUMN medicalLeaves INTEGER DEFAULT 8",
    );
  } catch {
    // Column might already exist, ignore error
  }

  // Create Admin Tickets Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS admin_tickets (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT CHECK(status IN ('awaiting_admin_manager', 'awaiting_materials', 'awaiting_technician', 'awaiting_executive', 'resolved')) NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      reporterId TEXT NOT NULL,
      reporterName TEXT NOT NULL,
      reporterEmail TEXT NOT NULL,
      executiveId TEXT,
      executiveName TEXT
    )
  `);

  // Migrate admin_tickets to add executiveId/executiveName if missing
  try {
    const tableSchema = await db.get<{ sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='admin_tickets'",
    );
    if (tableSchema && !tableSchema.sql.includes("executiveId")) {
      console.log("Migrating admin_tickets table to add executive fields...");
      await db.exec("ALTER TABLE admin_tickets RENAME TO admin_tickets_old");

      await db.exec(`
        CREATE TABLE admin_tickets (
          id TEXT PRIMARY KEY,
          description TEXT NOT NULL,
          category TEXT NOT NULL,
          status TEXT CHECK(status IN ('awaiting_admin_manager', 'awaiting_materials', 'awaiting_technician', 'awaiting_executive', 'resolved')) NOT NULL,
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
        INSERT INTO admin_tickets (id, description, category, status, createdAt, updatedAt, reporterId, reporterName, reporterEmail)
        SELECT id, description, category, status, createdAt, updatedAt, reporterId, reporterName, reporterEmail FROM admin_tickets_old
      `);

      await db.exec("DROP TABLE admin_tickets_old");
      console.log(
        "admin_tickets executive fields migration completed successfully.",
      );
    }
  } catch (err) {
    console.error("admin_tickets migration check failed:", err);
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
    await db.exec(
      "ALTER TABLE admin_tickets ADD COLUMN sequence_num INTEGER DEFAULT 0",
    );
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
      loginEnabled INTEGER DEFAULT 1
    )
  `);

  // Create indexes for factory_users table to improve query performance
  await db.exec(
    "CREATE INDEX IF NOT EXISTS idx_factory_users_username ON factory_users(username)",
  );
  await db.exec(
    "CREATE INDEX IF NOT EXISTS idx_factory_users_role ON factory_users(role)",
  );
  await db.exec(
    "CREATE INDEX IF NOT EXISTS idx_factory_users_email ON factory_users(email)",
  );

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
  await db.exec(
    "CREATE INDEX IF NOT EXISTS idx_attendance_logs_user_id ON attendance_logs(userId)",
  );
  await db.exec(
    "CREATE INDEX IF NOT EXISTS idx_attendance_logs_user_id_ioTime ON attendance_logs(userId, ioTime)",
  );
  await db.exec(
    "CREATE INDEX IF NOT EXISTS idx_factory_attendance_logs_user_id ON factory_attendance_logs(userId)",
  );
  await db.exec(
    "CREATE INDEX IF NOT EXISTS idx_factory_attendance_logs_user_id_ioTime ON factory_attendance_logs(userId, ioTime)",
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
  const userCount = await db.get<{ count: number }>(
    "SELECT COUNT(*) as count FROM users",
  );
  if (userCount && userCount.count === 0) {
    const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
    if (!adminPassword) throw new Error("ADMIN_INITIAL_PASSWORD required");
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    await db.run(
      "INSERT INTO users (id, name, email, username, role, avatar, passwordHash, needsPasswordReset, isDepartmentHead, loginEnabled) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 1)",
      [
        "usr-1",
        "Mohid Bin Shahid",
        "mohid@harisco.com",
        "HC-00653",
        "it",
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80",
        passwordHash,
      ],
    );
    console.log("Seeded initial admin user.");
  }

  // No seed tickets — tickets will be created by users through the application
}

export function getDb() {
  if (!db) {
    throw new Error("Database not initialized! Call initDb first.");
  }
  return db;
}
