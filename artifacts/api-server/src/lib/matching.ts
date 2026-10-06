import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  db,
  scholarshipsTable,
  studentsTable,
} from "@workspace/db";

type Scholarship = typeof scholarshipsTable.$inferSelect;
type Student = typeof studentsTable.$inferSelect;
type ScholarshipFilters = {
  q?: string;
  state?: string;
  course?: string;
  category?: string;
  maxIncome?: number;
  minCgpa?: number;
  sort?: string;
};

const normalize = (value: string | null | undefined) =>
  (value ?? "").trim().toLocaleLowerCase();

const includesAny = (values: string[], candidate: string) => {
  const normalizedCandidate = normalize(candidate);
  return values.some(
    (value) =>
      value === "All India" ||
      value === "All Courses" ||
      value === "All categories" ||
      normalize(value) === normalizedCandidate ||
      (normalizedCandidate.length > 0 &&
        normalize(value).includes(normalizedCandidate)) ||
      (normalizedCandidate.length > 0 &&
        normalizedCandidate.includes(normalize(value))),
  );
};

export function profileCompletion(profile: Student | undefined): number {
  if (!profile) return 0;
  const fields: unknown[] = [
    profile.fullName,
    profile.age,
    profile.state,
    profile.district,
    profile.course,
    profile.branch,
    profile.year,
    profile.collegeName,
    profile.collegeType,
    profile.cgpa,
    profile.percentage,
    profile.annualFamilyIncome,
    profile.category,
    profile.gender,
    profile.ruralUrban,
  ];
  const complete = fields.filter(
    (value) => value !== null && value !== undefined && String(value).trim() !== "",
  ).length;
  return Math.round((complete / fields.length) * 100);
}

export function asProfile(
  profile: Student,
): Student & { profileCompletion: number } {
  return { ...profile, profileCompletion: profileCompletion(profile) };
}

function scoreDimension(
  condition: boolean | null,
  missingProfile: boolean,
  points: number,
  requirement: string,
  matched: string[],
  missing: string[],
): number {
  if (condition === null) {
    matched.push(`No ${requirement.toLowerCase()} limit specified`);
    return points;
  }
  if (missingProfile) {
    missing.push(`Add your details to check ${requirement.toLowerCase()}`);
    return 0;
  }
  if (condition) {
    matched.push(requirement);
    return points;
  }
  missing.push(requirement);
  return 0;
}

export function scoreScholarship(
  profile: Student | undefined,
  scholarship: Scholarship,
) {
  const matchedRequirements: string[] = [];
  const missingRequirements: string[] = [];
  const academicCondition =
    scholarship.minimumCgpa === null
      ? null
      : profile?.cgpa == null
        ? false
        : profile.cgpa >= scholarship.minimumCgpa;
  const academic = scoreDimension(
    academicCondition,
    scholarship.minimumCgpa !== null && profile?.cgpa == null,
    25,
    scholarship.minimumCgpa === null
      ? "Academic requirement"
      : `Minimum CGPA ${scholarship.minimumCgpa}`,
    matchedRequirements,
    missingRequirements,
  );

  const incomeCondition =
    scholarship.maximumIncome === null
      ? null
      : profile?.annualFamilyIncome == null
        ? false
        : profile.annualFamilyIncome <= scholarship.maximumIncome;
  const income = scoreDimension(
    incomeCondition,
    scholarship.maximumIncome !== null && profile?.annualFamilyIncome == null,
    20,
    scholarship.maximumIncome === null
      ? "Income requirement"
      : `Annual family income up to ₹${scholarship.maximumIncome.toLocaleString("en-IN")}`,
    matchedRequirements,
    missingRequirements,
  );

  let course = 20;
  if (scholarship.courseEligibility.length > 0) {
    const courseMatch = profile?.course
      ? includesAny(
          scholarship.courseEligibility,
          `${profile.course} ${profile.branch}`,
        )
      : false;
    if (!profile?.course) {
      missingRequirements.push("Add your course to check course eligibility");
    } else if (courseMatch) {
      matchedRequirements.push("Your course is eligible");
    } else {
      course = 0;
      missingRequirements.push(
        `Eligible courses: ${scholarship.courseEligibility.join(", ")}`,
      );
    }
  } else {
    matchedRequirements.push("No course restriction");
  }

  let location = 15;
  if (
    scholarship.eligibleStates.length > 0 &&
    !scholarship.eligibleStates.some((state) => normalize(state) === "all india")
  ) {
    if (!profile?.state) {
      location = 0;
      missingRequirements.push("Add your state to check location eligibility");
    } else if (includesAny(scholarship.eligibleStates, profile.state)) {
      matchedRequirements.push(`Available in ${profile.state}`);
    } else {
      location = 0;
      missingRequirements.push(
        `Available in: ${scholarship.eligibleStates.join(", ")}`,
      );
    }
  } else {
    matchedRequirements.push("Open across India");
  }

  let category = 10;
  if (
    scholarship.eligibleCategories.length > 0 &&
    !scholarship.eligibleCategories.some(
      (value) => normalize(value) === "all categories",
    )
  ) {
    if (!profile?.category) {
      category = 0;
      missingRequirements.push(
        "Add your category to check category eligibility",
      );
    } else if (
      includesAny(scholarship.eligibleCategories, profile.category)
    ) {
      matchedRequirements.push(`${profile.category} category is eligible`);
    } else {
      category = 0;
      missingRequirements.push(
        `Eligible categories: ${scholarship.eligibleCategories.join(", ")}`,
      );
    }
  } else {
    matchedRequirements.push("No category restriction");
  }

  let other = 10;
  const otherChecks: Array<{ configured: boolean; value: boolean | null; text: string }> = [
    {
      configured: scholarship.genderRequirement !== null,
      value:
        scholarship.genderRequirement === null
          ? null
          : profile?.gender
            ? normalize(profile.gender) === normalize(scholarship.genderRequirement)
            : false,
      text: scholarship.genderRequirement
        ? `Gender requirement: ${scholarship.genderRequirement}`
        : "",
    },
    {
      configured: scholarship.ageMinimum !== null,
      value:
        scholarship.ageMinimum === null
          ? null
          : profile?.age == null
            ? false
            : profile.age >= scholarship.ageMinimum,
      text: scholarship.ageMinimum
        ? `Minimum age: ${scholarship.ageMinimum}`
        : "",
    },
    {
      configured: scholarship.ageMaximum !== null,
      value:
        scholarship.ageMaximum === null
          ? null
          : profile?.age == null
            ? false
            : profile.age <= scholarship.ageMaximum,
      text: scholarship.ageMaximum
        ? `Maximum age: ${scholarship.ageMaximum}`
        : "",
    },
  ].filter((check) => check.configured);
  if (otherChecks.length) {
    const perCheck = 10 / otherChecks.length;
    other = 0;
    for (const check of otherChecks) {
      if (check.value === null) {
        other += perCheck;
      } else if (check.value) {
        other += perCheck;
        matchedRequirements.push(check.text);
      } else if (
        (check.text.startsWith("Gender") && !profile?.gender) ||
        (check.text.startsWith("Minimum age") && profile?.age == null) ||
        (check.text.startsWith("Maximum age") && profile?.age == null)
      ) {
        missingRequirements.push(`Add your details to check ${check.text.toLowerCase()}`);
      } else {
        missingRequirements.push(check.text);
      }
    }
    other = Math.round(other);
  } else {
    matchedRequirements.push("No additional restrictions");
  }

  const matchScore = academic + income + course + location + category + other;
  const eligible = missingRequirements.length === 0;
  const matchLabel =
    matchScore >= 80
      ? "Strong Match"
      : matchScore >= 60
        ? "Good Match"
        : matchScore >= 40
          ? "Possible Match"
          : "Not Eligible";
  return {
    ...scholarship,
    matchScore,
    eligible,
    matchLabel,
    breakdown: {
      academic,
      income,
      course,
      location,
      category,
      other,
    },
    matchedRequirements,
    missingRequirements,
  };
}

export async function getStudent(userId: string): Promise<Student | undefined> {
  const [profile] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.userId, userId))
    .limit(1);
  return profile;
}

export async function listScholarshipMatches(
  userId: string,
  filters: ScholarshipFilters = {},
) {
  const conditions = [];
  if (filters.q) {
    const search = `%${filters.q}%`;
    conditions.push(
      or(
        ilike(scholarshipsTable.name, search),
        ilike(scholarshipsTable.provider, search),
        ilike(scholarshipsTable.description, search),
      ),
    );
  }
  if (filters.state) {
    const states = JSON.stringify([filters.state]);
    conditions.push(
      sql`(${scholarshipsTable.eligibleStates} = '[]'::jsonb OR ${scholarshipsTable.eligibleStates} @> ${states}::jsonb OR ${scholarshipsTable.eligibleStates} @> '["All India"]'::jsonb)`,
    );
  }
  if (filters.course) {
    const courses = JSON.stringify([filters.course]);
    conditions.push(
      sql`(${scholarshipsTable.courseEligibility} = '[]'::jsonb OR ${scholarshipsTable.courseEligibility} @> ${courses}::jsonb OR ${scholarshipsTable.courseEligibility} @> '["All Courses"]'::jsonb)`,
    );
  }
  if (filters.category) {
    const categories = JSON.stringify([filters.category]);
    conditions.push(
      sql`(${scholarshipsTable.eligibleCategories} = '[]'::jsonb OR ${scholarshipsTable.eligibleCategories} @> ${categories}::jsonb OR ${scholarshipsTable.eligibleCategories} @> '["All categories"]'::jsonb)`,
    );
  }
  if (filters.maxIncome !== undefined) {
    conditions.push(
      or(
        sql`${scholarshipsTable.maximumIncome} IS NULL`,
        sql`${scholarshipsTable.maximumIncome} >= ${filters.maxIncome}`,
      ),
    );
  }
  if (filters.minCgpa !== undefined) {
    conditions.push(
      or(
        sql`${scholarshipsTable.minimumCgpa} IS NULL`,
        sql`${scholarshipsTable.minimumCgpa} <= ${filters.minCgpa}`,
      ),
    );
  }

  const profile = await getStudent(userId);
  const query = db.select().from(scholarshipsTable);
  let records: Scholarship[];
  if (conditions.length) {
    records = await query.where(and(...conditions));
  } else if (filters.sort === "amount") {
    records = await query.orderBy(desc(scholarshipsTable.amount));
  } else if (filters.sort === "deadline") {
    records = await query.orderBy(asc(scholarshipsTable.deadline));
  } else if (filters.sort === "recent") {
    records = await query.orderBy(desc(scholarshipsTable.createdAt));
  } else {
    records = await query;
  }

  const matches = records.map((record) => scoreScholarship(profile, record));
  if (filters.sort === "amount") {
    matches.sort((a, b) => b.amount - a.amount);
  } else if (filters.sort === "deadline") {
    matches.sort(
      (a, b) =>
        (a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER) -
        (b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER),
    );
  } else if (filters.sort === "recent") {
    matches.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  } else {
    matches.sort((a, b) => b.matchScore - a.matchScore);
  }
  return matches;
}
