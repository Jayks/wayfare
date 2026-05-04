/**
 * One-time backfill: sets display_name on trip_members rows for real users
 * who joined before the display_name column was populated at join time.
 *
 * Usage: pnpm exec tsx --env-file=.env.local scripts/backfill-display-names.ts
 */
import { db } from "../lib/db/client";
import { tripMembers } from "../lib/db/schema/trip-members";
import { createAdminClient } from "../lib/supabase/admin";
import { isNull, isNotNull, eq } from "drizzle-orm";

async function main() {
  const admin = createAdminClient();

  const rows = await db
    .select({ id: tripMembers.id, userId: tripMembers.userId })
    .from(tripMembers)
    .where(isNull(tripMembers.displayName));

  const realUsers = rows.filter((r) => r.userId != null) as { id: string; userId: string }[];

  if (realUsers.length === 0) {
    console.log("Nothing to backfill — all real-user members already have display_name.");
    process.exit(0);
  }

  console.log(`Backfilling display_name for ${realUsers.length} member row(s)...\n`);

  let updated = 0;
  for (const row of realUsers) {
    const { data, error } = await admin.auth.admin.getUserById(row.userId);
    if (error || !data.user) {
      console.warn(`  ⚠  Could not fetch user ${row.userId}: ${error?.message}`);
      continue;
    }
    const fullName: string | undefined = data.user.user_metadata?.full_name;
    if (!fullName) {
      console.warn(`  ⚠  User ${row.userId} has no full_name in metadata`);
      continue;
    }
    await db
      .update(tripMembers)
      .set({ displayName: fullName })
      .where(eq(tripMembers.id, row.id));
    console.log(`  ✅  member ${row.id} → "${fullName}"`);
    updated++;
  }

  console.log(`\nDone — ${updated} row(s) updated.`);
  process.exit(0);
}

main().catch((e) => { console.error("❌ Backfill failed:", e); process.exit(1); });
