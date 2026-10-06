import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import { ensureDocumentsBucket } from "./lib/supabase";
import { seedDemoScholarships } from "./lib/seed-scholarships";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function startServer(): Promise<void> {
  try {
    await pool.query("select 1");
    await ensureDocumentsBucket();
    await seedDemoScholarships();
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
    });
  } catch (error) {
    logger.error(
      { message: error instanceof Error ? error.message : "Startup failed" },
      "API server could not initialize",
    );
    process.exit(1);
  }
}

void startServer();
