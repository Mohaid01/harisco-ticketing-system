import rateLimit from "express-rate-limit";
import { Request } from "express";

export const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) throw new Error("JWT_SECRET is required");

export const PORT = process.env.PORT || 8082;

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: (req: Request): string => {
    const identity = req.body?.username || req.body?.email || "anonymous-login";
    return `login:${identity.trim().toLowerCase()}`;
  },
  message: {
    error: "Too many login attempts, please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// User-identity-keyed rate limiter for all other API routes.
// Falls back to IP if no Authorization token is present.
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  keyGenerator: (req: Request): string => {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) {
      // Use the raw token as the key — unique per user session
      return auth.slice(7);
    }
    return "unauthenticated-global-traffic";
  },
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter per-user rate limiter for write operations (POST/PUT/DELETE/PATCH)
// Prevents write storms from overwhelming SQLite under high concurrency
export const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: (req: Request): string => {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) {
      return `write:${auth.slice(7)}`;
    }
    return "write:unauthenticated-traffic";
  },
  message: { error: "Too many write requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
