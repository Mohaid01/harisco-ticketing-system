import { Router } from "express";
import type {
  AuthRequest,
  ApiAuthRequest,
  ApiResponse,
  CreateHolidayRequestBody,
  HolidaysResponse,
  CreateHolidayResponse,
  DeleteHolidayResponse,
} from "../types/index.ts";
import { authenticateToken } from "../middleware/auth.ts";
import { getDb } from "../db.ts";

const router = Router();

// GET /api/holidays
router.get(
  "/",
  authenticateToken,
  async (req: AuthRequest, res: ApiResponse<HolidaysResponse>) => {
    try {
      const db = getDb();
      const holidays = await db.all("SELECT * FROM holidays ORDER BY date ASC");
      res.json(holidays);
    } catch {
      res.status(500).json({ error: "Failed to fetch holidays." });
    }
  },
);

// POST /api/holidays
router.post(
  "/",
  authenticateToken,
  async (
    req: ApiAuthRequest<CreateHolidayRequestBody>,
    res: ApiResponse<CreateHolidayResponse>,
  ) => {
    if (req.user?.role !== "it" && req.user?.role !== "manager") {
      res.status(403).json({ error: "Forbidden." });
      return;
    }
    const { date, name } = req.body;
    if (!date || !name) {
      res.status(400).json({ error: "date and name are required." });
      return;
    }
    try {
      const db = getDb();
      await db.run(
        "INSERT OR REPLACE INTO holidays (date, name) VALUES (?, ?)",
        [date, name],
      );
      res.status(201).json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to add holiday." });
    }
  },
);

// DELETE /api/holidays/:date
router.delete(
  "/:date",
  authenticateToken,
  async (req: AuthRequest, res: ApiResponse<DeleteHolidayResponse>) => {
    if (req.user?.role !== "it" && req.user?.role !== "manager") {
      res.status(403).json({ error: "Forbidden." });
      return;
    }
    try {
      const db = getDb();
      await db.run("DELETE FROM holidays WHERE date = ?", [req.params.date]);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete holiday." });
    }
  },
);

export default router;
