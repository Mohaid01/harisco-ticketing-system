import { getDb } from "../db.ts";
import { sseClients } from "../middleware/sse.ts";
import { logger } from "../utils/logger.ts";

// Shared attendance punch processor for both WebSocket and PT-5000 device routes
const lastProcessedPunchMap = new Map<string, string>();

export async function processAttendancePunch(input: {
  userId: string;
  punchTime: string;
  scanMethod: string;
  attendStat?: string;
  deviceLabel?: string;
}) {
  const {
    userId,
    punchTime,
    scanMethod,
    attendStat = "None",
    deviceLabel = "Device",
  } = input;

  if (userId === "0" || userId === "00000000") {
    logger.security(
      `⚠️ [SECURITY] Dropped a failed/unregistered scan attempt from ${deviceLabel}.`,
    );
    return;
  }

  const lastPunchTime = lastProcessedPunchMap.get(userId);

  if (lastPunchTime === punchTime) {
    return;
  }

  lastProcessedPunchMap.set(userId, punchTime);

  let parsedName = `Employee (ID: ${userId})`;
  let status: string;

  try {
    const db = getDb();
    const paddedId = String(userId).padStart(5, "0");
    const targetUsername = `HC-${paddedId}`;

    const userDoc = await db.get<{ name: string }>(
      "SELECT name FROM users WHERE LOWER(username) = ? OR id = ?",
      [targetUsername.toLowerCase(), userId],
    );
    if (userDoc && userDoc.name) {
      parsedName = userDoc.name;
    }

    const punchDate = punchTime.includes(" ")
      ? punchTime.split(" ")[0]
      : punchTime.includes("T")
        ? punchTime.split("T")[0]
        : punchTime;
    const dayLogsCount = await db.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM attendance_logs WHERE userId = ? AND ioTime LIKE ?",
      [userId, `${punchDate}%`],
    );
    const count = dayLogsCount ? dayLogsCount.count : 0;

    if (count === 0) {
      const punchHourPKT = (() => {
        try {
          const dateStr = punchTime.includes("T")
            ? punchTime
            : punchTime.replace(" ", "T");
          const d = new Date(dateStr + (dateStr.endsWith("Z") ? "" : "+05:00"));
          return d.getHours();
        } catch {
          return 0;
        }
      })();
      status = punchHourPKT >= 18 ? "Ignored" : "Check-In";
    } else if (count === 1) {
      status = "Check-Out";
    } else {
      status = "Ignored";
    }
  } catch (lookupError: unknown) {
    logger.error(
      `⚠️ [DB USER LOOKUP/STATUS ERROR] Falling back to default values from ${deviceLabel}:`,
      lookupError,
    );
    status = attendStat === "DutyOff" ? "Check-Out" : "Check-In";
  }

  try {
    const db = getDb();

    const scanDateStr = punchTime.includes(" ")
      ? punchTime.split(" ")[0]
      : punchTime.includes("T")
        ? punchTime.split("T")[0]
        : punchTime;
    const holiday = await db.get("SELECT name FROM holidays WHERE date = ?", [
      scanDateStr,
    ]);
    if (holiday) {
      logger.info(
        `🏖️ [HOLIDAY] Scan on '${holiday.name}' (${scanDateStr}) — ignored from ${deviceLabel}.`,
      );
      return;
    }

    const insertResult = await db.run(
      "INSERT INTO attendance_logs (name, userId, ioTime, method, status) VALUES (?, ?, ?, ?, ?)",
      [parsedName, userId, punchTime, scanMethod, status],
    );
    logger.info(`[DB] Saved log profile successfully from ${deviceLabel}.`);

    // Broadcast the new log to all connected SSE clients
    try {
      const newLog = await db.get(
        "SELECT * FROM attendance_logs WHERE id = ?",
        insertResult.lastID,
      );
      if (newLog) {
        const message = `data: ${JSON.stringify(newLog)}\n\n`;
        sseClients.broadcast(message);
      }
    } catch (e) {
      logger.error("Failed to broadcast new attendance log", e);
    }
  } catch (err: unknown) {
    logger.error(`❌ [DB] Database Storage Error from ${deviceLabel}:`, err);
  }
}

// Shared factory attendance punch processor for PT-5000 device route
const lastProcessedFactoryPunchMap = new Map<string, string>();

export async function processFactoryAttendancePunch(input: {
  userId: string;
  punchTime: string;
  scanMethod: string;
  attendStat?: string;
  deviceLabel?: string;
}) {
  const {
    userId,
    punchTime,
    scanMethod,
    attendStat = "None",
    deviceLabel = "Device",
  } = input;

  if (userId === "0" || userId === "00000000") {
    logger.security(
      `⚠️ [SECURITY] Dropped a failed/unregistered factory scan attempt from ${deviceLabel}.`,
    );
    return;
  }

  const lastPunchTime = lastProcessedFactoryPunchMap.get(userId);

  if (lastPunchTime === punchTime) {
    return;
  }

  lastProcessedFactoryPunchMap.set(userId, punchTime);

  let parsedName = `Factory Employee (ID: ${userId})`;
  let status: string;

  try {
    const db = getDb();
    const paddedId = String(userId).padStart(5, "0");
    const targetUsername = `HC-${paddedId}`;

    const userDoc = await db.get<{ name: string }>(
      "SELECT name FROM factory_users WHERE LOWER(username) = ? OR id = ?",
      [targetUsername.toLowerCase(), userId],
    );
    if (userDoc && userDoc.name) {
      parsedName = userDoc.name;
    }

    const punchDate = punchTime.includes(" ")
      ? punchTime.split(" ")[0]
      : punchTime.includes("T")
        ? punchTime.split("T")[0]
        : punchTime;
    const dayLogsCount = await db.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM factory_attendance_logs WHERE userId = ? AND ioTime LIKE ?",
      [userId, `${punchDate}%`],
    );
    const count = dayLogsCount ? dayLogsCount.count : 0;

    if (count === 0) {
      const punchHourPKT = (() => {
        try {
          const timePart = punchTime.includes(" ")
            ? punchTime.split(" ")[1]
            : punchTime.includes("T")
              ? punchTime.split("T")[1]
              : "";

          if (!timePart) return 0;

          // Extract the first two characters (the hour) and turn it into an integer
          return parseInt(timePart.split(":")[0], 10);
        } catch {
          return 0;
        }
      })();
      status = punchHourPKT >= 18 ? "Ignored" : "Check-In";
    } else if (count === 1) {
      status = "Check-Out";
    } else {
      status = "Ignored";
    }
  } catch (lookupError: unknown) {
    logger.error(
      `⚠️ [DB FACTORY USER LOOKUP/STATUS ERROR] Falling back to default values from ${deviceLabel}:`,
      lookupError,
    );
    status = attendStat === "DutyOff" ? "Check-Out" : "Check-In";
  }

  try {
    const db = getDb();

    const scanDateStr = punchTime.includes(" ")
      ? punchTime.split(" ")[0]
      : punchTime.includes("T")
        ? punchTime.split("T")[0]
        : punchTime;
    const holiday = await db.get("SELECT name FROM holidays WHERE date = ?", [
      scanDateStr,
    ]);
    if (holiday) {
      logger.info(
        `🏖️ [HOLIDAY] Factory scan on '${holiday.name}' (${scanDateStr}) — ignored from ${deviceLabel}.`,
      );
      return;
    }

    const insertResult = await db.run(
      `INSERT INTO factory_attendance_logs 
      (name, userId, ioTime, method, status, timestamp) 
      VALUES (?, ?, strftime('%Y-%m-%d %H:%M:%S', ?), ?, ?, strftime('%Y-%m-%d %H:%M:%S', ?))`,
      [parsedName, userId, punchTime, scanMethod, status, punchTime],
    );
    logger.info(
      `[DB] Saved factory log profile successfully from ${deviceLabel}.`,
    );

    // Broadcast the new log to all connected SSE clients
    try {
      const newLog = await db.get(
        "SELECT * FROM factory_attendance_logs WHERE id = ?",
        insertResult.lastID,
      );
      if (newLog) {
        const message = `data: ${JSON.stringify(newLog)}\n\n`;
        sseClients.broadcast(message);
      }
    } catch (e) {
      logger.error("Failed to broadcast new factory attendance log", e);
    }
  } catch (err: unknown) {
    logger.error(
      `❌ [DB] Factory Database Storage Error from ${deviceLabel}:`,
      err,
    );
  }
}
