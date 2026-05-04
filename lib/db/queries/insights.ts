import { db } from "@/lib/db/client";
import { trips } from "@/lib/db/schema/trips";
import { tripMembers } from "@/lib/db/schema/trip-members";
import { expenses } from "@/lib/db/schema/expenses";
import { expenseSplits } from "@/lib/db/schema/expense-splits";
import { eq, sum, count, inArray } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { computeAllTripsInsights } from "@/lib/insights/all-trips-insights";
import type { TripSummary } from "@/lib/insights/all-trips-insights";

export async function getAllTripsInsightsData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // All trips the user is a member of
  const memberships = await db
    .select({ tripId: tripMembers.tripId })
    .from(tripMembers)
    .where(eq(tripMembers.userId, user.id));

  if (memberships.length === 0) return null;

  const tripIds = memberships.map((m) => m.tripId);

  const [userTrips, allMembers] = await Promise.all([
    db.select().from(trips).where(inArray(trips.id, tripIds)),
    db.select().from(tripMembers).where(inArray(tripMembers.tripId, tripIds)),
  ]);

  // Expense totals per trip
  const summaries: TripSummary[] = await Promise.all(
    userTrips.map(async (trip) => {
      const [totals] = await db
        .select({ total: sum(expenses.amount), cnt: count(expenses.id) })
        .from(expenses)
        .where(eq(expenses.tripId, trip.id));

      return {
        tripId: trip.id,
        name: trip.name,
        totalSpend: Number(totals?.total ?? 0),
        expenseCount: Number(totals?.cnt ?? 0),
        memberCount: allMembers.filter((m) => m.tripId === trip.id).length,
        currency: trip.defaultCurrency,
      };
    })
  );

  // Category totals across all trips
  const catRows = await db
    .select({ category: expenses.category, total: sum(expenses.amount) })
    .from(expenses)
    .where(inArray(expenses.tripId, tripIds))
    .groupBy(expenses.category);

  const categoryTotals: Record<string, number> = {};
  for (const row of catRows) {
    categoryTotals[row.category] = Number(row.total ?? 0);
  }

  return computeAllTripsInsights({ trips: userTrips, summaries, categoryTotals, allMembers, currentUserId: user.id });
}
