import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, notificationsTable } from "@workspace/db";
import {
  ListNotificationsResponse,
  MarkNotificationReadParams,
  MarkNotificationReadResponse,
} from "@workspace/api-zod";
import { authMiddleware } from "../middlewares/auth";

const router: IRouter = Router();
router.use(authMiddleware);

router.get("/notifications", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: notificationsTable.id,
      title: notificationsTable.title,
      message: notificationsTable.message,
      type: notificationsTable.type,
      read: notificationsTable.read,
      createdAt: notificationsTable.createdAt,
    })
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, req.authUser!.id))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(100);
  res.json(
    ListNotificationsResponse.parse(
      rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
    ),
  );
});

router.patch(
  "/notifications/:id/read",
  async (req, res): Promise<void> => {
    const parsed = MarkNotificationReadParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: "Notification ID is invalid." });
      return;
    }
    const [notification] = await db
      .update(notificationsTable)
      .set({ read: true })
      .where(
        and(
          eq(notificationsTable.id, parsed.data.id),
          eq(notificationsTable.userId, req.authUser!.id),
        ),
      )
      .returning({ id: notificationsTable.id });
    if (!notification) {
      res.status(404).json({ error: "Notification not found." });
      return;
    }
    MarkNotificationReadResponse.parse(undefined);
    res.sendStatus(204);
  },
);

export default router;
