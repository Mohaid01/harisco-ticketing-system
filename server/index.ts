import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";
import { initDb, getDb } from "./db.js";
import { sendEmail } from "./email.js";

const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) throw new Error("JWT_SECRET is required");
const PORT = process.env.PORT || 8082;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Extend express Request interface for our middleware
interface AuthRequest extends Request {
  user?: {
    id: string;
    name: string;
    email: string;
    role: "it" | "employee" | "manager";
    avatar: string;
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
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({ error: "Authentication token required." });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err || !decoded || typeof decoded !== "object") {
      res.status(403).json({ error: "Invalid or expired token." });
      return;
    }

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
app.post("/api/auth/login", async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required." });
    return;
  }

  try {
    const db = getDb();
    const user = await db.get<DbUser>(
      "SELECT id, name, email, username, role, avatar, passwordHash, needsPasswordReset FROM users WHERE LOWER(username) = ?",
      [username.toLowerCase().trim()],
    );

    if (!user) {
      res.status(401).json({ error: "Invalid username or password." });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: "Invalid username or password." });
      return;
    }

    // Sign JWT
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
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Database or server error during login." });
  }
});

app.get(
  "/api/auth/me",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const db = getDb();
      const user = await db.get<DbUser>(
        "SELECT id, name, email, username, role, avatar, needsPasswordReset FROM users WHERE id = ?",
        [req.user?.id],
      );
      if (!user) {
        res.status(404).json({ error: "User not found." });
        return;
      }
      res.json({ user });
    } catch {
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
        "SELECT id, name, email, username, role, avatar FROM users",
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

    const { name, email, username, role, password } = req.body;
    if (!name || !username || !role) {
      res.status(400).json({ error: "Name, username, and role are required." });
      return;
    }

    const finalEmail =
      email && email.trim() ? email.trim().toLowerCase() : null;
    const defaultPassword = process.env.DEFAULT_USER_PASSWORD;
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
        "INSERT INTO users (id, name, email, username, role, avatar, passwordHash, needsPasswordReset) VALUES (?, ?, ?, ?, ?, ?, ?, 1)",
        [
          userId,
          name,
          finalEmail,
          username.toLowerCase().trim(),
          role,
          "",
          passwordHash,
        ],
      );

      res.status(201).json({
        id: userId,
        name,
        email: finalEmail,
        username: username.toLowerCase().trim(),
        role,
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
    const { name, email } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ error: "Name is required." });
      return;
    }

    const finalEmail =
      email && email.trim() ? email.trim().toLowerCase() : null;

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
        "UPDATE users SET name = ?, email = ? WHERE id = ?",
        [name.trim(), finalEmail, userId],
      );

      if (result.changes === 0) {
        res.status(404).json({ error: "User not found." });
        return;
      }

      res.json({ id: userId, name: name.trim(), email: finalEmail });
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
      const allTickets = await db.all<{ id: string }>("SELECT id FROM tickets");
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
          const itUsers = await db.all<{ email: string }>(
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
          const managers = await db.all<{ email: string }>(
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
    app.listen(PORT, () => {
      console.log(`Backend server is running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start database/server:", err);
    process.exit(1);
  }
}

startServer();
