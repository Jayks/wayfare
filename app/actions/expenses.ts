"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { expenses } from "@/lib/db/schema/expenses";
import { expenseSplits } from "@/lib/db/schema/expense-splits";
import { addExpenseSchema, type AddExpenseInput } from "@/lib/validations/expense";
import { computeSplits } from "@/lib/splits/compute";
import { eq } from "drizzle-orm";
import { getMembership } from "@/lib/db/queries/auth";
import { revalidatePath } from "next/cache";

export async function addExpense(input: AddExpenseInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" } as const;

  const parsed = addExpenseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" } as const;

  const { tripId, paidByMemberId, description, category, amount, currency, expenseDate, endDate, notes, splitMode, splits } = parsed.data;

  const membership = await getMembership(tripId, user.id);
  if (!membership) return { ok: false, error: "Not a member" } as const;

  const result = computeSplits(splitMode, amount, splits);
  if (!result.ok) return { ok: false, error: result.error } as const;

  const [expense] = await db.insert(expenses).values({
    tripId,
    paidByMemberId,
    description,
    category,
    amount: String(amount),
    currency,
    expenseDate,
    endDate: endDate || null,
    notes: notes || null,
    createdByUserId: user.id,
  }).returning();

  await db.insert(expenseSplits).values(
    result.splits.map((s) => ({
      expenseId: expense.id,
      memberId: s.memberId,
      shareAmount: String(s.shareAmount),
      splitType: splitMode,
      splitValue: s.splitValue != null ? String(s.splitValue) : null,
    }))
  );

  revalidatePath(`/trips/${tripId}/expenses`);
  return { ok: true, expenseId: expense.id } as const;
}

export async function updateExpense(expenseId: string, input: AddExpenseInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" } as const;

  const parsed = addExpenseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" } as const;

  const { tripId, paidByMemberId, description, category, amount, currency, expenseDate, endDate, notes, splitMode, splits } = parsed.data;

  const [expense] = await db.select().from(expenses).where(eq(expenses.id, expenseId));
  if (!expense) return { ok: false, error: "Not found" } as const;
  if (expense.tripId !== tripId) return { ok: false, error: "Not found" } as const;

  const membership = await getMembership(tripId, user.id);
  if (!membership) return { ok: false, error: "Not a member" } as const;
  if (expense.createdByUserId !== user.id && membership.role !== "admin")
    return { ok: false, error: "Not authorized" } as const;

  const result = computeSplits(splitMode, amount, splits);
  if (!result.ok) return { ok: false, error: result.error } as const;

  await db.update(expenses).set({
    paidByMemberId, description, category,
    amount: String(amount), currency, expenseDate,
    endDate: endDate || null,
    notes: notes || null,
    updatedAt: new Date(),
  }).where(eq(expenses.id, expenseId));

  await db.delete(expenseSplits).where(eq(expenseSplits.expenseId, expenseId));
  await db.insert(expenseSplits).values(
    result.splits.map((s) => ({
      expenseId,
      memberId: s.memberId,
      shareAmount: String(s.shareAmount),
      splitType: splitMode,
      splitValue: s.splitValue != null ? String(s.splitValue) : null,
    }))
  );

  revalidatePath(`/trips/${tripId}/expenses`);
  return { ok: true } as const;
}

export async function duplicateExpense(expenseId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" } as const;

  const [expense] = await db.select().from(expenses).where(eq(expenses.id, expenseId));
  if (!expense) return { ok: false, error: "Not found" } as const;

  const membership = await getMembership(expense.tripId, user.id);
  if (!membership) return { ok: false, error: "Not a member" } as const;
  if (membership.role !== "admin") return { ok: false, error: "Not authorized" } as const;

  const originalSplits = await db.select().from(expenseSplits)
    .where(eq(expenseSplits.expenseId, expenseId));

  const today = new Date().toISOString().split("T")[0];

  const [newExpense] = await db.insert(expenses).values({
    tripId: expense.tripId,
    paidByMemberId: expense.paidByMemberId,
    description: `${expense.description} (copy)`,
    category: expense.category,
    amount: expense.amount,
    currency: expense.currency,
    expenseDate: today,
    endDate: expense.endDate,
    notes: expense.notes,
    createdByUserId: user.id,
  }).returning();

  if (originalSplits.length > 0) {
    await db.insert(expenseSplits).values(
      originalSplits.map((s) => ({
        expenseId: newExpense.id,
        memberId: s.memberId,
        shareAmount: s.shareAmount,
        splitType: s.splitType,
        splitValue: s.splitValue,
      }))
    );
  }

  revalidatePath(`/trips/${expense.tripId}/expenses`);
  return { ok: true, expenseId: newExpense.id } as const;
}

export async function deleteExpense(expenseId: string, tripId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" } as const;

  const [expense] = await db.select().from(expenses).where(eq(expenses.id, expenseId));
  if (!expense) return { ok: false, error: "Not found" } as const;

  const membership = await getMembership(tripId, user.id);
  if (!membership) return { ok: false, error: "Not a member" } as const;
  if (expense.createdByUserId !== user.id && membership.role !== "admin")
    return { ok: false, error: "Not authorized" } as const;

  await db.delete(expenses).where(eq(expenses.id, expenseId));
  revalidatePath(`/trips/${tripId}/expenses`);
  return { ok: true } as const;
}
