import { createHash, randomUUID } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { db, sessionsTable, usersTable } from "@workspace/db";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: "student" | "admin";
  sessionId: string;
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
    }
  }
}

const jwtSecret = process.env.JWT_SECRET ?? process.env.SESSION_SECRET;

if (!jwtSecret) {
  throw new Error("JWT_SECRET or SESSION_SECRET must be configured.");
}

export const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const signingSecret: string = jwtSecret;

export async function issueSession(user: Pick<AuthenticatedUser, "id">): Promise<string> {
  const sessionId = randomUUID();
  const token = jwt.sign({}, signingSecret, {
    subject: user.id,
    jwtid: sessionId,
    expiresIn: "7d",
  });

  await db.insert(sessionsTable).values({
    id: sessionId,
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return token;
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authorization = req.headers.authorization;
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (!token) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }

  try {
    const decoded = jwt.verify(token, signingSecret) as JwtPayload;
    const userId = decoded.sub;
    const sessionId = decoded.jti;

    if (!userId || !sessionId) {
      res.status(401).json({ error: "Your session is invalid." });
      return;
    }

    const [session] = await db
      .select({ id: sessionsTable.id })
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.id, sessionId),
          eq(sessionsTable.userId, userId),
          eq(sessionsTable.tokenHash, hashToken(token)),
          isNull(sessionsTable.revokedAt),
          gt(sessionsTable.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!session) {
      res.status(401).json({ error: "Your session has expired. Sign in again." });
      return;
    }

    const [user] = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        role: usersTable.role,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "Your account could not be found." });
      return;
    }

    req.authUser = {
      ...user,
      role: user.role === "admin" ? "admin" : "student",
      sessionId,
    };
    next();
  } catch {
    res.status(401).json({ error: "Your session is invalid or expired." });
  }
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.authUser?.role !== "admin") {
    res.status(403).json({ error: "Administrator access is required." });
    return;
  }
  next();
}
