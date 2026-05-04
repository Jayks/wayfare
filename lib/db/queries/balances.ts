import { db } from "@/lib/db/client";
import { expenses } from "@/lib/db/schema/expenses";
import { expenseSplits } from "@/lib/db/schema/expense-splits";
import { settlements } from "@/lib/db/schema/settlements";
import { tripMembers } from "@/lib/db/schema/trip-members";
import { eq, sum, and } from "drizzle-orm";
import { optimizeSettlements } from "@/lib/settle/optimize";
import { getMemberName } from "@/lib/utils";

export interface MemberBalanceRow {
  memberId: string;
  displayName: string;
  totalPaid: number;
  totalOwed: number;
  settlementsSent: number;
  settlementsReceived: number;
  net: number; // positive = owed money, negative = owes money
}

export async function getBalances(tripId: string) {
  const members = await db
    .select()
    .from(tripMembers)
    .where(eq(tripMembers.tripId, tripId));

  const rows: MemberBalanceRow[] = await Promise.all(
    members.map(async (member) => {
      // Total paid by this member
      const [paid] = await db
        .select({ total: sum(expenses.amount) })
        .from(expenses)
        .where(and(eq(expenses.tripId, tripId), eq(expenses.paidByMemberId, member.id)));

      // Total owed by this member (their share of all expenses)
      const [owed] = await db
        .select({ total: sum(expenseSplits.shareAmount) })
        .from(expenseSplits)
        .innerJoin(expenses, eq(expenseSplits.expenseId, expenses.id))
        .where(and(eq(expenses.tripId, tripId), eq(expenseSplits.memberId, member.id)));

      // Settlements this member sent (paid off debts)
      const [sent] = await db
        .select({ total: sum(settlements.amount) })
        .from(settlements)
        .where(and(eq(settlements.tripId, tripId), eq(settlements.fromMemberId, member.id)));

      // Settlements this member received
      const [received] = await db
        .select({ total: sum(settlements.amount) })
        .from(settlements)
        .where(and(eq(settlements.tripId, tripId), eq(settlements.toMemberId, member.id)));

      const totalPaid        = Number(paid?.total ?? 0);
      const totalOwed        = Number(owed?.total ?? 0);
      const settlementsSent  = Number(sent?.total ?? 0);
      const settlementsRecvd = Number(received?.total ?? 0);

      // sent: you paid someone → reduces your debt → adds to net
      // received: someone paid you → your receivable shrinks → subtracts from net
      const net = totalPaid - totalOwed + settlementsSent - settlementsRecvd;

      return {
        memberId: member.id,
        displayName: getMemberName(member),
        totalPaid,
        totalOwed,
        settlementsSent,
        settlementsReceived: settlementsRecvd,
        net: Math.round(net * 100) / 100,
      };
    })
  );

  const suggestions = optimizeSettlements(rows.map((r) => ({ memberId: r.memberId, net: r.net })));

  return { balances: rows, suggestions };
}

export async function getSettlements(tripId: string) {
  return db
    .select()
    .from(settlements)
    .where(eq(settlements.tripId, tripId))
    .orderBy(settlements.settledAt);
}
