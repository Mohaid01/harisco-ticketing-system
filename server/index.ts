import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import { initDb } from "./db.js";
import { WebSocketServer } from "ws";
import activityLogsRouter from "./routes/activity-logs.ts";
import adminTicketsRouter from "./routes/admin-tickets.ts";
import attendanceRouter from "./routes/attendance.ts";
import authRouter from "./routes/auth.ts";
import factoryRouter from "./routes/factory.ts";
import healthRouter from "./routes/health.ts";
import holidaysRouter from "./routes/holidays.ts";
import leavesRouter from "./routes/leaves.ts";
import noticesRouter from "./routes/notices.ts";
import siteDutiesRouter from "./routes/site-duties.ts";
import ticketsRouter from "./routes/tickets.ts";
import usersRouter from "./routes/users.ts";

const app = express();

// Request ID middleware for correlation
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId =
    req.headers["x-request-id"]?.toString() ||
    `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  (req as RequestWithId).requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
});

// Performance timing middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - start;
    if (durationMs > 1000) {
      logger.warn("Slow request", {
        path: req.path,
        method: req.method,
        durationMs,
        statusCode: res.statusCode,
      });
    }
  });
  next();
});

// Global crash handlers — log the exact error before process exits
process.on("uncaughtException", (err) => {
  logger.error("[FATAL] uncaughtException:", err);
});
process.on("unhandledRejection", (reason) => {
  logger.error("[FATAL] unhandledRejection:", reason);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Security Headers (CSP disabled to allow Vite inline scripts/styles)
app.use(helmet({ contentSecurityPolicy: false }));

// Required: trust Cloudflare Tunnel proxy so express-rate-limit reads X-Forwarded-For correctly
app.set("trust proxy", true);

// Strict CORS: allow Vite dev server locally, but restrict in production
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production" ? false : "http://localhost:5173",
  }),
);

app.use(express.json({ limit: "10mb" }));

// Loose global tracker applied to every endpoint under /api
app.use("/api", globalLimiter);

import { sseClients } from "./middleware/sse.ts";
import {
  processAttendancePunch,
  processFactoryAttendancePunch,
} from "./services/punch-processors.ts";
import { globalLimiter, PORT, writeLimiter } from "./constants.ts";
import { logger } from "./utils/logger.ts";
import { RequestWithId } from "@types";

// High-performance centralized wrapper for write operations
app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  switch (req.method) {
    case "POST":
    case "PUT":
    case "DELETE":
    case "PATCH":
      return writeLimiter(req, res, next);
    default:
      next(); // Instant bypass for GET requests with zero allocation overhead
  }
});

app.use("/api/activity-logs", activityLogsRouter);
app.use("/api/admin-tickets", adminTicketsRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/auth", authRouter);
app.use("/api/factory", factoryRouter);
app.use("/api/health", healthRouter);
app.use("/api/holidays", holidaysRouter);
app.use("/api/leaves", leavesRouter);
app.use("/api/notices", noticesRouter);
app.use("/api/site-duties", siteDutiesRouter);
app.use("/api/tickets", ticketsRouter);
app.use("/api/users", usersRouter);

// PT-5000 HTTP Device Route
app.post("/", async (req, res) => {
  const requestCode = req.headers["request_code"] as string;
  const devId = (req.headers["dev_id"] as string) || "UNKNOWN";
  const transId = (req.headers["trans_id"] as string) || "ReceiveCommandAction";

  // 1. Read raw stream into a Buffer
  const buffers: Buffer[] = [];
  for await (const chunk of req) {
    buffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const rawBuffer = Buffer.concat(buffers);
  const rawString = rawBuffer.toString("utf8");

  // 2. Extract clean JSON by locating the first '{' and last '}'
  let payload: Record<string, unknown> = {};
  try {
    const jsonStart = rawString.indexOf("{");
    const jsonEnd = rawString.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      payload = JSON.parse(rawString.substring(jsonStart, jsonEnd + 1));
    }
  } catch (err: unknown) {
    logger.error("❌ Failed to parse device payload JSON:", err);
  }

  // 3. Handle Heartbeat
  if (requestCode === "receive_cmd") {
    logger.info(`💓 [HEARTBEAT] Factory Attendance Device is Online.)`);
  }

  // 4. Handle Attendance Punch
  if (requestCode === "realtime_glog" || payload.user_id) {
    const userId = payload.user_id as string;
    const rawTime = payload.io_time as string; // e.g., "20000328104051"
    const verifyMode = payload.verify_mode as string;

    // Format timestamp: "20000328104051" -> "2000-03-28 10:40:51"
    let formattedTime: string;

    if (rawTime && rawTime.length >= 14) {
      formattedTime = `${rawTime.substring(0, 4)}-${rawTime.substring(4, 6)}-${rawTime.substring(6, 8)} ${rawTime.substring(8, 10)}:${rawTime.substring(10, 12)}:${rawTime.substring(12, 14)}`;
    } else {
      const options = { timeZone: "UTC", hour12: false };
      const d = new Date();
      const datePart = d.toLocaleDateString("en-CA", options); // outputs YYYY-MM-DD
      const timePart = d.toLocaleTimeString("en-GB", options); // outputs HH:mm:ss
      formattedTime = `${datePart} ${timePart}`;
    }

    const scanMethod = String(verifyMode ?? "Unknown");

    if (userId) {
      await processFactoryAttendancePunch({
        userId: String(userId),
        punchTime: formattedTime,
        scanMethod,
        deviceLabel: `PT-5000 Factory ${devId}`,
      });
    }
  }

  // Always acknowledge the device with required headers
  res.setHeader("response_code", "OK");
  res.setHeader("trans_id", transId);
  return res.status(200).send("OK");
});

// Start Database and Server
// Serve static frontend files in production
app.use(express.static(path.join(__dirname, "../dist")));

// Fallback all non-API routes to index.html (SPA routing)
app.get(/.*/, (_, res) => {
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});

async function startServer() {
  try {
    await initDb();
    const server = app.listen(PORT as number, "0.0.0.0", () => {
      logger.info(`Backend server is running on http://localhost:${PORT}`);
    });

    process.on("SIGINT", () => {
      logger.info("Shutting down gracefully...");
      sseClients.stop();
      server.close(() => process.exit(0));
    });

    // Integrated WebSocket Server for the biometric attendance device (Pioneer XML Bridge)
    const wss = new WebSocketServer({ noServer: true });

    server.on("upgrade", (request, socket, head) => {
      // Handle websocket upgrade
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    });

    const METHOD_MAP: Record<string, string> = {
      FP: "Fingerprint",
      FACE: "Face",
      CD: "Card",
      CARD: "Card",
      PWD: "Password",
    };

    wss.on("connection", (ws, req) => {
      logger.info(
        `📡 [DEVICE CONNECTED] Connection open from IP: ${req.socket.remoteAddress}`,
      );

      logger.info("Device connected", {
        ip: req.socket.remoteAddress,
        firmware:
          (ws as any).upgrade?.request?.headers?.["x-device-firmware"] ||
          "unknown",
      });
      ws.on("message", async (message) => {
        const rawString = message.toString("utf8").trim();

        const serialNoMatch = rawString.match(
          /<DeviceSerialNo>(.*?)<\/DeviceSerialNo>/,
        );
        const serialNo = serialNoMatch ? serialNoMatch[1] : "RSS20230560326";

        // 1. HANDSHAKE STEP 1: Registration
        if (rawString.includes("<Request>Register</Request>")) {
          const xmlResponse = `<?xml version="1.0"?>\r\n<Message>\r\n<Response>Register</Response>\r\n<Result>OK</Result>\r\n<DeviceSerialNo>${serialNo}</DeviceSerialNo>\r\n</Message>`;
          return ws.send(xmlResponse);
        }

        // 2. HANDSHAKE STEP 2: Login
        if (rawString.includes("<Request>Login</Request>")) {
          const sessionToken = `TOKEN_${Date.now()}`;
          const xmlLoginResponse = `<?xml version="1.0"?>\r\n<Message>\r\n<Response>Login</Response>\r\n<Result>OK</Result>\r\n<DeviceSerialNo>${serialNo}</DeviceSerialNo>\r\n<Token>${sessionToken}</Token>\r\n</Message>`;
          return ws.send(xmlLoginResponse);
        }

        // 3. MANAGEMENT LOG HOOK (OpLog_v2)
        if (rawString.includes("OpLog_v2")) {
          try {
            const transId =
              rawString.match(/<TransID>(.*?)<\/TransID>/)?.[1] || "0";
            const logId = rawString.match(/<LogID>(.*?)<\/LogID>/)?.[1] || "0";
            const xmlOpResponse = `<?xml version="1.0"?>\r\n<Message>\r\n<Response>OpLog_v2</Response>\r\n<Result>OK</Result>\r\n<DeviceSerialNo>${serialNo}</DeviceSerialNo>\r\n<TransID>${transId}</TransID>\r\n<LogID>${logId}</LogID>\r\n</Message>`;
            ws.send(xmlOpResponse);
          } catch (err: unknown) {
            logger.error("❌ [ERROR] Processing Management Log:", err);
          }
          return;
        }
        // 4. LIVE ATTENDANCE PUNCH CAPTURE (TimeLog_v2 Event Core)
        if (rawString.includes("TimeLog_v2")) {
          try {
            const userId = rawString.match(/<UserID>(.*?)<\/UserID>/)?.[1];
            const punchTime = rawString.match(/<Time>(.*?)<\/Time>/)?.[1];
            const actionRaw =
              rawString.match(/<Action>(.*?)<\/Action>/)?.[1] || "FACE";
            const attendStat =
              rawString.match(/<AttendStat>(.*?)<\/AttendStat>/)?.[1] || "None";
            const transId =
              rawString.match(/<TransID>(.*?)<\/TransID>/)?.[1] || "0";
            const logId = rawString.match(/<LogID>(.*?)<\/LogID>/)?.[1] || "0";

            if (userId && punchTime) {
              const xmlLogResponse = `<?xml version="1.0"?>\r\n<Message>\r\n<Response>TimeLog_v2</Response>\r\n<Result>OK</Result>\r\n<DeviceSerialNo>${serialNo}</DeviceSerialNo>\r\n<TransID>${transId}</TransID>\r\n<LogID>${logId}</LogID>\r\n</Message>`;
              ws.send(xmlLogResponse);

              const scanMethod =
                METHOD_MAP[actionRaw.toUpperCase()] || actionRaw;

              await processAttendancePunch({
                userId,
                punchTime,
                scanMethod,
                attendStat,
                deviceLabel: `WebSocket (${serialNo})`,
              });
            }
          } catch (err: unknown) {
            logger.error("❌ [ERROR] Parsing XML Data Block:", err);
          }
          return;
        }

        // 5. HEARTBEAT MANAGER
        if (
          rawString.includes("<Request>Heartbeat</Request>") ||
          rawString.includes("Heartbeat")
        ) {
          logger.info("💓 [SOCKET HEARTBEAT] HQ Attendance Device is online.");
          const xmlHeartbeatResponse = `<?xml version="1.0"?>\r\n<Message>\r\n<Response>Heartbeat</Response>\r\n<Result>OK</Result>\r\n</Message>`;
          return ws.send(xmlHeartbeatResponse);
        }
      });

      ws.on("close", () =>
        logger.info("🔌 [DEVICE DISCONNECTED] Channel closed."),
      );
    });
  } catch (err) {
    logger.error("Failed to start database/server:", err);
    process.exit(1);
  }
}

startServer();
