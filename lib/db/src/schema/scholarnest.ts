import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const usersTable = pgTable(
  "sn_users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("student"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("sn_users_email_lower_idx").on(table.email)],
);

export const sessionsTable = pgTable(
  "sn_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [index("sn_sessions_user_idx").on(table.userId)],
);

export const studentsTable = pgTable(
  "sn_students",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" })
      .unique(),
    fullName: text("full_name").notNull().default(""),
    age: integer("age"),
    state: text("state").notNull().default(""),
    district: text("district").notNull().default(""),
    course: text("course").notNull().default(""),
    branch: text("branch").notNull().default(""),
    year: text("year").notNull().default(""),
    collegeName: text("college_name").notNull().default(""),
    collegeType: text("college_type").notNull().default(""),
    cgpa: real("cgpa"),
    percentage: real("percentage"),
    annualFamilyIncome: integer("annual_family_income"),
    category: text("category").notNull().default(""),
    gender: text("gender").notNull().default(""),
    disabilityStatus: boolean("disability_status").notNull().default(false),
    minorityStatus: boolean("minority_status").notNull().default(false),
    ruralUrban: text("rural_urban").notNull().default(""),
    previousScholarship: boolean("previous_scholarship")
      .notNull()
      .default(false),
    achievements: text("achievements").notNull().default(""),
    updatedAt: updatedAt(),
  },
  (table) => [index("sn_students_state_course_idx").on(table.state, table.course)],
);

export const scholarshipsTable = pgTable(
  "sn_scholarships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    provider: text("provider").notNull(),
    description: text("description").notNull(),
    amount: integer("amount").notNull().default(0),
    courseEligibility: jsonb("course_eligibility")
      .$type<string[]>()
      .notNull()
      .default([]),
    minimumCgpa: real("minimum_cgpa"),
    maximumIncome: integer("maximum_income"),
    eligibleStates: jsonb("eligible_states")
      .$type<string[]>()
      .notNull()
      .default([]),
    eligibleCategories: jsonb("eligible_categories")
      .$type<string[]>()
      .notNull()
      .default([]),
    genderRequirement: text("gender_requirement"),
    ageMinimum: integer("age_minimum"),
    ageMaximum: integer("age_maximum"),
    requiredDocuments: jsonb("required_documents")
      .$type<string[]>()
      .notNull()
      .default([]),
    deadline: date("deadline"),
    officialUrl: text("official_url"),
    applicationMethod: text("application_method").notNull().default(""),
    verified: boolean("verified").notNull().default(false),
    demoData: boolean("demo_data").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("sn_scholarships_deadline_idx").on(table.deadline),
    index("sn_scholarships_demo_idx").on(table.demoData),
    uniqueIndex("sn_scholarships_name_provider_idx").on(
      table.name,
      table.provider,
    ),
  ],
);

export const savedScholarshipsTable = pgTable(
  "sn_saved_scholarships",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    scholarshipId: uuid("scholarship_id")
      .notNull()
      .references(() => scholarshipsTable.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.scholarshipId] }),
    index("sn_saved_user_idx").on(table.userId),
  ],
);

export const applicationsTable = pgTable(
  "sn_applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    scholarshipId: uuid("scholarship_id")
      .notNull()
      .references(() => scholarshipsTable.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("SAVED"),
    notes: text("notes").notNull().default(""),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("sn_applications_user_scholarship_idx").on(
      table.userId,
      table.scholarshipId,
    ),
    index("sn_applications_user_idx").on(table.userId),
  ],
);

export const documentsTable = pgTable(
  "sn_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    documentType: text("document_type").notNull(),
    fileName: text("file_name").notNull(),
    storagePath: text("storage_path").notNull().unique(),
    status: text("status").notNull().default("Uploaded"),
    extractedData: jsonb("extracted_data")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    uploadedAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("sn_documents_user_idx").on(table.userId)],
);

export const notificationsTable = pgTable(
  "sn_notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    message: text("message").notNull(),
    type: text("type").notNull().default("deadline"),
    read: boolean("read").notNull().default(false),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    index("sn_notifications_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const aiOutputsTable = pgTable(
  "sn_ai_outputs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    scholarshipId: uuid("scholarship_id").references(
      () => scholarshipsTable.id,
      { onDelete: "set null" },
    ),
    type: text("type").notNull(),
    inputHash: text("input_hash").notNull(),
    outputJson: jsonb("output_json")
      .$type<Record<string, unknown>>()
      .notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("sn_ai_outputs_cache_idx").on(
      table.userId,
      table.type,
      table.inputHash,
    ),
  ],
);
