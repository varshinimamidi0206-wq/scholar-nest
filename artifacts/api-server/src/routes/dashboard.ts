import { and, count, desc, eq, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  applicationsTable,
  db,
  documentsTable,
  savedScholarshipsTable,
  scholarshipsTable,
  studentsTable,
  usersTable,
} from "@workspace/db";
import { GetDashboardResponse } from "@workspace/api-zod";
import { authMiddleware } from "../middlewares/auth";
import { getStudent, listScholarshipMatches, profileCompletion } from "../lib/matching";
import { serializeApplication, serializeMatch } from "../lib/serializers";

const router: IRouter = Router();
router.use(authMiddleware);

router.get("/dashboard", async (req, res): Promise<void> => {
  const userId = req.authUser!.id;
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const nextWeek = new Date(startOfToday);
  nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);

  const [
    [student],
    matches,
    [saved],
    [applicationCount],
    [readyDocuments],
    applicationRows,
    [user],
  ] = await Promise.all([
    db
      .select()
      .from(studentsTable)
      .where(eq(studentsTable.userId, userId))
      .limit(1),
    listScholarshipMatches(userId),
    db
      .select({ total: count() })
      .from(savedScholarshipsTable)
      .where(eq(savedScholarshipsTable.userId, userId)),
    db
      .select({ total: count() })
      .from(applicationsTable)
      .where(eq(applicationsTable.userId, userId)),
    db
      .select({ total: count() })
      .from(documentsTable)
      .where(
        and(
          eq(documentsTable.userId, userId),
          inArray(documentsTable.status, ["Ready", "Uploaded"]),
        ),
      ),
    db
      .select({
        application: applicationsTable,
        scholarshipName: scholarshipsTable.name,
        provider: scholarshipsTable.provider,
        deadline: scholarshipsTable.deadline,
      })
      .from(applicationsTable)
      .innerJoin(
        scholarshipsTable,
        eq(
          applicationsTable.scholarshipId,
          scholarshipsTable.id,
        ),
      )
      .where(eq(applicationsTable.userId, userId))
      .orderBy(desc(applicationsTable.updatedAt))
      .limit(5),
    db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1),
  ]);

  const deadlines = matches
    .filter((match) => match.eligible && match.deadline)
    .filter((match) => {
      const deadline = new Date(`${match.deadline}T00:00:00.000Z`);
      return deadline >= startOfToday && deadline <= nextWeek;
    })
    .sort(
      (a, b) =>
        new Date(`${a.deadline}T00:00:00.000Z`).getTime() -
        new Date(`${b.deadline}T00:00:00.000Z`).getTime(),
    );

  const payload = {
    user: req.authUser,
    stats: {
      profileCompletion: profileCompletion(student),
      scholarshipsFound: matches.length,
      strongMatches: matches.filter((match) => match.matchScore >= 80).length,
      saved: saved?.total ?? 0,
      applications: applicationCount?.total ?? 0,
      deadlinesThisWeek: deadlines.length,
      documentsReady: readyDocuments?.total ?? 0,
    },
    bestMatches: matches.slice(0, 3).map(serializeMatch),
    applications: applicationRows.map(({ application, ...details }) =>
      serializeApplication({ ...application, ...details }),
    ),
    deadlines: deadlines.slice(0, 4).map(serializeMatch),
  };

  if (!user) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }
  res.json(GetDashboardResponse.parse(payload));
});

export default router;
