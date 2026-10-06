import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import {
  applicationsTable,
  db,
  documentsTable,
  notificationsTable,
  savedScholarshipsTable,
  scholarshipsTable,
} from "@workspace/db";
import {
  CreateDocumentBody,
  CreateDocumentResponse,
  CreateApplicationBody,
  CreateApplicationResponse,
  DeleteApplicationParams,
  DeleteDocumentParams,
  ListApplicationsResponse,
  ListDocumentsResponse,
  ListSavedScholarshipsResponse,
  RequestDocumentUploadBody,
  RequestDocumentUploadResponse,
  RemoveSavedScholarshipParams,
  SaveScholarshipBody,
  SaveScholarshipResponse,
  UpdateApplicationBody,
  UpdateApplicationParams,
  UpdateApplicationResponse,
} from "@workspace/api-zod";
import { authMiddleware } from "../middlewares/auth";
import { getStudent, scoreScholarship } from "../lib/matching";
import {
  serializeApplication,
  serializeDocument,
  serializeMatch,
} from "../lib/serializers";
import { DOCUMENTS_BUCKET, supabaseAdmin } from "../lib/supabase";

const router: IRouter = Router();
router.use(authMiddleware);

router.get("/saved", async (req, res): Promise<void> => {
  const userId = req.authUser!.id;
  const [savedRows, profile] = await Promise.all([
    db
      .select({ scholarship: scholarshipsTable })
      .from(savedScholarshipsTable)
      .innerJoin(
        scholarshipsTable,
        eq(savedScholarshipsTable.scholarshipId, scholarshipsTable.id),
      )
      .where(eq(savedScholarshipsTable.userId, userId))
      .orderBy(desc(savedScholarshipsTable.createdAt)),
    getStudent(userId),
  ]);
  res.json(
    ListSavedScholarshipsResponse.parse(
      savedRows.map(({ scholarship }) =>
        serializeMatch(scoreScholarship(profile, scholarship)),
      ),
    ),
  );
});

router.post("/saved", async (req, res): Promise<void> => {
  const parsed = SaveScholarshipBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Scholarship ID is invalid." });
    return;
  }
  const userId = req.authUser!.id;
  const [scholarship] = await db
    .select()
    .from(scholarshipsTable)
    .where(eq(scholarshipsTable.id, parsed.data.scholarshipId))
    .limit(1);
  if (!scholarship) {
    res.status(404).json({ error: "Scholarship not found." });
    return;
  }
  await db
    .insert(savedScholarshipsTable)
    .values({ userId, scholarshipId: scholarship.id })
    .onConflictDoNothing();
  const profile = await getStudent(userId);
  res
    .status(201)
    .json(
      SaveScholarshipResponse.parse(
        serializeMatch(scoreScholarship(profile, scholarship)),
      ),
    );
});

router.delete("/saved/:scholarshipId", async (req, res): Promise<void> => {
  const parsed = RemoveSavedScholarshipParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Scholarship ID is invalid." });
    return;
  }
  await db
    .delete(savedScholarshipsTable)
    .where(
      and(
        eq(savedScholarshipsTable.userId, req.authUser!.id),
        eq(savedScholarshipsTable.scholarshipId, parsed.data.scholarshipId),
      ),
    );
  res.sendStatus(204);
});

async function getApplications(userId: string) {
  return db
    .select({
      application: applicationsTable,
      scholarshipName: scholarshipsTable.name,
      provider: scholarshipsTable.provider,
      deadline: scholarshipsTable.deadline,
    })
    .from(applicationsTable)
    .innerJoin(
      scholarshipsTable,
      eq(applicationsTable.scholarshipId, scholarshipsTable.id),
    )
    .where(eq(applicationsTable.userId, userId))
    .orderBy(desc(applicationsTable.updatedAt));
}

router.get("/applications", async (req, res): Promise<void> => {
  const rows = await getApplications(req.authUser!.id);
  res.json(
    ListApplicationsResponse.parse(
      rows.map(({ application, ...details }) =>
        serializeApplication({ ...application, ...details }),
      ),
    ),
  );
});

router.post("/applications", async (req, res): Promise<void> => {
  const parsed = CreateApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Application details are invalid." });
    return;
  }
  const [scholarship] = await db
    .select()
    .from(scholarshipsTable)
    .where(eq(scholarshipsTable.id, parsed.data.scholarshipId))
    .limit(1);
  if (!scholarship) {
    res.status(404).json({ error: "Scholarship not found." });
    return;
  }
  const [alreadyTracked] = await db
    .select({ id: applicationsTable.id })
    .from(applicationsTable)
    .where(
      and(
        eq(applicationsTable.userId, req.authUser!.id),
        eq(applicationsTable.scholarshipId, scholarship.id),
      ),
    )
    .limit(1);
  if (alreadyTracked) {
    res.status(409).json({ error: "This scholarship is already in your tracker." });
    return;
  }

  const status = parsed.data.status ?? "SAVED";
  const [application] = await db
    .insert(applicationsTable)
    .values({
      userId: req.authUser!.id,
      scholarshipId: scholarship.id,
      status,
      notes: parsed.data.notes ?? "",
      appliedAt: status === "APPLIED" ? new Date() : null,
    })
    .returning();
  await db.insert(notificationsTable).values({
    userId: req.authUser!.id,
    title: "Application added to your tracker",
    message: `${scholarship.name} is now in your application tracker.`,
    type: "application",
  });
  res.status(201).json(
    CreateApplicationResponse.parse(
      serializeApplication({
        ...application,
        scholarshipName: scholarship.name,
        provider: scholarship.provider,
        deadline: scholarship.deadline,
      }),
    ),
  );
});

router.patch("/applications/:id", async (req, res): Promise<void> => {
  const params = UpdateApplicationParams.safeParse(req.params);
  const parsed = UpdateApplicationBody.safeParse(req.body);
  if (!params.success || !parsed.success || !Object.keys(parsed.data).length) {
    res.status(400).json({ error: "Application update is invalid." });
    return;
  }
  const [existing] = await db
    .select({ appliedAt: applicationsTable.appliedAt })
    .from(applicationsTable)
    .where(
      and(
        eq(applicationsTable.id, params.data.id),
        eq(applicationsTable.userId, req.authUser!.id),
      ),
    )
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Application not found." });
    return;
  }
  const patch = {
    ...parsed.data,
    updatedAt: new Date(),
    ...(parsed.data.status === "APPLIED" && !existing.appliedAt
      ? { appliedAt: new Date() }
      : {}),
  };
  const [updated] = await db
    .update(applicationsTable)
    .set(patch)
    .where(
      and(
        eq(applicationsTable.id, params.data.id),
        eq(applicationsTable.userId, req.authUser!.id),
      ),
    )
    .returning();
  if (parsed.data.status) {
    await db.insert(notificationsTable).values({
      userId: req.authUser!.id,
      title: "Application status updated",
      message: `Your application status is now ${parsed.data.status.replaceAll("_", " ")}.`,
      type: "application",
    });
  }
  const [scholarship] = await db
    .select({
      name: scholarshipsTable.name,
      provider: scholarshipsTable.provider,
      deadline: scholarshipsTable.deadline,
    })
    .from(scholarshipsTable)
    .where(eq(scholarshipsTable.id, updated.scholarshipId))
    .limit(1);
  if (!scholarship) {
    res.status(404).json({ error: "Scholarship not found." });
    return;
  }
  res.json(
    UpdateApplicationResponse.parse(
      serializeApplication({
        ...updated,
        scholarshipName: scholarship.name,
        provider: scholarship.provider,
        deadline: scholarship.deadline,
      }),
    ),
  );
});

router.delete("/applications/:id", async (req, res): Promise<void> => {
  const parsed = DeleteApplicationParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Application ID is invalid." });
    return;
  }
  const [deleted] = await db
    .delete(applicationsTable)
    .where(
      and(
        eq(applicationsTable.id, parsed.data.id),
        eq(applicationsTable.userId, req.authUser!.id),
      ),
    )
    .returning({ id: applicationsTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Application not found." });
    return;
  }
  res.sendStatus(204);
});

router.get("/documents", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.userId, req.authUser!.id))
    .orderBy(desc(documentsTable.uploadedAt));
  res.json(ListDocumentsResponse.parse(rows.map(serializeDocument)));
});

router.post("/documents/upload-url", async (req, res): Promise<void> => {
  const parsed = RequestDocumentUploadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Upload details are invalid." });
    return;
  }
  if (
    !["application/pdf", "image/jpeg", "image/png"].includes(
      parsed.data.contentType,
    )
  ) {
    res.status(415).json({ error: "Upload a PDF, PNG, or JPEG document." });
    return;
  }
  const fileName = parsed.data.fileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
  const path = `${req.authUser!.id}/${randomUUID()}-${fileName}`;
  const { data, error } = await supabaseAdmin.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUploadUrl(path);
  if (error) {
    req.log.error({ error: error.message }, "Could not create document upload URL");
    res.status(503).json({ error: "Private document uploads are unavailable." });
    return;
  }
  res.json(
    RequestDocumentUploadResponse.parse({
      bucket: DOCUMENTS_BUCKET,
      path: data.path,
      token: data.token,
    }),
  );
});

router.post("/documents", async (req, res): Promise<void> => {
  const parsed = CreateDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Document details are invalid." });
    return;
  }
  const userPrefix = `${req.authUser!.id}/`;
  if (
    !parsed.data.storagePath.startsWith(userPrefix) ||
    parsed.data.storagePath.includes("..")
  ) {
    res.status(403).json({ error: "This upload does not belong to your account." });
    return;
  }
  const folder = req.authUser!.id;
  const fileName = parsed.data.storagePath.slice(userPrefix.length);
  const { data: objects, error: listError } = await supabaseAdmin.storage
    .from(DOCUMENTS_BUCKET)
    .list(folder, { search: fileName, limit: 1 });
  if (listError || !objects?.some((object) => object.name === fileName)) {
    res.status(400).json({ error: "Upload the file before saving its record." });
    return;
  }
  const [document] = await db
    .insert(documentsTable)
    .values({
      userId: req.authUser!.id,
      fileName: parsed.data.fileName,
      documentType: parsed.data.documentType,
      storagePath: parsed.data.storagePath,
      status: "Uploaded",
    })
    .returning();
  res.status(201).json(CreateDocumentResponse.parse(serializeDocument(document)));
});

router.delete("/documents/:id", async (req, res): Promise<void> => {
  const parsed = DeleteDocumentParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Document ID is invalid." });
    return;
  }
  const [document] = await db
    .select()
    .from(documentsTable)
    .where(
      and(
        eq(documentsTable.id, parsed.data.id),
        eq(documentsTable.userId, req.authUser!.id),
      ),
    )
    .limit(1);
  if (!document) {
    res.status(404).json({ error: "Document not found." });
    return;
  }
  const { error } = await supabaseAdmin.storage
    .from(DOCUMENTS_BUCKET)
    .remove([document.storagePath]);
  if (error) {
    req.log.error({ error: error.message }, "Could not remove private document");
    res.status(503).json({ error: "Document could not be deleted from storage." });
    return;
  }
  await db
    .delete(documentsTable)
    .where(eq(documentsTable.id, document.id));
  res.sendStatus(204);
});

export default router;
