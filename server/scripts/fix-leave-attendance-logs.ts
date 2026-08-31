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

  const allBadRecords = await db.all<{ id: number; userId: string; ioTime: string }[]>(
    "SELECT id, userId, ioTime FROM attendance_logs WHERE method = 'System' AND status = 'On Leave' AND ioTime LIKE 'NaN%' ORDER BY userId ASC, id ASC"
  );

  if (allBadRecords.length === 0) {
    console.log('No bad attendance records found. Nothing to fix.');
    await db.close();
    return;
  }

  const approvedLeaves = await db.all<{
    userId: string;
    startDate: string;
    endDate: string;
  }[]>(
    "SELECT userId, startDate, endDate FROM leave_applications WHERE status = 'approved' ORDER BY userId ASC, appliedAt ASC"
  );

  const leavesByUser = new Map<string, { startDate: string; endDate: string }[]>();
  for (const leave of approvedLeaves) {
    const existing = leavesByUser.get(leave.userId) || [];
    existing.push({ startDate: leave.startDate, endDate: leave.endDate });
    leavesByUser.set(leave.userId, existing);
  }

  const badByUser = new Map<string, { id: number; userId: string; ioTime: string }[]>();
  for (const record of allBadRecords) {
    const existing = badByUser.get(record.userId) || [];
    existing.push(record);
    badByUser.set(record.userId, existing);
  }

  console.log(`Found ${allBadRecords.length} bad records across ${badByUser.size} users.`);
  console.log(`Found approved leaves for ${leavesByUser.size} users.\n`);

  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalUsersProcessed = 0;
  let totalUsersSkipped = 0;

  for (const [userId, badRecords] of badByUser) {
    const userLeaves = leavesByUser.get(userId);

    if (!userLeaves || userLeaves.length === 0) {
      console.warn(`  SKIP user ${userId}: no approved leaves found. Cannot determine correct dates for ${badRecords.length} bad records.`);
      totalSkipped += badRecords.length;
      totalUsersSkipped++;
      continue;
    }

    const expectedPairs: { checkIn: string; checkOut: string }[] = [];

    for (const leave of userLeaves) {
      const start = new Date(leave.startDate + 'T00:00:00');
      const end = new Date(leave.endDate + 'T00:00:00');

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getUTCDay();
        if (dayOfWeek === 0) continue;

        let checkInTime = '09:00:00';
        let checkOutTime = '17:00:00';

        if (dayOfWeek === 6) {
          checkInTime = '10:00:00';
          checkOutTime = '16:00:00';
        }

        const year = d.getUTCFullYear();
        const month = d.getUTCMonth() + 1;
        const day = d.getUTCDate();

        const checkIn = getUtcTimestamp(year, month, day, checkInTime);
        const checkOut = getUtcTimestamp(year, month, day, checkOutTime);

        expectedPairs.push({ checkIn, checkOut });
      }
    }

    if (expectedPairs.length === 0) {
      console.warn(`  SKIP user ${userId}: approved leaves exist but produced no working-day pairs. ${badRecords.length} bad records untouched.`);
      totalSkipped += badRecords.length;
      totalUsersSkipped++;
      continue;
    }

    let userUpdated = 0;
    let userSkipped = 0;
    const userWarnings: string[] = [];

    for (let i = 0; i < badRecords.length; i++) {
      const record = badRecords[i];

      if (record.userId !== userId) {
        userSkipped++;
        userWarnings.push(`record id ${record.id}: userId mismatch (expected ${userId}, got ${record.userId})`);
        continue;
      }

      const pairIndex = Math.floor(i / 2);

      if (pairIndex >= expectedPairs.length) {
        userSkipped++;
        userWarnings.push(`record id ${record.id}: no expected pair (more bad records than leave days for user)`);
        continue;
      }

      const expected = expectedPairs[pairIndex];
      const isCheckIn = i % 2 === 0;

      const expectedTime = isCheckIn ? expected.checkIn : expected.checkOut;

      await db.run('UPDATE attendance_logs SET ioTime = ?, timestamp = ? WHERE id = ?', [
        expectedTime,
        expectedTime,
        record.id,
      ]);

      userUpdated++;
    }

    if (userUpdated > 0) {
      console.log(`  OK user ${userId}: updated ${userUpdated} records.`);
      totalUpdated += userUpdated;
    }

    if (userSkipped > 0) {
      console.warn(`  WARN user ${userId}: skipped ${userSkipped} records:`);
      for (const warning of userWarnings) {
        console.warn(`    - ${warning}`);
      }
      totalSkipped += userSkipped;
    }

    if (userUpdated === 0 && userSkipped === 0 && badRecords.length > 0) {
      console.log(`  OK user ${userId}: ${badRecords.length} bad records already fixed or no action needed.`);
    }

    totalUsersProcessed++;
  }

  console.log(`\nDone.`);
  console.log(`  Users processed: ${totalUsersProcessed}`);
  console.log(`  Users skipped:  ${totalUsersSkipped}`);
  console.log(`  Total records updated: ${totalUpdated}`);
  console.log(`  Total records skipped: ${totalSkipped}`);
  console.log(`  Total bad records:     ${allBadRecords.length}`);

  await db.close();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
