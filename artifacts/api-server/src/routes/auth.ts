import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  db,
  notificationsTable,
  sessionsTable,
  studentsTable,
  usersTable,
} from "@workspace/db";
import {
  LoginBody,
  RegisterBody,
  type AuthSession,
  type User,
} from "@workspace/api-zod";
import { authMiddleware, issueSession } from "../middlewares/auth";

const router: IRouter = Router();

function safeUser(user: {
  id: string;
  name: string;
  email: string;
  role: string;
}): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role === "admin" ? "admin" : "student",
  };
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a name, valid email, and password of at least 8 characters." });
    return;
  }

  const name = parsed.data.name.trim();
  const email = parsed.data.email.trim().toLowerCase();
  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists." });
    return;
  }

  const userId = randomUUID();
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const [user] = await db
    .insert(usersTable)
    .values({ id: userId, name, email, passwordHash })
    .returning({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
    });

  await db.insert(studentsTable).values({ userId, fullName: name });
  await db.insert(notificationsTable).values({
    userId,
    title: "Welcome to ScholarNest",
    message: "Complete your profile to get scholarship matches tailored to you.",
    type: "welcome",
  });
  const token = await issueSession(user);
  const response: AuthSession = { token, user: safeUser(user) };
  res.status(201).json(response);
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid email and password." });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ error: "Email or password is incorrect." });
    return;
  }

  const token = await issueSession(user);
  const response: AuthSession = { token, user: safeUser(user) };
  res.json(response);
});

router.post("/auth/logout", authMiddleware, async (req, res): Promise<void> => {
  const user = req.authUser;
  if (user) {
    await db
      .update(sessionsTable)
      .set({ revokedAt: new Date() })
      .where(eq(sessionsTable.id, user.sessionId));
  }
  res.sendStatus(204);
});

router.get("/auth/me", authMiddleware, (req, res): void => {
  const user = req.authUser;
  if (!user) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }
  res.json(safeUser(user));
});

export default router;
