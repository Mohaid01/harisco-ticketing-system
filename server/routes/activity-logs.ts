import { Router } from "express";
import type {
  AuthRequest,
  ActivityLogsResponse,
  ActivityLogWithTicket,
  ApiResponse,
} from "@types";
import { authenticateToken } from "../middleware/auth.ts";
import { getDb } from "../db.ts";

const router = Router();

// GET /api/activity-logs
router.get(
  "/",
  authenticateToken,
  async (req: AuthRequest, res: ApiResponse<ActivityLogsResponse>) => {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    try {
      const db = getDb();

      let logsQuery = `
        SELECT al.*, t.title as ticketTitle
        FROM activity_logs al
        JOIN tickets t ON al.ticketId = t.id
      `;
      const queryParams: (string | undefined)[] = [];

      if (userRole === "employee") {
        logsQuery += " WHERE t.reporterId = ?";
        queryParams.push(userId);
      }

      logsQuery += " ORDER BY al.timestamp DESC";

      const logs = await db.all<ActivityLogWithTicket[]>(
        logsQuery,
        queryParams,
      );
      res.json(logs);
    } catch {
      res.status(500).json({ error: "Failed to retrieve activity logs." });
    }
  },
);

export default router;
