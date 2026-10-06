import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  studentsTable,
} from "@workspace/db";
import {
  GetStudentProfileResponse,
  UpdateStudentProfileBody,
  UpdateStudentProfileResponse,
} from "@workspace/api-zod";
import { authMiddleware } from "../middlewares/auth";
import { asProfile, getStudent } from "../lib/matching";
import { serializeProfile } from "../lib/serializers";

const router: IRouter = Router();
router.use(authMiddleware);

router.get("/students/profile", async (req, res): Promise<void> => {
  const profile = await getStudent(req.authUser!.id);
  if (!profile) {
    res.status(404).json({ error: "Student profile not found." });
    return;
  }
  res.json(GetStudentProfileResponse.parse(serializeProfile(asProfile(profile))));
});

router.put("/students/profile", async (req, res): Promise<void> => {
  const parsed = UpdateStudentProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check the profile fields and try again." });
    return;
  }

  const [profile] = await db
    .insert(studentsTable)
    .values({
      userId: req.authUser!.id,
      ...parsed.data,
    })
    .onConflictDoUpdate({
      target: studentsTable.userId,
      set: { ...parsed.data, updatedAt: new Date() },
    })
    .returning();

  res.json(
    UpdateStudentProfileResponse.parse(
      serializeProfile(asProfile(profile)),
    ),
  );
});

export default router;
