import { Router } from "express";
import type {
  AuthRequest,
  ApiAuthRequest,
  ApiResponse,
  CreateSiteDutyRequestBody,
  UpdateSiteDutyStatusRequestBody,
  SiteDutiesResponse,
  CreateSiteDutyResponse,
  UpdateSiteDutyStatusResponse,
} from "../types/index.ts";
import { authenticateToken } from "../middleware/auth.ts";
import { getDb } from "../db.ts";
import { logger } from "../utils/logger.ts";

const router = Router();

// GET /api/site-duties
router.get(
  "/",
  authenticateToken,
  async (req: AuthRequest, res: ApiResponse<SiteDutiesResponse>) => {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    try {
      const db = getDb();
      const currentUser = await db.get(
        "SELECT role, department, isDepartmentHead FROM users WHERE id = ?",
        [userId],
      );
      let query =
        "SELECT * FROM site_duty_applications ORDER BY appliedAt DESC";
      const params: (string | undefined)[] = [];

      if (userRole === "executive" || userRole === "manager") {
        query = `
          SELECT s.*, u.username AS userCode FROM site_duty_applications s
          JOIN users u ON s.userId = u.id
          ORDER BY s.appliedAt DESC
        `;
      } else if (currentUser?.isDepartmentHead) {
        query = `
          SELECT s.*, u.username AS userCode FROM site_duty_applications s
          JOIN users u ON s.userId = u.id
          WHERE s.userId = ? OR u.department = ?
          ORDER BY s.appliedAt DESC
        `;
        params.push(userId, currentUser.department);
      } else {
        query = `
          SELECT s.*, u.username AS userCode FROM site_duty_applications s
          JOIN users u ON s.userId = u.id
          WHERE s.userId = ? 
          ORDER BY s.appliedAt DESC
        `;
        params.push(userId);
      }

      const duties = await db.all(query, params);
      res.json(duties);
    } catch (error) {
      logger.error("Failed to fetch site duties:", error);
      res
        .status(500)
        .json({ error: "Failed to retrieve site duty applications." });
    }
  },
);

// POST /api/site-duties
router.post(
  "/",
  authenticateToken,
  async (
    req: ApiAuthRequest<CreateSiteDutyRequestBody>,
    res: ApiResponse<CreateSiteDutyResponse>,
  ) => {
    const { siteName, reason, startDate, endDate } = req.body;
    if (!siteName || !reason || !startDate || !endDate) {
      res.status(400).json({ error: "All fields are required." });
      return;
    }

    try {
      const db = getDb();

      const existingLeave = await db.get(
        "SELECT id FROM leave_applications WHERE userId = ? AND status = 'approved' AND startDate <= ? AND endDate >= ?",
        [req.user?.id, endDate, startDate],
      );
      if (existingLeave) {
        res.status(400).json({
          error: "Cannot apply for site duty on a date with an approved leave.",
        });
        return;
      }

      const existingDuty = await db.get(
        "SELECT id FROM site_duty_applications WHERE userId = ? AND status = 'approved' AND startDate <= ? AND endDate >= ?",
        [req.user?.id, endDate, startDate],
      );
      if (existingDuty) {
        res.status(400).json({
          error:
            "Cannot apply for site duty on a date with an already approved site duty.",
        });
        return;
      }

      const id = `sd-${Date.now()}`;
      const timestamp = new Date().toISOString();

      await db.run(
        `INSERT INTO site_duty_applications (
              id, userId, userName, siteName, reason, startDate, endDate, status, appliedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          req.user?.id,
          req.user?.name,
          siteName,
          reason,
          startDate,
          endDate,
          "pending",
          timestamp,
        ],
      );

      res.status(201).json({ success: true, id });
    } catch (error) {
      logger.error("Failed to submit site duty:", error);
      res
        .status(500)
        .json({ error: "Failed to submit site duty application." });
    }
  },
);

// PUT /api/site-duties/:id/status
router.put(
  "/:id/status",
  authenticateToken,
  async (
    req: ApiAuthRequest<UpdateSiteDutyStatusRequestBody>,
    res: ApiResponse<UpdateSiteDutyStatusResponse>,
  ) => {
    const db = getDb();
    const sdId = String(req.params.id);
    const duty = await db.get<{ userId: string }>(
      "SELECT userId FROM site_duty_applications WHERE id = ?",
      [sdId],
    );
    if (!duty) {
      res.status(404).json({ error: "Site duty application not found." });
      return;
    }

    const applicant = await db.get<{ department: string | null }>(
      "SELECT department FROM users WHERE id = ?",
      [duty.userId],
    );
    const approver = await db.get<{
      isDepartmentHead: number;
      department: string | null;
    }>("SELECT isDepartmentHead, department FROM users WHERE id = ?", [
      req.user?.id,
    ]);

    if (
      !approver?.isDepartmentHead ||
      approver.department !== applicant?.department
    ) {
      res.status(403).json({
        error:
          "Forbidden. Only the department head can approve this site duty.",
      });
      return;
    }

    const { status } = req.body;
    if (!status || !["approved", "rejected"].includes(status)) {
      res
        .status(400)
        .json({ error: "Valid status (approved/rejected) is required." });
      return;
    }

    try {
      const db = getDb();
      const sdId = String(req.params.id);

      const duty = await db.get(
        "SELECT * FROM site_duty_applications WHERE id = ?",
        [sdId],
      );
      if (!duty) {
        res.status(404).json({ error: "Site duty application not found." });
        return;
      }

      await db.run(
        "UPDATE site_duty_applications SET status = ? WHERE id = ?",
        [status, sdId],
      );

      if (status === "approved") {
        const start = new Date(duty.startDate);
        const end = new Date(duty.endDate);

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dayOfWeek = d.getDay();
          if (dayOfWeek === 0) continue;

          let checkInTime = "09:30:00";
          let checkOutTime = "18:00:00";

          if (dayOfWeek === 6) {
            checkInTime = "10:00:00";
            checkOutTime = "16:00:00";
          }

          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");

          const getUtcTimestamp = (
            y: string,
            m: string,
            d: string,
            timeStr: string,
          ) => {
            const pktDateStr = `${y}-${m}-${d}T${timeStr}+05:00`;
            const pktDate = new Date(pktDateStr);
            const uYear = pktDate.getUTCFullYear();
            const uMonth = String(pktDate.getUTCMonth() + 1).padStart(2, "0");
            const uDay = String(pktDate.getUTCDate()).padStart(2, "0");
            const uHours = String(pktDate.getUTCHours()).padStart(2, "0");
            const uMinutes = String(pktDate.getUTCMinutes()).padStart(2, "0");
            const uSeconds = String(pktDate.getUTCSeconds()).padStart(2, "0");
            return `${uYear}-${uMonth}-${uDay} ${uHours}:${uMinutes}:${uSeconds}`;
          };

          const checkInTimestamp = getUtcTimestamp(
            String(year),
            month,
            day,
            checkInTime,
          );
          const checkOutTimestamp = getUtcTimestamp(
            String(year),
            month,
            day,
            checkOutTime,
          );

          await db.run(
            "INSERT INTO attendance_logs (name, userId, ioTime, method, status, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
            [
              duty.userName,
              duty.userId,
              checkInTimestamp,
              "System",
              "Site Duty",
              checkInTimestamp,
            ],
          );

          await db.run(
            "INSERT INTO attendance_logs (name, userId, ioTime, method, status, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
            [
              duty.userName,
              duty.userId,
              checkOutTimestamp,
              "System",
              "Site Duty",
              checkOutTimestamp,
            ],
          );
        }
      }

      res.json({ success: true });
    } catch (error) {
      logger.error("Failed to update site duty status:", error);
      res.status(500).json({ error: "Failed to update site duty status." });
    }
  },
);

export default router;
