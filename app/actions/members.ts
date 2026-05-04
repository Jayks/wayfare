"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { trips } from "@/lib/db/schema/trips";
import { tripMembers } from "@/lib/db/schema/trip-members";
import { addGuestSchema } from "@/lib/validations/trip";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function addGuestMember(input: { tripId: string; guestName: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" } as const;

  const parsed = addGuestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" } as const;

  const { tripId, guestName } = parsed.data;

  const [membership] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, user.id)));

  if (!membership || membership.role !== "admin")
    return { ok: false, error: "Not authorized" } as const;

  const [member] = await db.insert(tripMembers).values({
    tripId,
    guestName,
    role: "member",
  }).returning();

  revalidatePath(`/trips/${tripId}/members`);
  return { ok: true, member } as const;
}

export async function removeMember(tripId: string, memberId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" } as const;

  const [membership] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, user.id)));

  if (!membership || membership.role !== "admin")
    return { ok: false, error: "Not authorized" } as const;

  await db.delete(tripMembers).where(eq(tripMembers.id, memberId));
  revalidatePath(`/trips/${tripId}/members`);
  return { ok: true } as const;
}

export async function joinTrip(token: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" } as const;

  const [trip] = await db.select().from(trips).where(eq(trips.shareToken, token));
  if (!trip) return { ok: false, error: "Invalid invite link" } as const;

  const [existing] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, trip.id), eq(tripMembers.userId, user.id)));

  if (existing) return { ok: true, tripId: trip.id } as const;

  const displayName = (user.user_metadata?.full_name as string | undefined)
    ?? user.email?.split("@")[0]
    ?? null;

  await db.insert(tripMembers).values({ tripId: trip.id, userId: user.id, displayName, role: "member" });

  revalidatePath("/trips");
  revalidatePath(`/trips/${trip.id}`);
  return { ok: true, tripId: trip.id } as const;
}
