---
name: Supabase database connectivity
description: Replit runtime network compatibility for this project's Supabase PostgreSQL connection.
---

Configure `SUPABASE_DB_URL` with the Supabase Session Pooler URI on port 5432, rather than the direct `db.<project-ref>.supabase.co` connection. The direct database host resolves only to IPv6, while this runtime has no IPv6 support.

**Why:** API startup and Drizzle schema push both failed with `getaddrinfo ENOTFOUND` for the direct host; direct IPv6 socket attempts failed with `EAFNOSUPPORT`.

**How to apply:** If database access fails, use the Supabase dashboard's Session Pooler connection URI, restart the API workflow, and retry the additive Drizzle schema push. Do not replace the requested Supabase database with another provider.
