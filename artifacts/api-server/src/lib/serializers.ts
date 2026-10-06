import type {
  Application,
  Scholarship,
  ScholarshipMatch,
  StudentDocument,
  StudentProfile,
} from "@workspace/api-zod";
import type {
  applicationsTable,
  documentsTable,
  scholarshipsTable,
  studentsTable,
} from "@workspace/db";

type ScholarshipRow = typeof scholarshipsTable.$inferSelect;
type StudentRow = typeof studentsTable.$inferSelect;
type ApplicationRow = typeof applicationsTable.$inferSelect;
type DocumentRow = typeof documentsTable.$inferSelect;

const asDate = (value: Date | string | null): Date | null => {
  if (value === null) return null;
  if (value instanceof Date) return value;
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00.000Z`)
    : new Date(value);
};

export function serializeScholarship(row: ScholarshipRow): Scholarship {
  return {
    ...row,
    deadline: asDate(row.deadline),
    createdAt: row.createdAt,
  };
}

export function serializeMatch(
  row: ReturnType<
    typeof import("./matching").scoreScholarship
  >,
): ScholarshipMatch {
  return {
    ...serializeScholarship(row),
    matchScore: row.matchScore,
    eligible: row.eligible,
    matchLabel: row.matchLabel as ScholarshipMatch["matchLabel"],
    breakdown: row.breakdown,
    matchedRequirements: row.matchedRequirements,
    missingRequirements: row.missingRequirements,
  };
}

export function serializeProfile(
  row: StudentRow & { profileCompletion: number },
): StudentProfile {
  return {
    id: row.id,
    userId: row.userId,
    fullName: row.fullName,
    age: row.age,
    state: row.state,
    district: row.district,
    course: row.course,
    branch: row.branch,
    year: row.year,
    collegeName: row.collegeName,
    collegeType: row.collegeType,
    cgpa: row.cgpa,
    percentage: row.percentage,
    annualFamilyIncome: row.annualFamilyIncome,
    category: row.category,
    gender: row.gender,
    disabilityStatus: row.disabilityStatus,
    minorityStatus: row.minorityStatus,
    ruralUrban: row.ruralUrban as StudentProfile["ruralUrban"],
    previousScholarship: row.previousScholarship,
    achievements: row.achievements,
    profileCompletion: row.profileCompletion,
    updatedAt: row.updatedAt,
  };
}

export function serializeApplication(
  row: ApplicationRow & {
    scholarshipName: string;
    provider: string;
    deadline: string | null;
  },
): Application {
  return {
    id: row.id,
    scholarshipId: row.scholarshipId,
    scholarshipName: row.scholarshipName,
    provider: row.provider,
    deadline: asDate(row.deadline),
    status: row.status as Application["status"],
    notes: row.notes,
    appliedAt: row.appliedAt,
    updatedAt: row.updatedAt,
  };
}

export function serializeDocument(row: DocumentRow): StudentDocument {
  return {
    id: row.id,
    fileName: row.fileName,
    documentType: row.documentType as StudentDocument["documentType"],
    status: row.status as StudentDocument["status"],
    uploadedAt: row.uploadedAt,
    storagePath: row.storagePath,
  };
}
