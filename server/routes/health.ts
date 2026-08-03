import { Router } from "express";
import type { Request } from "express";
import type { ApiResponse, HealthResponse } from "../types/index.ts";
import { getDb } from "../db.ts";
import { logger } from "../utils/logger.ts";

const router = Router();

// GET /api/health
router.get("/", async (req: Request, res: ApiResponse<HealthResponse>) => {
  try {
    const db = getDb();
    await db.get("SELECT 1;");

    const healthStatus: HealthResponse = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(process.uptime())}s`,
      memoryUsage: {
        rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      },
    };

    res.status(200).json(healthStatus);
  } catch (error) {
    logger.error("⚠️ [HEALTH CHECK FAILED]:", error);

    const errorResponse: HealthResponse = {
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: (error as Error)?.message || "Database connection dropped.",
    };

    res.status(503).json(errorResponse);
  }
});

export default router;
