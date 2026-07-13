import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";
import { initDb, getDb } from "./db.js";
import { sendEmail } from "./email.js";
import { WebSocketServer } from "ws";

const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) throw new Error("JWT_SECRET is required");
const PORT = process.env.PORT || 8082;

// Global crash handlers — log the exact error before process exits
process.on("uncaughtException", (err) => {
  console.error("[FATAL] uncaughtException:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] unhandledRejection:", reason);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security Headers (CSP disabled to allow Vite inline scripts/styles)
app.use(helmet({ contentSecurityPolicy: false }));

// Required: trust Cloudflare Tunnel proxy so express-rate-limit reads X-Forwarded-For correctly
app.set("trust proxy", 1);

// Strict CORS: allow Vite dev server locally, but restrict in production
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production" ? false : "http://localhost:5173",
  }),
);

app.use(express.json({ limit: "10mb" }));

// Strict rate limit for login endpoint (IP-based, since no user identity yet)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    error: "Too many login attempts, please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// User-identity-keyed rate limiter for all other API routes.
// Falls back to IP if no Authorization token is present.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  keyGenerator: (req: Request): string => {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) {
      // Use the raw token as the key — unique per user session
      return auth.slice(7);
    }
    return req.ip ?? "unknown";
  },
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", globalLimiter);

// Log every API request for diagnostics
app.use("/api", (req: Request, _res: Response, next: NextFunction) => {
  console.log(
    `[REQ] ${req.method} ${req.path} | ip=${req.ip} | origin=${req.headers.origin || "none"}`,
  );
  next();
});
// Extend express Request interface for our middleware
interface AuthRequest extends Request {
  user?: {
    id: string;
    name: string;
    email: string;
    role: "it" | "employee" | "manager";
    avatar?: string;
    needsPasswordReset?: number;
  };
}

interface DbUser {
  id: string;
  name: string;
  email: string;
  username: string;
  role: "it" | "employee" | "manager";
  avatar: string;
  passwordHash: string;
  needsPasswordReset: number;
  isDepartmentHead: number;
  loginEnabled: number;
}

interface DbTicket {
  id: string;
  title: string;
  description: string;
  type: "hardware" | "software" | "maintenance" | "upgrade";
  status: string;
  justification: string;
  createdAt: string;
  updatedAt: string;
  reporterId: string;
  reporterName: string;
  reporterEmail: string;
  assigneeId: string | null;
  assigneeName: string | null;
  quotation: number | null;
}

interface DbComment {
  id: string;
  ticketId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  avatar: string;
  content: string;
  createdAt: string;
}

interface DbActivityLog {
  id: string;
  ticketId: string;
  action: string;
  timestamp: string;
  performedByName: string;
  performedByRole: string;
}

// Authentication Middleware
function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  console.log("[AUTH] authenticateToken called for:", req.path);
  const authHeader = req.headers["authorization"];
  const token =
    (authHeader && authHeader.split(" ")[1]) || (req.query.token as string);

  if (!token) {
    console.log("[AUTH] No token found — returning 401");
    res.status(401).json({ error: "Authentication token required." });
    return;
  }

  console.log("[AUTH] Token found, verifying with jwt.verify...");
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err || !decoded || typeof decoded !== "object") {
      console.error("[AUTH] jwt.verify failed:", err?.message);
      res.status(403).json({ error: "Invalid or expired token." });
      return;
    }
    console.log("[AUTH] Token valid, user id:", (decoded as any).id);
    req.user = decoded as {
      id: string;
      name: string;
      email: string;
      role: "it" | "employee" | "manager";
      avatar: string;
      needsPasswordReset?: number;
    };
    next();
  });
}

// Auth Routes
app.post(
  "/api/auth/login",
  loginLimiter,
  async (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required." });
      return;
    }

    try {
      const db = getDb();
      const user = await db.get<DbUser>(
        "SELECT id, name, email, username, role, avatar, passwordHash, needsPasswordReset, department, designation, isDepartmentHead, loginEnabled, casualLeaves, annualLeaves, medicalLeaves FROM users WHERE LOWER(username) = ?",
        [username.toLowerCase().trim()],
      );

      if (!user) {
        res.status(401).json({ error: "Invalid username or password." });
        return;
      }

      if (!user.loginEnabled) {
        res.status(403).json({ error: "Your account has been disabled. Please contact IT." });
        return;
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        res.status(401).json({ error: "Invalid username or password." });
        return;
      }

      // Sign JWT — keep payload small, never include avatar (base64 images bloat headers)
      const jwtPayload = {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        needsPasswordReset: user.needsPasswordReset,
      };
      const token = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: "7d" });

      res.json({
        token,
        user: {
          ...jwtPayload,
          avatar: user.avatar,
          department: user.department,
          designation: user.designation,
          isDepartmentHead: user.isDepartmentHead,
          loginEnabled: user.loginEnabled,
          casualLeaves: user.casualLeaves,
          annualLeaves: user.annualLeaves,
          medicalLeaves: user.medicalLeaves,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Database or server error during login." });
    }
  },
);

app.get(
  "/api/auth/me",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    console.log("[ME] Handler reached, querying DB for user id:", req.user?.id);
    try {
      const db = getDb();
      console.log("[ME] DB instance obtained");
      const user = await db.get<DbUser>(
        "SELECT id, name, email, username, role, avatar, needsPasswordReset, department, designation, isDepartmentHead, loginEnabled, casualLeaves, annualLeaves, medicalLeaves FROM users WHERE id = ?",
        [req.user?.id],
      );
      console.log("[ME] DB query done, user found:", !!user);
      if (!user) {
        res.status(404).json({ error: "User not found." });
        return;
      }
      res.json({ user });
      console.log("[ME] Response sent successfully");
    } catch (err) {
      console.error("[ME] Error in /api/auth/me handler:", err);
      res.status(500).json({ error: "Failed to fetch current user." });
    }
  },
);

app.post(
  "/api/auth/reset-password",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const { password } = req.body;
    if (!password || password.trim().length < 4) {
      res
        .status(400)
        .json({ error: "Password must be at least 4 characters long." });
      return;
    }

    try {
      const db = getDb();
      const passwordHash = await bcrypt.hash(password, 10);
      const userId = req.user?.id;

      await db.run(
        "UPDATE users SET passwordHash = ?, needsPasswordReset = 0 WHERE id = ?",
        [passwordHash, userId],
      );

      // Fetch updated user to sign a new token
      const user = await db.get<DbUser>(
        "SELECT id, name, email, username, role, avatar, needsPasswordReset FROM users WHERE id = ?",
        [userId],
      );
      if (!user) {
        res.status(404).json({ error: "User not found." });
        return;
      }

      const payload = {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        avatar: user.avatar,
        needsPasswordReset: user.needsPasswordReset,
      };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });

      res.json({
        token,
        user: payload,
      });
    } catch {
      res.status(500).json({ error: "Failed to reset password." });
    }
  },
);

app.post(
  "/api/auth/change-password",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword || newPassword.trim().length < 4) {
      res
        .status(400)
        .json({ error: "New password must be at least 4 characters long." });
      return;
    }

    try {
      const db = getDb();
      const userId = req.user?.id;

      // Fetch user to compare old password
      const user = await db.get<DbUser>(
        "SELECT passwordHash FROM users WHERE id = ?",
        [userId],
      );
      if (!user) {
        res.status(404).json({ error: "User not found." });
        return;
      }

      const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
      if (!isMatch) {
        res.status(400).json({ error: "Incorrect old password." });
        return;
      }

      const newPasswordHash = await bcrypt.hash(newPassword, 10);
      await db.run(
        "UPDATE users SET passwordHash = ?, needsPasswordReset = 0 WHERE id = ?",
        [newPasswordHash, userId],
      );

      res.json({ message: "Password updated successfully." });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ error: "Failed to update password." });
    }
  },
);

// Users Routes (IT Administrator only for POST/DELETE, all authenticated users for GET)
app.get(
  "/api/users",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const db = getDb();
      const users = await db.all(
        "SELECT id, name, email, username, role, avatar, department, designation, isDepartmentHead, loginEnabled, casualLeaves, annualLeaves, medicalLeaves FROM users ORDER BY username ASC",
      );
      res.json(users);
    } catch {
      res.status(500).json({ error: "Failed to fetch users." });
    }
  },
);

app.post(
  "/api/users",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    if (req.user?.role !== "it") {
      res
        .status(430)
        .json({ error: "Forbidden. User administration requires IT role." });
      return;
    }

    const {
      name,
      email,
      username,
      role,
      password,
      avatar,
      department,
      designation,
      isDepartmentHead,
      loginEnabled,
    } = req.body;
    if (!name || !username || !role) {
      res.status(400).json({ error: "Name, username, and role are required." });
      return;
    }

    const finalEmail =
      email && email.trim() ? email.trim().toLowerCase() : null;
    const defaultPassword = process.env.VITE_DEFAULT_USER_PASSWORD;
    if (!defaultPassword) throw new Error("DEFAULT_USER_PASSWORD required");
    const clearPassword = password || defaultPassword;

    try {
      const db = getDb();

      // Check if email already exists (only if provided)
      if (finalEmail) {
        const existingEmail = await db.get(
          "SELECT id FROM users WHERE email = ?",
          [finalEmail],
        );
        if (existingEmail) {
          res
            .status(400)
            .json({ error: "User with this email already exists." });
          return;
        }
      }

      // Check if username already exists
      const existingUsername = await db.get(
        "SELECT id FROM users WHERE username = ?",
        [username.toLowerCase().trim()],
      );
      if (existingUsername) {
        res
          .status(400)
          .json({ error: "User with this username already exists." });
        return;
      }

      const passwordHash = await bcrypt.hash(clearPassword, 10);
      const userId = `usr-${Date.now()}`;

      await db.run(
        "INSERT INTO users (id, name, email, username, role, avatar, passwordHash, needsPasswordReset, department, designation, isDepartmentHead, loginEnabled) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)",
        [
          userId,
          name,
          finalEmail,
          username.toLowerCase().trim(),
          role,
          avatar ? avatar.trim() : "",
          passwordHash,
          department ? department.trim() : null,
          designation ? designation.trim() : null,
          isDepartmentHead ? 1 : 0,
          loginEnabled === false ? 0 : 1,
        ],
      );

      res.status(201).json({
        id: userId,
        name,
        email: finalEmail,
        username: username.toLowerCase().trim(),
        role,
        avatar: avatar ? avatar.trim() : "",
        department: department ? department.trim() : null,
        designation: designation ? designation.trim() : null,
        isDepartmentHead: isDepartmentHead ? 1 : 0,
        loginEnabled: loginEnabled === false ? 0 : 1,
      });
    } catch (error) {
      console.error("Failed to create user:", error);
      res.status(500).json({ error: "Failed to register new user." });
    }
  },
);

app.delete(
  "/api/users/:id",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    if (req.user?.role !== "it") {
      res
        .status(403)
        .json({ error: "Forbidden. User deletion requires IT role." });
      return;
    }

    const userId = req.params.id;
    if (userId === req.user?.id) {
      res
        .status(400)
        .json({ error: "Cannot delete your own logged-in account." });
      return;
    }

    try {
      const db = getDb();
      const result = await db.run("DELETE FROM users WHERE id = ?", [userId]);

      if (result.changes === 0) {
        res.status(404).json({ error: "User not found." });
        return;
      }

      res.json({ message: "User deleted successfully." });
    } catch {
      res.status(500).json({ error: "Failed to delete user." });
    }
  },
);

app.post(
  "/api/users/:id/reset-password",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    if (req.user?.role !== "it") {
      res
        .status(403)
        .json({ error: "Forbidden. Password reset requires IT role." });
      return;
    }

    const userId = req.params.id;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.trim().length < 4) {
      res
        .status(400)
        .json({ error: "Password must be at least 4 characters long." });
      return;
    }

    try {
      const db = getDb();
      const user = await db.get<{ id: string }>(
        "SELECT id FROM users WHERE id = ?",
        [userId],
      );
      if (!user) {
        res.status(404).json({ error: "User not found." });
        return;
      }

      const passwordHash = await bcrypt.hash(newPassword.trim(), 10);
      await db.run(
        "UPDATE users SET passwordHash = ?, needsPasswordReset = 1 WHERE id = ?",
        [passwordHash, userId],
      );

      res.json({
        message:
          "Password reset successfully. User will be prompted to set a new password on next login.",
      });
    } catch (error) {
      console.error("Failed to reset user password:", error);
      res.status(500).json({ error: "Failed to reset password." });
    }
  },
);

app.put(
  "/api/users/:id",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    if (req.user?.role !== "it") {
      res
        .status(403)
        .json({ error: "Forbidden. User modification requires IT role." });
      return;
    }

    const userId = req.params.id;
    const { name, email, department, designation, avatar, isDepartmentHead, loginEnabled } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ error: "Name is required." });
      return;
    }

    const finalEmail =
      email && email.trim() ? email.trim().toLowerCase() : null;
    const finalDepartment =
      department && department.trim() ? department.trim() : null;
    const finalDesignation =
      designation && designation.trim() ? designation.trim() : null;

    try {
      const db = getDb();

      // If email is provided, check if another user already has it
      if (finalEmail) {
        const existingEmail = await db.get(
          "SELECT id FROM users WHERE LOWER(email) = ? AND id != ?",
          [finalEmail, userId],
        );
        if (existingEmail) {
          res
            .status(400)
            .json({ error: "User with this email already exists." });
          return;
        }
      }

      const result = await db.run(
        "UPDATE users SET name = ?, email = ?, department = ?, designation = ?, avatar = ?, isDepartmentHead = ?, loginEnabled = ? WHERE id = ?",
        [
          name.trim(),
          finalEmail,
          finalDepartment,
          finalDesignation,
          avatar ? avatar.trim() : "",
          isDepartmentHead ? 1 : 0,
          loginEnabled === false ? 0 : 1,
          userId,
        ],
      );

      if (result.changes === 0) {
        res.status(404).json({ error: "User not found." });
        return;
      }

      res.json({
        id: userId,
        name: name.trim(),
        email: finalEmail,
        department: finalDepartment,
        designation: finalDesignation,
        avatar: avatar ? avatar.trim() : "",
        isDepartmentHead: isDepartmentHead ? 1 : 0,
        loginEnabled: loginEnabled === false ? 0 : 1,
      });
    } catch (error) {
      console.error("Failed to update user:", error);
      res.status(500).json({ error: "Failed to update user details." });
    }
  },
);

// Tickets Routes
app.get(
  "/api/tickets",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    try {
      const db = getDb();
      let ticketsQuery = "SELECT * FROM tickets";
      const queryParams: (string | undefined)[] = [];

      // RBAC: Employee only sees tickets they raised. IT and Manager see all.
      if (userRole === "employee") {
        ticketsQuery += " WHERE reporterId = ?";
        queryParams.push(userId);
      }

      const tickets = await db.all<DbTicket[]>(ticketsQuery, queryParams);

      if (tickets.length === 0) {
        res.json([]);
        return;
      }

      // Get all comments and logs to reconstruct full ticket shapes
      const ticketIds = tickets.map((t) => t.id);
      const placeholders = ticketIds.map(() => "?").join(",");

      const comments = await db.all<DbComment[]>(
        `SELECT * FROM comments WHERE ticketId IN (${placeholders}) ORDER BY createdAt ASC`,
        ticketIds,
      );

      const logs = await db.all<DbActivityLog[]>(
        `SELECT * FROM activity_logs WHERE ticketId IN (${placeholders}) ORDER BY timestamp ASC`,
        ticketIds,
      );

      // Map comments and logs back to their respective tickets
      const ticketsMap = tickets.map((ticket) => {
        return {
          ...ticket,
          comments: comments.filter((c) => c.ticketId === ticket.id),
          activityLogs: logs.filter((l) => l.ticketId === ticket.id),
        };
      });

      res.json(ticketsMap);
    } catch (error) {
      console.error("Failed to fetch tickets:", error);
      res.status(500).json({ error: "Failed to retrieve support tickets." });
    }
  },
);

app.post(
  "/api/tickets",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const { description, type, justification } = req.body;
    if (!description || !type || !justification) {
      res.status(400).json({ error: "Missing required ticket fields." });
      return;
    }

    try {
      const db = getDb();

      // Generate sequential ticket code based on max index to prevent collision after deletions
      const allTickets = await db.all<{ id: string }[]>(
        "SELECT id FROM tickets",
      );
      let maxIndex = 0;
      for (const t of allTickets) {
        const match = t.id.match(/HCIT-TCK-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxIndex) {
            maxIndex = num;
          }
        }
      }
      const index = maxIndex + 1;
      const ticketId = `HCIT-TCK-${index}`;

      const timestamp = new Date().toISOString();
      const reporterId = req.user?.id || "";
      const reporterName = req.user?.name || "";
      const reporterEmail = req.user?.email || "";

      // Create the ticket
      await db.run(
        `INSERT INTO tickets (
        id, title, description, type, status, justification, createdAt, updatedAt, 
        reporterId, reporterName, reporterEmail, assigneeId, assigneeName, quotation
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`,
        [
          ticketId,
          ticketId,
          description,
          type,
          "open", // First step in lifecycle
          justification,
          timestamp,
          timestamp,
          reporterId,
          reporterName,
          reporterEmail,
        ],
      );

      // Insert initial activity log
      const logId = `log-${Date.now()}`;
      await db.run(
        `INSERT INTO activity_logs (
        id, ticketId, action, timestamp, performedByName, performedByRole
      ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          logId,
          ticketId,
          "Ticket raised",
          timestamp,
          reporterName,
          req.user?.role || "employee",
        ],
      );

      // Inform all IT personnel via email if created by an employee
      if (req.user?.role === "employee") {
        try {
          const itUsers = await db.all<{ email: string }[]>(
            "SELECT email FROM users WHERE role = 'it' AND email IS NOT NULL AND email != ''",
          );
          for (const itUser of itUsers) {
            sendEmail(
              itUser.email,
              `[New Ticket] ${ticketId} Raised by ${reporterName}`,
              `Hello,\n\nA new support ticket has been raised by ${reporterName} (${reporterEmail}).\n\nTicket ID: ${ticketId}\nType: ${type}\nDescription:\n${description}\n\nPlease log in to review and assign this ticket.`,
            ).catch((err) => console.error("Email send failed:", err));
          }
        } catch (err) {
          console.error(
            "Failed to query IT users for email notification:",
            err,
          );
        }
      }

      // Retrieve and send back the full created ticket
      res.status(201).json({
        id: ticketId,
        title: ticketId,
        description,
        type,
        status: "awaiting_it_approval",
        justification,
        createdAt: timestamp,
        updatedAt: timestamp,
        reporterId,
        reporterName,
        reporterEmail,
        assigneeId: null,
        assigneeName: null,
        comments: [],
        activityLogs: [
          {
            id: logId,
            ticketId,
            action: "Ticket raised",
            timestamp,
            performedByName: reporterName,
            performedByRole: req.user?.role || "employee",
          },
        ],
      });
    } catch (error) {
      console.error("Failed to create ticket:", error);
      res.status(500).json({ error: "Failed to create new ticket." });
    }
  },
);

// Update Ticket Status (Approvals / Handover / Closure)
app.post(
  "/api/tickets/:id/status",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const ticketId = req.params.id;
    const { status, actionMessage, quotation } = req.body;

    if (!status || !actionMessage) {
      res.status(400).json({ error: "Status and actionMessage are required." });
      return;
    }

    try {
      const db = getDb();

      // Check if ticket exists
      const ticket = await db.get("SELECT * FROM tickets WHERE id = ?", [
        ticketId,
      ]);
      if (!ticket) {
        res.status(404).json({ error: "Ticket not found." });
        return;
      }

      const timestamp = new Date().toISOString();

      // Update status and updatedAt
      if (quotation !== undefined) {
        await db.run(
          "UPDATE tickets SET status = ?, updatedAt = ?, quotation = ? WHERE id = ?",
          [status, timestamp, quotation, ticketId],
        );
      } else {
        await db.run(
          "UPDATE tickets SET status = ?, updatedAt = ? WHERE id = ?",
          [status, timestamp, ticketId],
        );
      }

      // Insert activity log
      const logId = `log-${Date.now()}`;
      await db.run(
        `INSERT INTO activity_logs (
        id, ticketId, action, timestamp, performedByName, performedByRole
      ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          logId,
          ticketId,
          actionMessage,
          timestamp,
          req.user?.name || "",
          req.user?.role || "employee",
        ],
      );

      // Rule 2: Escalated to manager -> Inform manager(s) via email
      if (status === "awaiting_manager_approval") {
        try {
          const managers = await db.all<{ email: string }[]>(
            "SELECT email FROM users WHERE role = 'manager' AND email IS NOT NULL AND email != ''",
          );
          for (const mgr of managers) {
            sendEmail(
              mgr.email,
              `[Escalation Request] Ticket ${ticketId} Awaiting Manager Approval`,
              `Hello,\n\nA ticket has been escalated for your approval by ${req.user?.name || "IT"}.\n\nTicket ID: ${ticketId}\nQuotation Amount: Rs ${quotation !== undefined ? quotation : ticket.quotation || "N/A"}\nEscalation Message: ${actionMessage}\n\nPlease log in to review and approve this request.`,
            ).catch((err) => console.error("Email send failed:", err));
          }
        } catch (err) {
          console.error("Failed to query managers for escalation email:", err);
        }
      }

      // Rule 3: Approved by manager -> Inform assigned IT engineer via email
      if (
        ticket.status === "awaiting_manager_approval" &&
        status === "awaiting_handover"
      ) {
        if (ticket.assigneeId) {
          try {
            const assignee = await db.get<{ email: string }>(
              "SELECT email FROM users WHERE id = ? AND email IS NOT NULL AND email != ''",
              [ticket.assigneeId],
            );
            if (assignee && assignee.email) {
              sendEmail(
                assignee.email,
                `[Approved by Manager] Ticket ${ticketId} Ready for Handover`,
                `Hello,\n\nThe ticket assigned to you has been approved by the manager.\n\nTicket ID: ${ticketId}\nDescription: ${ticket.description}\n\nPlease proceed with the resolution work and handover.`,
              ).catch((err) => console.error("Email send failed:", err));
            }
          } catch (err) {
            console.error("Failed to query assignee for approval email:", err);
          }
        }
      }

      res.json({
        success: true,
        status,
        updatedAt: timestamp,
        quotation: quotation !== undefined ? quotation : ticket.quotation,
        newLog: {
          id: logId,
          ticketId,
          action: actionMessage,
          timestamp,
          performedByName: req.user?.name || "",
          performedByRole: req.user?.role || "employee",
        },
      });
    } catch (error) {
      console.error("Failed to update status:", error);
      res.status(500).json({ error: "Failed to update ticket status." });
    }
  },
);

// Edit Ticket (IT Admin action)
app.put(
  "/api/tickets/:id",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    if (req.user?.role !== "it") {
      res
        .status(403)
        .json({ error: "Forbidden. Ticket editing requires IT role." });
      return;
    }

    const ticketId = req.params.id;
    const { description, type, justification } = req.body;

    if (!description || !type) {
      res.status(400).json({ error: "Description and type are required." });
      return;
    }

    try {
      const db = getDb();

      const ticket = await db.get("SELECT * FROM tickets WHERE id = ?", [
        ticketId,
      ]);
      if (!ticket) {
        res.status(404).json({ error: "Ticket not found." });
        return;
      }

      const timestamp = new Date().toISOString();

      await db.run(
        "UPDATE tickets SET description = ?, type = ?, justification = ?, updatedAt = ? WHERE id = ?",
        [description, type, justification || "", timestamp, ticketId],
      );

      // Insert activity log
      const logId = `log-${Date.now()}`;
      await db.run(
        `INSERT INTO activity_logs (
        id, ticketId, action, timestamp, performedByName, performedByRole
      ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          logId,
          ticketId,
          "Ticket details updated by IT",
          timestamp,
          req.user?.name || "",
          req.user?.role || "it",
        ],
      );

      res.json({
        success: true,
        updatedAt: timestamp,
        newLog: {
          id: logId,
          ticketId,
          action: "Ticket details updated by IT",
          timestamp,
          performedByName: req.user?.name || "",
          performedByRole: req.user?.role || "it",
        },
      });
    } catch (error) {
      console.error("Failed to edit ticket:", error);
      res.status(500).json({ error: "Failed to edit ticket." });
    }
  },
);

app.delete(
  "/api/tickets/:id",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    if (req.user?.role !== "it") {
      res
        .status(403)
        .json({ error: "Forbidden. Ticket deletion requires IT role." });
      return;
    }

    const ticketId = req.params.id;

    try {
      const db = getDb();

      const ticket = await db.get("SELECT id FROM tickets WHERE id = ?", [
        ticketId,
      ]);
      if (!ticket) {
        res.status(404).json({ error: "Ticket not found." });
        return;
      }

      await db.run("DELETE FROM tickets WHERE id = ?", [ticketId]);

      res.json({ success: true, message: "Ticket deleted successfully." });
    } catch (error) {
      console.error("Failed to delete ticket:", error);
      res.status(500).json({ error: "Failed to delete ticket." });
    }
  },
);

// Assign Ticket (IT Admin action)
app.post(
  "/api/tickets/:id/assign",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const ticketId = req.params.id;
    const { assigneeId, assigneeName } = req.body;

    if (!assigneeId || !assigneeName) {
      res
        .status(400)
        .json({ error: "AssigneeId and assigneeName are required." });
      return;
    }

    try {
      const db = getDb();

      // Verify ticket exists
      const ticket = await db.get("SELECT * FROM tickets WHERE id = ?", [
        ticketId,
      ]);
      if (!ticket) {
        res.status(404).json({ error: "Ticket not found." });
        return;
      }

      const timestamp = new Date().toISOString();

      // Changing assignee moves it to awaiting IT approval
      const newStatus = "awaiting_it_approval";

      // Update ticket assignee and status (moves to awaiting_it_approval upon assignment)
      await db.run(
        "UPDATE tickets SET assigneeId = ?, assigneeName = ?, status = ?, updatedAt = ? WHERE id = ?",
        [assigneeId, assigneeName, newStatus, timestamp, ticketId],
      );

      // Add activity log
      const logId = `log-${Date.now()}`;
      const actionText = `Assigned to ${assigneeName}`;
      await db.run(
        `INSERT INTO activity_logs (
        id, ticketId, action, timestamp, performedByName, performedByRole
      ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          logId,
          ticketId,
          actionText,
          timestamp,
          req.user?.name || "",
          req.user?.role || "it",
        ],
      );

      res.json({
        success: true,
        assigneeId,
        assigneeName,
        status: "in_progress",
        updatedAt: timestamp,
        newLog: {
          id: logId,
          ticketId,
          action: actionText,
          timestamp,
          performedByName: req.user?.name || "",
          performedByRole: req.user?.role || "it",
        },
      });
    } catch (error) {
      console.error("Failed to assign ticket:", error);
      res.status(500).json({ error: "Failed to assign ticket." });
    }
  },
);

// Add Comment
app.post(
  "/api/tickets/:id/comments",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const ticketId = req.params.id;
    const { content } = req.body;

    if (!content || !content.trim()) {
      res.status(400).json({ error: "Comment content cannot be empty." });
      return;
    }

    try {
      const db = getDb();

      // Check if ticket exists
      const ticket = await db.get("SELECT id FROM tickets WHERE id = ?", [
        ticketId,
      ]);
      if (!ticket) {
        res.status(404).json({ error: "Ticket not found." });
        return;
      }

      const commentId = `c-${Date.now()}`;
      const timestamp = new Date().toISOString();

      await db.run(
        `INSERT INTO comments (
        id, ticketId, authorId, authorName, authorRole, avatar, content, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          commentId,
          ticketId,
          req.user?.id || "",
          req.user?.name || "",
          req.user?.role || "employee",
          req.user?.avatar || "",
          content.trim(),
          timestamp,
        ],
      );

      // Touch the ticket's updatedAt
      await db.run("UPDATE tickets SET updatedAt = ? WHERE id = ?", [
        timestamp,
        ticketId,
      ]);

      res.status(201).json({
        id: commentId,
        ticketId,
        authorId: req.user?.id || "",
        authorName: req.user?.name || "",
        authorRole: req.user?.role || "employee",
        avatar: req.user?.avatar || "",
        content: content.trim(),
        createdAt: timestamp,
      });
    } catch (error) {
      console.error("Failed to add comment:", error);
      res.status(500).json({ error: "Failed to add comment to ticket." });
    }
  },
);

// Global Activity Logs route (for logs page)
app.get(
  "/api/activity-logs",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    try {
      const db = getDb();

      // We want to fetch all logs, but join with tickets to know who reporter is for RBAC filtering
      let logsQuery = `
      SELECT al.*, t.title as ticketTitle
      FROM activity_logs al
      JOIN tickets t ON al.ticketId = t.id
    `;
      const queryParams: (string | undefined)[] = [];

      // RBAC: Employee only sees logs for tickets they raised. IT and Manager see all.
      if (userRole === "employee") {
        logsQuery += " WHERE t.reporterId = ?";
        queryParams.push(userId);
      }

      logsQuery += " ORDER BY al.timestamp DESC";

      const logs = await db.all<(DbActivityLog & { ticketTitle: string })[]>(
        logsQuery,
        queryParams,
      );
      res.json(logs);
    } catch {
      res.status(500).json({ error: "Failed to retrieve activity logs." });
    }
  },
);

// Set to keep track of SSE clients for real-time attendance updates
const sseClients = new Set<Response>();

// Attendance logs GET endpoint
app.get(
  "/api/attendance",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const db = getDb();
      const logs = await db.all(
        "SELECT * FROM attendance_logs ORDER BY timestamp DESC",
      );
      res.json(logs);
    } catch (error) {
      console.error("Failed to retrieve attendance logs:", error);
      res.status(500).json({ error: "Failed to retrieve attendance logs." });
    }
  },
);

// Add manual attendance punch (IT or Manager only)
app.post(
  "/api/attendance/manual",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    if (req.user?.role !== "it" && req.user?.role !== "manager") {
      res
        .status(403)
        .json({
          error: "Forbidden. Only managers or IT can add manual attendance.",
        });
      return;
    }

    const { userId, date, time, status } = req.body;
    if (!userId || !date || !time || !status) {
      res.status(400).json({ error: "Missing required fields." });
      return;
    }

    try {
      const db = getDb();
      // Combine date and time to PKT timestamp, then convert to UTC for DB
      const pktDateStr = `${date}T${time}:00+05:00`;
      const pktDate = new Date(pktDateStr);

      if (isNaN(pktDate.getTime())) {
        res.status(400).json({ error: "Invalid date or time." });
        return;
      }

      const year = pktDate.getUTCFullYear();
      const month = String(pktDate.getUTCMonth() + 1).padStart(2, "0");
      const day = String(pktDate.getUTCDate()).padStart(2, "0");
      const hours = String(pktDate.getUTCHours()).padStart(2, "0");
      const minutes = String(pktDate.getUTCMinutes()).padStart(2, "0");
      const seconds = String(pktDate.getUTCSeconds()).padStart(2, "0");

      const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

      const user = await db.get("SELECT name FROM users WHERE id = ?", [
        userId,
      ]);
      if (!user) {
        res.status(404).json({ error: "Employee not found." });
        return;
      }

      await db.run(
        "INSERT INTO attendance_logs (name, userId, ioTime, method, status, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
        [user.name, userId, timestamp, "Manual", status, timestamp],
      );

      if (status === "On Leave" && (time === "09:30" || time === "10:00")) {
        const u = await db.get("SELECT casualLeaves, annualLeaves, medicalLeaves FROM users WHERE id = ?", [userId]);
        if (u) {
          if (u.casualLeaves > 0) {
            await db.run("UPDATE users SET casualLeaves = casualLeaves - 1 WHERE id = ?", [userId]);
          } else if (u.annualLeaves > 0) {
            await db.run("UPDATE users SET annualLeaves = annualLeaves - 1 WHERE id = ?", [userId]);
          } else if (u.medicalLeaves > 0) {
            await db.run("UPDATE users SET medicalLeaves = medicalLeaves - 1 WHERE id = ?", [userId]);
          }
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to add manual attendance:", error);
      res.status(500).json({ error: "Failed to add manual attendance." });
    }
  },
);

// Clear ALL attendance logs (IT only)
app.delete(
  "/api/attendance",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    if (req.user?.role !== "it") {
      res
        .status(403)
        .json({
          error: "Forbidden. Clearing attendance logs requires IT role.",
        });
      return;
    }
    try {
      const db = getDb();
      await db.run("DELETE FROM attendance_logs");
      res.json({ success: true, message: "All attendance logs cleared." });
    } catch (error) {
      console.error("Failed to clear attendance logs:", error);
      res.status(500).json({ error: "Failed to clear attendance logs." });
    }
  },
);

// Delete a single attendance log (IT only, Check-Out only)
app.delete(
  "/api/attendance/:id",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    if (req.user?.role !== "it") {
      res
        .status(403)
        .json({
          error: "Forbidden. Attendance log deletion requires IT role.",
        });
      return;
    }

    const logId = parseInt(req.params.id as string, 10);
    if (isNaN(logId)) {
      res.status(400).json({ error: "Invalid log ID." });
      return;
    }

    try {
      const db = getDb();
      const log = await db.get(
        "SELECT status FROM attendance_logs WHERE id = ?",
        [logId],
      );
      if (!log) {
        res.status(404).json({ error: "Attendance log not found." });
        return;
      }
      if (log.status !== "Check-Out") {
        res
          .status(400)
          .json({ error: "Only punch out (Check-Out) logs can be deleted." });
        return;
      }

      const result = await db.run("DELETE FROM attendance_logs WHERE id = ?", [
        logId,
      ]);
      if (result.changes === 0) {
        res.status(404).json({ error: "Attendance log not found." });
        return;
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete attendance log:", error);
      res.status(500).json({ error: "Failed to delete attendance log." });
    }
  },
);

// Attendance SSE Stream endpoint for real-time updates
app.get(
  "/api/attendance/stream",
  authenticateToken,
  (req: AuthRequest, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    sseClients.add(res);

    req.on("close", () => {
      sseClients.delete(res);
    });
  },
);

// --------------------- LEAVE MANAGEMENT ROUTES ---------------------

app.get(
  "/api/leaves",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    try {
      const db = getDb();
      const currentUser = await db.get("SELECT role, department, isDepartmentHead FROM users WHERE id = ?", [userId]);
      let query = "SELECT * FROM leave_applications ORDER BY appliedAt DESC";
      const params: any[] = [];

      if (currentUser?.isDepartmentHead) {
        query = `
          SELECT l.*, u.username AS userCode FROM leave_applications l
          JOIN users u ON l.userId = u.id
          WHERE l.userId = ? OR u.department = ?
          ORDER BY l.appliedAt DESC
        `;
        params.push(userId, currentUser.department);
      } else {
        query = `
          SELECT l.*, u.username AS userCode FROM leave_applications l
          JOIN users u ON l.userId = u.id
          WHERE l.userId = ? 
          ORDER BY l.appliedAt DESC
        `;
        params.push(userId);
      }

      const leaves = await db.all(query, params);
      res.json(leaves);
    } catch (error) {
      console.error("Failed to fetch leaves:", error);
      res.status(500).json({ error: "Failed to retrieve leave applications." });
    }
  },
);

app.post(
  "/api/leaves",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const { category, startDate, endDate, reason } = req.body;
    if (!category || !startDate || !endDate || !reason) {
      res.status(400).json({ error: "All fields are required." });
      return;
    }

    try {
      const db = getDb();

      // Check for overlapping approved site duties
      const existingDuty = await db.get(
        "SELECT id FROM site_duty_applications WHERE userId = ? AND status = 'approved' AND startDate <= ? AND endDate >= ?",
        [req.user?.id, endDate, startDate]
      );
      if (existingDuty) {
        res.status(400).json({ error: "Cannot apply for leave on a date with an approved site duty." });
        return;
      }

      // Check for overlapping approved leaves (self check)
      const existingLeave = await db.get(
        "SELECT id FROM leave_applications WHERE userId = ? AND status = 'approved' AND startDate <= ? AND endDate >= ?",
        [req.user?.id, endDate, startDate]
      );
      if (existingLeave) {
        res.status(400).json({ error: "Cannot apply for leave on a date with an already approved leave." });
        return;
      }

      const leaveId = `leave-${Date.now()}`;
      const timestamp = new Date().toISOString();

      await db.run(
        `INSERT INTO leave_applications (
          id, userId, userName, category, startDate, endDate, reason, status, appliedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          leaveId,
          req.user?.id,
          req.user?.name,
          category,
          startDate,
          endDate,
          reason,
          "pending",
          timestamp,
        ],
      );

      res.status(201).json({ success: true, id: leaveId });
    } catch (error) {
      console.error("Failed to submit leave:", error);
      res.status(500).json({ error: "Failed to submit leave application." });
    }
  },
);

app.put(
  "/api/leaves/:id/status",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const db = getDb();
    const leaveId = req.params.id;
    const leave = await db.get<{ userId: string }>("SELECT userId FROM leave_applications WHERE id = ?", [leaveId]);
    if (!leave) {
      res.status(404).json({ error: "Leave application not found." });
      return;
    }

    const applicant = await db.get<{ department: string | null }>("SELECT department FROM users WHERE id = ?", [leave.userId]);
    const approver = await db.get<{ isDepartmentHead: number; department: string | null }>("SELECT isDepartmentHead, department FROM users WHERE id = ?", [req.user?.id]);

    if (!approver?.isDepartmentHead || approver.department !== applicant?.department) {
      res.status(403).json({ error: "Forbidden. Only the department head can approve this leave." });
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
      const leaveId = req.params.id;

      const result = await db.run(
        "UPDATE leave_applications SET status = ? WHERE id = ?",
        [status, leaveId],
      );

      if (result.changes === 0) {
        res.status(404).json({ error: "Leave application not found." });
        return;
      }

      // Handle attendance logic if approved
      if (status === "approved") {
        const leave = await db.get("SELECT * FROM leave_applications WHERE id = ?", [leaveId]);
        if (leave) {
          const start = new Date(leave.startDate);
          const end = new Date(leave.endDate);
          
          let daysToDeduct = 0;
          
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dayOfWeek = d.getDay();
            if (dayOfWeek === 0) continue; // Skip Sundays
            
            daysToDeduct++;

            let checkInTime = "09:30:00";
            let checkOutTime = "18:00:00";

            if (dayOfWeek === 6) { // Saturday
              checkInTime = "10:00:00";
              checkOutTime = "16:00:00";
            }

            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            
            const getUtcTimestamp = (y: string, m: string, d2: string, timeStr: string) => {
              const pktDateStr = `${y}-${m}-${d2}T${timeStr}+05:00`;
              const pktDate = new Date(pktDateStr);
              const uYear = pktDate.getUTCFullYear();
              const uMonth = String(pktDate.getUTCMonth() + 1).padStart(2, "0");
              const uDay = String(pktDate.getUTCDate()).padStart(2, "0");
              const uHours = String(pktDate.getUTCHours()).padStart(2, "0");
              const uMinutes = String(pktDate.getUTCMinutes()).padStart(2, "0");
              const uSeconds = String(pktDate.getUTCSeconds()).padStart(2, "0");
              return `${uYear}-${uMonth}-${uDay} ${uHours}:${uMinutes}:${uSeconds}`;
            };
            
            const checkInTimestamp = getUtcTimestamp(String(year), month, day, checkInTime);
            const checkOutTimestamp = getUtcTimestamp(String(year), month, day, checkOutTime);

            await db.run(
              "INSERT INTO attendance_logs (name, userId, ioTime, method, status, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
              [leave.userName, leave.userId, checkInTimestamp, "System", "On Leave", checkInTimestamp]
            );

            await db.run(
              "INSERT INTO attendance_logs (name, userId, ioTime, method, status, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
              [leave.userName, leave.userId, checkOutTimestamp, "System", "On Leave", checkOutTimestamp]
            );
          }

          if (daysToDeduct > 0) {
            let columnToUpdate = 'casualLeaves';
            if (leave.category === 'annual') columnToUpdate = 'annualLeaves';
            else if (leave.category === 'medical') columnToUpdate = 'medicalLeaves';

            await db.run(
              `UPDATE users SET ${columnToUpdate} = MAX(0, ${columnToUpdate} - ?) WHERE id = ?`,
              [daysToDeduct, leave.userId]
            );
          }
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to update leave status:", error);
      res.status(500).json({ error: "Failed to update leave status." });
    }
  },
);

// --------------------- SITE DUTIES ROUTES ---------------------

app.get(
  "/api/site-duties",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    try {
      const db = getDb();
      const currentUser = await db.get("SELECT role, department, isDepartmentHead FROM users WHERE id = ?", [userId]);
      let query = "SELECT * FROM site_duty_applications ORDER BY appliedAt DESC";
      const params: any[] = [];

      if (currentUser?.isDepartmentHead) {
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
      console.error("Failed to fetch site duties:", error);
      res.status(500).json({ error: "Failed to retrieve site duty applications." });
    }
  },
);

app.post(
  "/api/site-duties",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const { siteName, reason, startDate, endDate } = req.body;
    if (!siteName || !reason || !startDate || !endDate) {
      res.status(400).json({ error: "All fields are required." });
      return;
    }

    try {
      const db = getDb();

      // Check for overlapping approved leaves
      const existingLeave = await db.get(
        "SELECT id FROM leave_applications WHERE userId = ? AND status = 'approved' AND startDate <= ? AND endDate >= ?",
        [req.user?.id, endDate, startDate]
      );
      if (existingLeave) {
        res.status(400).json({ error: "Cannot apply for site duty on a date with an approved leave." });
        return;
      }

      // Check for overlapping approved site duties (self check)
      const existingDuty = await db.get(
        "SELECT id FROM site_duty_applications WHERE userId = ? AND status = 'approved' AND startDate <= ? AND endDate >= ?",
        [req.user?.id, endDate, startDate]
      );
      if (existingDuty) {
        res.status(400).json({ error: "Cannot apply for site duty on a date with an already approved site duty." });
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
      console.error("Failed to submit site duty:", error);
      res.status(500).json({ error: "Failed to submit site duty application." });
    }
  },
);

app.put(
  "/api/site-duties/:id/status",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const db = getDb();
    const sdId = req.params.id;
    const duty = await db.get<{ userId: string }>("SELECT userId FROM site_duty_applications WHERE id = ?", [sdId]);
    if (!duty) {
      res.status(404).json({ error: "Site duty application not found." });
      return;
    }

    const applicant = await db.get<{ department: string | null }>("SELECT department FROM users WHERE id = ?", [duty.userId]);
    const approver = await db.get<{ isDepartmentHead: number; department: string | null }>("SELECT isDepartmentHead, department FROM users WHERE id = ?", [req.user?.id]);

    if (!approver?.isDepartmentHead || approver.department !== applicant?.department) {
      res.status(403).json({ error: "Forbidden. Only the department head can approve this site duty." });
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
      const sdId = req.params.id;

      const duty = await db.get("SELECT * FROM site_duty_applications WHERE id = ?", [sdId]);
      if (!duty) {
        res.status(404).json({ error: "Site duty application not found." });
        return;
      }

      await db.run(
        "UPDATE site_duty_applications SET status = ? WHERE id = ?",
        [status, sdId],
      );

      // Handle attendance logic if approved
      if (status === "approved") {
        const start = new Date(duty.startDate);
        const end = new Date(duty.endDate);
        
        // Iterate through each day
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dayOfWeek = d.getDay();
          // Skip Sundays
          if (dayOfWeek === 0) continue;

          let checkInTime = "09:30:00";
          let checkOutTime = "18:00:00";

          // Saturday
          if (dayOfWeek === 6) {
            checkInTime = "10:00:00";
            checkOutTime = "16:00:00";
          }

          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          
          const getUtcTimestamp = (y: string, m: string, d: string, timeStr: string) => {
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
          
          const checkInTimestamp = getUtcTimestamp(String(year), month, day, checkInTime);
          const checkOutTimestamp = getUtcTimestamp(String(year), month, day, checkOutTime);

          // Insert check-in
          await db.run(
            "INSERT INTO attendance_logs (name, userId, ioTime, method, status, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
            [duty.userName, duty.userId, checkInTimestamp, "System", "Site Duty", checkInTimestamp]
          );

          // Insert check-out
          await db.run(
            "INSERT INTO attendance_logs (name, userId, ioTime, method, status, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
            [duty.userName, duty.userId, checkOutTimestamp, "System", "Site Duty", checkOutTimestamp]
          );
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to update site duty status:", error);
      res.status(500).json({ error: "Failed to update site duty status." });
    }
  },
);

// Start Database and Server
// Serve static frontend files in production
app.use(express.static(path.join(__dirname, "../dist")));

// Fallback all non-API routes to index.html (SPA routing)
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});

async function startServer() {
  try {
    await initDb();
    const server = app.listen(PORT, () => {
      console.log(`Backend server is running on http://localhost:${PORT}`);
    });

    // Integrated WebSocket Server for the biometric attendance device (Pioneer XML Bridge)
    const wss = new WebSocketServer({ noServer: true });

    server.on("upgrade", (request, socket, head) => {
      // Handle websocket upgrade
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    });

    const lastProcessedPunchMap = new Map<string, string>();
    const METHOD_MAP: Record<string, string> = {
      FP: "Fingerprint",
      FACE: "Face",
      CD: "Card",
      CARD: "Card",
      PWD: "Password",
    };

    wss.on("connection", (ws, req) => {
      console.log(
        `📡 [DEVICE CONNECTED] Connection open from IP: ${req.socket.remoteAddress}`,
      );

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
          } catch (err: any) {
            console.error("❌ [ERROR] Processing Management Log:", err.message);
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

              if (userId === "0" || userId === "00000000") {
                console.log(
                  `⚠️ [SECURITY] Dropped a failed/unregistered scan attempt.`,
                );
                return;
              }

              const lastPunchTime = lastProcessedPunchMap.get(userId);

              if (lastPunchTime !== punchTime) {
                lastProcessedPunchMap.set(userId, punchTime);

                let parsedName = `Employee (ID: ${userId})`;
                let status = "Check-In";

                try {
                  const db = getDb();
                  // Standardize username lookup: check username = 'HC-' + padded 5-digit ID, or matching username/ID directly
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
                    // Extract hour in PKT (UTC+5) to enforce the 6 PM check-in cutoff
                    const punchHourPKT = (() => {
                      try {
                        const dateStr = punchTime.includes("T")
                          ? punchTime
                          : punchTime.replace(" ", "T");
                        const d = new Date(
                          dateStr + (dateStr.endsWith("Z") ? "" : "+05:00"),
                        );
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
                } catch (lookupError: any) {
                  console.error(
                    "⚠️ [DB USER LOOKUP/STATUS ERROR] Falling back to default values:",
                    lookupError.message,
                  );
                  status = attendStat === "DutyOff" ? "Check-Out" : "Check-In";
                }

                console.log(
                  `\n======================================================`,
                );
                console.log(`✅ [NEW ATTENDANCE CAPTURED]`);
                console.log(`👤 Name:   ${parsedName}`);
                console.log(`🆔 ID:     ${userId}`);
                console.log(`⏰ Time:   ${punchTime}`);
                console.log(`🛡️ Method: ${scanMethod}`);
                console.log(`🚦 Status: ${status}`);
                console.log(
                  `======================================================\n`,
                );

                try {
                  const db = getDb();
                  const insertResult = await db.run(
                    "INSERT INTO attendance_logs (name, userId, ioTime, method, status) VALUES (?, ?, ?, ?, ?)",
                    [parsedName, userId, punchTime, scanMethod, status],
                  );
                  console.log(`[DB] Saved log profile successfully.`);

                  // Broadcast the new log to all connected SSE clients
                  try {
                    const newLog = await db.get(
                      "SELECT * FROM attendance_logs WHERE id = ?",
                      insertResult.lastID,
                    );
                    if (newLog) {
                      const message = `data: ${JSON.stringify(newLog)}\n\n`;
                      for (const client of sseClients) {
                        client.write(message);
                      }
                    }
                  } catch (e) {
                    console.error("Failed to broadcast new attendance log", e);
                  }
                } catch (err: any) {
                  console.error("❌ [DB] Database Storage Error:", err.message);
                }
              }
            }
          } catch (err: any) {
            console.error("❌ [ERROR] Parsing XML Data Block:", err.message);
          }
          return;
        }

        // 5. HEARTBEAT MANAGER
        if (
          rawString.includes("<Request>Heartbeat</Request>") ||
          rawString.includes("Heartbeat")
        ) {
          console.log("💓 [SOCKET HEARTBEAT] Device is online.");
          const xmlHeartbeatResponse = `<?xml version="1.0"?>\r\n<Message>\r\n<Response>Heartbeat</Response>\r\n<Result>OK</Result>\r\n</Message>`;
          return ws.send(xmlHeartbeatResponse);
        }
      });

      ws.on("close", () =>
        console.log("🔌 [DEVICE DISCONNECTED] Channel closed."),
      );
    });
  } catch (err) {
    console.error("Failed to start database/server:", err);
    process.exit(1);
  }
}

startServer();
