import bcrypt from 'bcryptjs';
import path from 'path';
import sqlite3 from 'sqlite3';

const DB_PATH = process.env.DB_PATH || path.resolve(process.cwd(), 'database.sqlite');

async function main() {
  const db = new sqlite3.Database(DB_PATH);

  const passwordHash = await bcrypt.hash('harisco123', 10);

  // Seed HQ users
  const hqUsers = [
    {
      id: 'usr-1',
      name: 'Mohid Bin Shahid',
      email: 'mohid@harisco.com',
      username: 'HC-00653',
      role: 'it',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80',
      department: 'IT',
      designation: 'IT Administrator',
      isDepartmentHead: 1,
      loginEnabled: 1,
    },
    {
      id: 'usr-2',
      name: 'Ahmed Khan',
      email: 'ahmed@harisco.com',
      username: 'HC-00100',
      role: 'manager',
      avatar: '',
      department: 'Operations',
      designation: 'Operations Manager',
      isDepartmentHead: 1,
      loginEnabled: 1,
    },
    {
      id: 'usr-3',
      name: 'Sara Ali',
      email: 'sara@harisco.com',
      username: 'HC-00101',
      role: 'employee',
      avatar: '',
      department: 'Operations',
      designation: 'HR Executive',
      isDepartmentHead: 0,
      loginEnabled: 1,
    },
    {
      id: 'usr-4',
      name: 'Bilal Hassan',
      email: 'bilal@harisco.com',
      username: 'HC-00102',
      role: 'executive',
      avatar: '',
      department: 'Executive',
      designation: 'CEO',
      isDepartmentHead: 0,
      loginEnabled: 1,
    },
  ];

  for (const user of hqUsers) {
    await new Promise<void>((resolve, reject) => {
      db.run(
        `INSERT OR IGNORE INTO users (id, name, email, username, role, avatar, passwordHash, needsPasswordReset, isDepartmentHead, loginEnabled, department, designation, casualLeaves, annualLeaves, medicalLeaves)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 12, 14, 8)`,
        [
          user.id,
          user.name,
          user.email,
          user.username,
          user.role,
          user.avatar,
          passwordHash,
          user.isDepartmentHead,
          user.loginEnabled,
          user.department,
          user.designation,
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  // Seed factory users (HC-30000 to HC-30004)
  const factoryUsers = [
    {
      id: 'usr-factory-1',
      name: 'Factory Worker 1',
      email: 'factory30000@harisco.local',
      username: 'HC-30000',
      role: 'factory_employee',
      department: 'Factory Floor',
      designation: 'Machine Operator',
    },
    {
      id: 'usr-factory-2',
      name: 'Factory Worker 2',
      email: 'factory30001@harisco.local',
      username: 'HC-30001',
      role: 'factory_employee',
      department: 'Factory Floor',
      designation: 'Worker',
    },
    {
      id: 'usr-factory-3',
      name: 'Factory Supervisor',
      email: 'factory30002@harisco.local',
      username: 'HC-30002',
      role: 'factory_manager',
      department: 'Factory Floor',
      designation: 'Supervisor',
    },
    {
      id: 'usr-factory-4',
      name: 'Factory Tech',
      email: 'factory30003@harisco.local',
      username: 'HC-30003',
      role: 'factory_it',
      department: 'Factory Maintenance',
      designation: 'Technician',
    },
    {
      id: 'usr-factory-5',
      name: 'Factory Guard',
      email: 'factory30004@harisco.local',
      username: 'HC-30004',
      role: 'factory_employee',
      department: 'Factory Security',
      designation: 'Attendant',
    },
  ];

  for (const user of factoryUsers) {
    await new Promise<void>((resolve, reject) => {
      db.run(
        `INSERT OR IGNORE INTO factory_users (id, name, email, username, role, avatar, passwordHash, needsPasswordReset, department, designation, isDepartmentHead, loginEnabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 1)`,
        [
          user.id,
          user.name,
          user.email,
          user.username,
          user.role,
          '',
          passwordHash,
          user.department,
          user.designation,
          user.role === 'factory_manager' ? 1 : 0,
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  // Seed holidays
  const holidays = [
    { date: '2026-01-01', name: "New Year's Day" },
    { date: '2026-03-23', name: 'Pakistan Day' },
    { date: '2026-05-01', name: 'Labour Day' },
    { date: '2026-08-14', name: 'Independence Day' },
    { date: '2026-12-25', name: 'Christmas Day' },
  ];

  for (const holiday of holidays) {
    await new Promise<void>((resolve, reject) => {
      db.run('INSERT OR IGNORE INTO holidays (date, name) VALUES (?, ?)', [holiday.date, holiday.name], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  logger.log('Seed data inserted successfully.');
  logger.log('HQ Users:', hqUsers.length);
  logger.log('Factory Users:', factoryUsers.length);
  logger.log('Holidays:', holidays.length);
  db.close();
}

main().catch((err) => {
  logger.error('Failed to seed data:', err);
  process.exit(1);
});
