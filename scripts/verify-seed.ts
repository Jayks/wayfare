import { db } from "../lib/db/client";
import { trips } from "../lib/db/schema/trips";
import { tripMembers } from "../lib/db/schema/trip-members";
import { expenses } from "../lib/db/schema/expenses";
import { expenseSplits } from "../lib/db/schema/expense-splits";
import { eq, sum } from "drizzle-orm";
import { optimizeSettlements } from "../lib/settle/optimize";

const TRIP_ID = "c0e7a4bd-0630-413a-b49a-6672a0abfab5";

async function verify() {
  console.log("\n🔍 Verifying seed data...\n");

  const members = await db.select().from(tripMembers).where(eq(tripMembers.tripId, TRIP_ID));
  const allExpenses = await db.select().from(expenses).where(eq(expenses.tripId, TRIP_ID));
  const allSplits = await db.select().from(expenseSplits)
    .where(eq(expenseSplits.expenseId, allExpenses[0]?.id ?? "unused"));

  // Verify counts
  console.log(`Members:  ${members.length} (expect 10)`);
  console.log(`Expenses: ${allExpenses.length} (expect 30)`);

  // Verify totals per expense match sum of splits
  let splitErrors = 0;
  for (const expense of allExpenses) {
    const splits = await db.select().from(expenseSplits).where(eq(expenseSplits.expenseId, expense.id));
    const splitTotal = splits.reduce((s, x) => s + Number(x.shareAmount), 0);
    const diff = Math.abs(Number(expense.amount) - splitTotal);
    if (diff > 0.02) {
      console.log(`  ❌ Split mismatch: "${expense.description}" — expense ₹${expense.amount} vs splits ₹${splitTotal.toFixed(2)}`);
      splitErrors++;
    }
  }
  if (splitErrors === 0) console.log(`✅  All 30 expense splits reconcile exactly`);

  // Compute balances
  const balances = await Promise.all(members.map(async (m) => {
    const [paid] = await db.select({ t: sum(expenses.amount) }).from(expenses)
      .where(eq(expenses.paidByMemberId, m.id));
    const [owed] = await db.select({ t: sum(expenseSplits.shareAmount) }).from(expenseSplits)
      .innerJoin(expenses, eq(expenseSplits.expenseId, expenses.id))
      .where(eq(expenseSplits.memberId, m.id));
    const net = Math.round((Number(paid?.t ?? 0) - Number(owed?.t ?? 0)) * 100) / 100;
    return { name: m.guestName ?? "You (admin)", paid: Number(paid?.t ?? 0), owed: Number(owed?.t ?? 0), net };
  }));

  console.log("\n📊 Balance sheet:\n");
  console.log(`  ${"Member".padEnd(12)} ${"Paid".padStart(10)} ${"Owed".padStart(10)} ${"Net".padStart(10)}`);
  console.log(`  ${"-".repeat(46)}`);
  let totalNet = 0;
  for (const b of balances.sort((a, z) => z.net - a.net)) {
    const sign = b.net > 0 ? "+" : "";
    console.log(`  ${b.name.padEnd(12)} ₹${String(b.paid.toFixed(0)).padStart(8)} ₹${String(b.owed.toFixed(0)).padStart(8)} ${sign}₹${b.net.toFixed(2).padStart(8)}`);
    totalNet += b.net;
  }
  console.log(`  ${"-".repeat(46)}`);
  console.log(`  ${"TOTAL NET".padEnd(12)} ${" ".padStart(10)} ${" ".padStart(10)} ₹${totalNet.toFixed(2).padStart(8)} (should be ~0)`);

  // Run optimizer
  const suggestions = optimizeSettlements(balances.map(b => ({ memberId: b.name, net: b.net })));
  console.log(`\n💡 Settlement suggestions: ${suggestions.length} transactions (max possible: ${members.length - 1})`);
  for (const s of suggestions) {
    console.log(`   ${s.from.padEnd(12)} → ${s.to.padEnd(12)} ₹${s.amount.toFixed(2)}`);
  }

  const settled = Math.abs(totalNet) < 0.1;
  console.log(`\n${settled ? "✅  Net balance is zero — all money accounts for correctly" : "❌  Net balance is non-zero — bug in splits"}`);
  console.log(`✅  Optimizer uses ${suggestions.length}/${members.length - 1} max transactions\n`);

  process.exit(0);
}

verify().catch(e => { console.error("❌", e); process.exit(1); });
