"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { settlements } from "@/lib/db/schema/settlements";
import { tripMembers } from "@/lib/db/schema/trip-members";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const recordSettlementSchema = z.object({
  tripId: z.string().uuid(),
  fromMemberId: z.string().uuid(),
  toMemberId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  note: z.string().max(200).optional(),
});

export async function recordSettlement(input: z.infer<typeof recordSettlementSchema>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" } as const;

  const parsed = recordSettlementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" } as const;

  const { tripId, fromMemberId, toMemberId, amount, currency, note } = parsed.data;

  // Verify user is a trip member
  const [membership] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, user.id)));
  if (!membership) return { ok: false, error: "Not a member" } as const;

  await db.insert(settlements).values({
    tripId,
    fromMemberId,
    toMemberId,
    amount: String(amount),
    currency,
    note: note || null,
  });

  revalidatePath(`/trips/${tripId}/settle`);
  return { ok: true } as const;
}

export async function deleteSettlement(settlementId: string, tripId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" } as const;

  const [membership] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, user.id)));
  if (!membership || membership.role !== "admin")
    return { ok: false, error: "Not authorized" } as const;

  await db.delete(settlements).where(eq(settlements.id, settlementId));
  revalidatePath(`/trips/${tripId}/settle`);
  return { ok: true } as const;
}
