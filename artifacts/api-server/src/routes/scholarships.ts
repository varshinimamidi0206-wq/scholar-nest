import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, scholarshipsTable } from "@workspace/db";
import {
  CreateScholarshipBody,
  CreateScholarshipResponse,
  DeleteScholarshipParams,
  GetScholarshipMatchesResponse,
  GetScholarshipParams,
  GetScholarshipResponse,
  ListScholarshipsQueryParams,
  ListScholarshipsResponse,
  UpdateScholarshipBody,
  UpdateScholarshipParams,
  UpdateScholarshipResponse,
} from "@workspace/api-zod";
import { authMiddleware, requireAdmin } from "../middlewares/auth";
import { getStudent, listScholarshipMatches, scoreScholarship } from "../lib/matching";
import { serializeMatch, serializeScholarship } from "../lib/serializers";

const router: IRouter = Router();
router.use(authMiddleware);

router.get("/scholarships", async (req, res): Promise<void> => {
  const parsed = ListScholarshipsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Search filters are invalid." });
    return;
  }
  const matches = await listScholarshipMatches(req.authUser!.id, parsed.data);
  res.json(ListScholarshipsResponse.parse(matches.map(serializeMatch)));
});

router.get("/scholarships/matches", async (req, res): Promise<void> => {
  const matches = await listScholarshipMatches(req.authUser!.id);
  res.json(GetScholarshipMatchesResponse.parse(matches.map(serializeMatch)));
});

router.get("/scholarships/:id", async (req, res): Promise<void> => {
  const parsed = GetScholarshipParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Scholarship ID is invalid." });
    return;
  }
  const [scholarship] = await db
    .select()
    .from(scholarshipsTable)
    .where(eq(scholarshipsTable.id, parsed.data.id))
    .limit(1);
  if (!scholarship) {
    res.status(404).json({ error: "Scholarship not found." });
    return;
  }
  const profile = await getStudent(req.authUser!.id);
  res.json(GetScholarshipResponse.parse(serializeMatch(scoreScholarship(profile, scholarship))));
});

router.post(
  "/scholarships",
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = CreateScholarshipBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Scholarship details are invalid." });
      return;
    }
    const values = {
      ...parsed.data,
      deadline: parsed.data.deadline
        ? parsed.data.deadline.toISOString().slice(0, 10)
        : null,
    };
    const [record] = await db
      .insert(scholarshipsTable)
      .values(values)
      .returning();
    res.status(201).json(CreateScholarshipResponse.parse(serializeScholarship(record)));
  },
);

router.patch(
  "/scholarships/:id",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = UpdateScholarshipParams.safeParse(req.params);
    const parsed = UpdateScholarshipBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: "Scholarship details are invalid." });
      return;
    }
    const values = {
      ...parsed.data,
      deadline: parsed.data.deadline
        ? parsed.data.deadline.toISOString().slice(0, 10)
        : null,
    };
    const [record] = await db
      .update(scholarshipsTable)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(scholarshipsTable.id, params.data.id))
      .returning();
    if (!record) {
      res.status(404).json({ error: "Scholarship not found." });
      return;
    }
    res.json(UpdateScholarshipResponse.parse(serializeScholarship(record)));
  },
);

router.delete(
  "/scholarships/:id",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = DeleteScholarshipParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Scholarship ID is invalid." });
      return;
    }
    const [record] = await db
      .delete(scholarshipsTable)
      .where(eq(scholarshipsTable.id, params.data.id))
      .returning({ id: scholarshipsTable.id });
    if (!record) {
      res.status(404).json({ error: "Scholarship not found." });
      return;
    }
    res.sendStatus(204);
  },
);

export default router;
