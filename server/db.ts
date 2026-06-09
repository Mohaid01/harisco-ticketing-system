import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import bcrypt from 'bcryptjs';
import path from 'path';

let db: Database<sqlite3.Database, sqlite3.Statement>;

export async function initDb() {
  const dbPath = path.resolve(process.cwd(), 'database.sqlite');
  
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Create Users Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      role TEXT CHECK(role IN ('it', 'employee', 'manager')) NOT NULL,
      avatar TEXT NOT NULL,
      passwordHash TEXT NOT NULL
    )
  `);

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
      assigneeName TEXT
    )
  `);

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

  // Seed initial admin user if table is empty
  const userCount = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM users');
  if (userCount && userCount.count === 0) {
    const adminPassword = 'HarisCo@95#';
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    await db.run(
      'INSERT INTO users (id, name, email, username, role, avatar, passwordHash) VALUES (?, ?, ?, ?, ?, ?, ?)',
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
