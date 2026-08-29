import path from 'path';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';

const DB_PATH = process.env.DB_PATH || path.resolve(process.cwd(), 'database.sqlite');

function getUtcTimestamp(y: number, m: number, d: number, timeStr: string): string {
  const month = String(m).padStart(2, '0');
  const day = String(d).padStart(2, '0');
  const pktDateStr = `${y}-${month}-${day}T${timeStr}+05:00`;
  const pktDate = new Date(pktDateStr);
  const uYear = pktDate.getUTCFullYear();
  const uMonth = String(pktDate.getUTCMonth() + 1).padStart(2, '0');
  const uDay = String(pktDate.getUTCDate()).padStart(2, '0');
  const uHours = String(pktDate.getUTCHours()).padStart(2, '0');
  const uMinutes = String(pktDate.getUTCMinutes()).padStart(2, '0');
  const uSeconds = String(pktDate.getUTCSeconds()).padStart(2, '0');
  return `${uYear}-${uMonth}-${uDay} ${uHours}:${uMinutes}:${uSeconds}`;
}

async function main() {
  const db = await open({ filename: DB_PATH, driver: sqlite3.Database });

  const leaves = await db.all<{
    userId: string;
    userName: string;
    startDate: string;
    endDate: string;
  }>(
    "SELECT id, userId, userName, startDate, endDate FROM leave_applications WHERE status = 'approved' ORDER BY appliedAt ASC"
  );

  if (leaves.length === 0) {
    console.log('No approved leaves found. Nothing to fix.');
    await db.close();
    return;
  }

  const badRecords = await db.all<{ id: number; userId: string }>(
    "SELECT id, userId FROM attendance_logs WHERE method = 'System' AND status = 'On Leave' AND ioTime LIKE 'NaN%' ORDER BY id ASC"
  );

  if (badRecords.length === 0) {
    console.log('No bad attendance records found. Nothing to fix.');
    await db.close();
    return;
  }

  console.log(`Found ${leaves.length} approved leaves and ${badRecords.length} bad attendance records.`);

  const expectedPairs: { userId: string; checkIn: string; checkOut: string }[] = [];

  for (const leave of leaves) {
    const start = new Date(leave.startDate + 'T00:00:00');
    const end = new Date(leave.endDate + 'T00:00:00');

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      if (dayOfWeek === 0) continue;

      let checkInTime = '09:30:00';
      let checkOutTime = '18:00:00';

      if (dayOfWeek === 6) {
        checkInTime = '10:00:00';
        checkOutTime = '16:00:00';
      }

      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const day = d.getDate();

      const checkIn = getUtcTimestamp(year, month, day, checkInTime);
      const checkOut = getUtcTimestamp(year, month, day, checkOutTime);

      expectedPairs.push({ userId: leave.userId, checkIn, checkOut });
    }
  }

  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < expectedPairs.length; i++) {
    const pair = expectedPairs[i];
    const checkInRecord = badRecords[i * 2];
    const checkOutRecord = badRecords[i * 2 + 1];

    if (!checkInRecord || !checkOutRecord) {
      skipped++;
      continue;
    }

    if (checkInRecord.userId !== pair.userId || checkOutRecord.userId !== pair.userId) {
      skipped++;
      continue;
    }

    await db.run('UPDATE attendance_logs SET ioTime = ?, timestamp = ? WHERE id = ?', [
      pair.checkIn,
      pair.checkIn,
      checkInRecord.id,
    ]);

    await db.run('UPDATE attendance_logs SET ioTime = ?, timestamp = ? WHERE id = ?', [
      pair.checkOut,
      pair.checkOut,
      checkOutRecord.id,
    ]);

    updated += 2;
  }

  console.log(`Updated ${updated} records. Skipped ${skipped} pairs (userId mismatch or insufficient records).`);
  await db.close();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
