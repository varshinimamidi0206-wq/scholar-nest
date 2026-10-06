import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  aiOutputsTable,
  db,
  documentsTable,
  scholarshipsTable,
} from "@workspace/db";
import {
  AnalyzeDocumentBody,
  AnalyzeDocumentResponse,
  AskNestGuideBody,
  AskNestGuideResponse,
  ExplainEligibilityBody,
  ExplainEligibilityResponse,
} from "@workspace/api-zod";
import { authMiddleware } from "../middlewares/auth";
import { getStudent, listScholarshipMatches, scoreScholarship } from "../lib/matching";
import { serializeMatch } from "../lib/serializers";
import { DOCUMENTS_BUCKET, supabaseAdmin } from "../lib/supabase";

const router: IRouter = Router();
router.use(authMiddleware);

const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const geminiKey = process.env.GEMINI_API_KEY;

const DocumentAnalysisPayload = z.object({
  documentType: z.string().min(1).max(100),
  studentName: z.string().nullable(),
  annualIncome: z.number().nonnegative().nullable(),
  institution: z.string().nullable(),
  academicYear: z.string().nullable(),
  issueDate: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  possibleIssues: z.array(z.string().max(300)).max(12),
});

type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

async function askGemini(parts: GeminiPart[]): Promise<string> {
  if (!geminiKey) {
    throw new Error("Gemini is not configured.");
  }
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`Gemini request failed with status ${response.status}.`);
  }
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!text) throw new Error("Gemini returned an empty response.");
  return text;
}

function hashInput(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function cachedOutput<T>(
  userId: string,
  scholarshipId: string | null,
  type: string,
  input: unknown,
  validator: z.ZodType<T>,
  generate: () => Promise<T>,
): Promise<T> {
  const inputHash = hashInput(input);
  const [cached] = await db
    .select({ outputJson: aiOutputsTable.outputJson, createdAt: aiOutputsTable.createdAt })
    .from(aiOutputsTable)
    .where(
      and(
        eq(aiOutputsTable.userId, userId),
        eq(aiOutputsTable.type, type),
        eq(aiOutputsTable.inputHash, inputHash),
      ),
    )
    .limit(1);

  if (
    cached &&
    Date.now() - cached.createdAt.getTime() < 30 * 24 * 60 * 60 * 1000
  ) {
    const parsedCache = validator.safeParse(cached.outputJson);
    if (parsedCache.success) return parsedCache.data;
  }

  const generated = validator.parse(await generate());
  await db
    .insert(aiOutputsTable)
    .values({
      userId,
      scholarshipId,
      type,
      inputHash,
      outputJson: generated as Record<string, unknown>,
    })
    .onConflictDoUpdate({
      target: [
        aiOutputsTable.userId,
        aiOutputsTable.type,
        aiOutputsTable.inputHash,
      ],
      set: {
        outputJson: generated as Record<string, unknown>,
        createdAt: new Date(),
      },
    });
  return generated;
}

router.post("/ai/eligibility-explanation", async (req, res): Promise<void> => {
  const parsed = ExplainEligibilityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Scholarship ID is invalid." });
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
  const userId = req.authUser!.id;
  const profile = await getStudent(userId);
  const match = serializeMatch(scoreScholarship(profile, scholarship));
  const input = {
    scholarship: {
      name: scholarship.name,
      provider: scholarship.provider,
      amount: scholarship.amount,
      deadline: scholarship.deadline,
    },
    deterministicMatch: {
      eligible: match.eligible,
      score: match.matchScore,
      breakdown: match.breakdown,
      matchedRequirements: match.matchedRequirements,
      missingRequirements: match.missingRequirements,
    },
  };
  const fallback = {
    eligible: match.eligible,
    matchSummary: match.eligible
      ? `Your current profile meets the listed requirements for ${scholarship.name}.`
      : `Your current profile does not yet meet every listed requirement for ${scholarship.name}.`,
    reasons: match.matchedRequirements,
    missingRequirements: match.missingRequirements,
    nextSteps: [
      "Review each requirement on the scholarship provider's official page.",
      "Keep your profile and documents up to date before you apply.",
    ],
  };
  let explanation = fallback;
  try {
    explanation = await cachedOutput(
      userId,
      scholarship.id,
      "eligibility-explanation",
      input,
      ExplainEligibilityResponse,
      async () => {
        const text = await askGemini([
          {
            text: `Explain the student's deterministic scholarship match in plain, supportive language. Treat the eligibility, score, matched requirements, and missing requirements below as fixed facts; do not change eligibility, infer unstated criteria, invent an official URL, or claim this verifies an application. Respond only as JSON with keys eligible (boolean copied exactly), matchSummary (short string), reasons (string array), missingRequirements (string array copied faithfully), and nextSteps (string array). Context: ${JSON.stringify(input)}`,
          },
        ]);
        return ExplainEligibilityResponse.parse(JSON.parse(text));
      },
    );
  } catch (error) {
    req.log.warn(
      { message: error instanceof Error ? error.message : "AI unavailable" },
      "Eligibility explanation used its deterministic fallback",
    );
  }
  res.json(ExplainEligibilityResponse.parse(explanation));
});

router.post("/ai/assistant", async (req, res): Promise<void> => {
  const parsed = AskNestGuideBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Question details are invalid." });
    return;
  }
  const userId = req.authUser!.id;
  const profile = await getStudent(userId);
  const matches = (await listScholarshipMatches(userId)).slice(0, 4);
  const context = {
    language: parsed.data.language,
    profile: profile
      ? {
          state: profile.state,
          course: profile.course,
          year: profile.year,
          category: profile.category,
          cgpa: profile.cgpa,
        }
      : null,
    scholarships: matches.map((match) => ({
      name: match.name,
      provider: match.provider,
      amount: match.amount,
      deadline: match.deadline,
      eligible: match.eligible,
      matchScore: match.matchScore,
      missingRequirements: match.missingRequirements,
    })),
  };
  const input = { question: parsed.data.question, context };
  const fallback = {
    answer:
      "I can help with scholarship requirements, matching, applications, and deadlines. Please check each provider's official page for the latest rules.",
  };
  let result = fallback;
  try {
    result = await cachedOutput(
      userId,
      null,
      "nest-guide",
      input,
      AskNestGuideResponse,
      async () => {
        const text = await askGemini([
          {
            text: `You are NestGuide, a careful scholarship assistant. Answer the student's question in ${parsed.data.language}. Use only the supplied profile and scholarship context. Do not invent application URLs, deadlines, official verification, or policy details. Say clearly when the context is insufficient and direct the student to a provider's official page for authoritative information. Keep it helpful and concise. Respond only as JSON with one string field named answer. Context: ${JSON.stringify(input)}`,
          },
        ]);
        return AskNestGuideResponse.parse(JSON.parse(text));
      },
    );
  } catch (error) {
    req.log.warn(
      { message: error instanceof Error ? error.message : "AI unavailable" },
      "NestGuide used its safe fallback",
    );
  }
  res.json(AskNestGuideResponse.parse(result));
});

router.post("/ai/document-analysis", async (req, res): Promise<void> => {
  const parsed = AnalyzeDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Document ID is invalid." });
    return;
  }
  const [document] = await db
    .select()
    .from(documentsTable)
    .where(
      and(
        eq(documentsTable.id, parsed.data.documentId),
        eq(documentsTable.userId, req.authUser!.id),
      ),
    )
    .limit(1);
  if (!document) {
    res.status(404).json({ error: "Document not found." });
    return;
  }
  const extension = document.fileName.split(".").pop()?.toLowerCase();
  const mimeType =
    extension === "pdf"
      ? "application/pdf"
      : extension === "png"
        ? "image/png"
        : extension === "jpg" || extension === "jpeg"
          ? "image/jpeg"
          : null;
  if (!mimeType) {
    res.status(415).json({ error: "Only PDF, PNG, and JPEG documents can be analyzed." });
    return;
  }
  const { data: file, error } = await supabaseAdmin.storage
    .from(DOCUMENTS_BUCKET)
    .download(document.storagePath);
  if (error || !file) {
    res.status(404).json({ error: "The stored document could not be opened." });
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    res.status(413).json({ error: "Document analysis is limited to files under 8 MB." });
    return;
  }
  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const text = await askGemini([
      {
        text: "Extract only visible, legible fields from this student document. Return JSON with documentType, studentName, annualIncome, institution, academicYear, issueDate, confidence from 0 to 1, and possibleIssues. Use null for unreadable or absent values. Do not decide whether the document is genuine, valid, or officially verified. Mention ambiguity in possibleIssues.",
      },
      { inline_data: { mime_type: mimeType, data: base64 } },
    ]);
    const analysis = AnalyzeDocumentResponse.parse(
      DocumentAnalysisPayload.parse(JSON.parse(text)),
    );
    res.json(analysis);
  } catch (error) {
    req.log.warn(
      { message: error instanceof Error ? error.message : "Analysis failed" },
      "Document analysis failed",
    );
    res.status(503).json({ error: "Document analysis is temporarily unavailable." });
  }
});

export default router;
