import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for private document storage.",
  );
}

export const DOCUMENTS_BUCKET =
  process.env.SUPABASE_DOCUMENTS_BUCKET ?? "scholarnest-documents";

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function ensureDocumentsBucket(): Promise<void> {
  const { data, error } = await supabaseAdmin.storage.getBucket(DOCUMENTS_BUCKET);
  if (!error && data) return;

  const created = await supabaseAdmin.storage.createBucket(DOCUMENTS_BUCKET, {
    public: false,
    fileSizeLimit: 8 * 1024 * 1024,
    allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
  });
  if (created.error && !/already exists|duplicate/i.test(created.error.message)) {
    throw new Error(`Could not configure private document storage: ${created.error.message}`);
  }
}
