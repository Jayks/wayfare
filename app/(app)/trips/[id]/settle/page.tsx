import { notFound } from "next/navigation";
import { getTripWithMembers } from "@/lib/db/queries/trips";
import { getBalances, getSettlements } from "@/lib/db/queries/balances";
import { getTripExpensesWithSplits } from "@/lib/db/queries/expenses";
import { getTripName } from "@/lib/db/queries/meta";
import { CountUp } from "@/components/shared/count-up";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const name = await getTripName(id);
  return { title: name ? `Settle up — ${name} | Wayfare` : "Wayfare" };
}
import { ArrowLeft, TrendingUp, TrendingDown, Minus, ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { MemberDebtBreakdown } from "@/components/settlement/member-debt-breakdown";
import { formatCurrency, formatDate, getMemberName } from "@/lib/utils";
import { MarkPaidButton } from "./mark-paid-button";
import { UpiPayButton } from "./upi-pay-button";
import { WhatsAppRemindButton } from "./whatsapp-remind-button";
import { SettlementBreakdown } from "@/components/settlement/settlement-breakdown";

export default async function SettlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, settlementHistory, expensesWithSplits, { balances, suggestions }] = await Promise.all([
    getTripWithMembers(id),
    getSettlements(id),
    getTripExpensesWithSplits(id),
    getBalances(id),
  ]);
  if (!data) notFound();

  const { trip, members, currentMember } = data;
  const isAdmin = currentMember?.role === "admin";
  const pastSettlementsTotal = settlementHistory.reduce((sum, s) => sum + Number(s.amount), 0);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const settleUrl = `${appUrl}/trips/${id}/settle`;

  const memberName = (memberId: string) => {
    const m = members.find((m) => m.id === memberId);
    return m ? getMemberName(m) : "Member";
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/trips/${id}`}
          className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
        <h1 className="text-2xl text-slate-800" style={{ fontFamily: "var(--font-fraunces)" }}>
          Settle up
        </h1>
      </div>

      {/* Balance summary */}
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Balances
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        {balances.map((b) => {
          const isPositive = b.net > 0;
          const isZero = b.net === 0;
          return (
            <div key={b.memberId} className="glass rounded-xl px-4 py-3 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                isZero ? "bg-slate-100" : isPositive ? "bg-emerald-100" : "bg-red-100"
              }`}>
                {isZero
                  ? <Minus className="w-4 h-4 text-slate-400" />
                  : isPositive
                  ? <TrendingUp className="w-4 h-4 text-emerald-600" />
                  : <TrendingDown className="w-4 h-4 text-red-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{b.displayName}</p>
                <p className="text-xs text-slate-500">
                  {isZero ? "Settled" : isPositive ? "is owed" : "owes"}
                </p>
              </div>
              {isZero ? (
                <span className="text-base font-semibold text-slate-400 shrink-0" style={{ fontFamily: "var(--font-fraunces)" }}>—</span>
              ) : (
                <CountUp
                  value={Math.abs(b.net)}
                  currency={trip.defaultCurrency}
                  className={`text-base font-semibold tabular shrink-0 ${isPositive ? "text-emerald-600" : "text-red-500"}`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Suggested transactions */}
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Suggested payments
      </h2>
      {suggestions.length === 0 ? (
        <div className="glass rounded-xl px-4 py-6 flex flex-col items-center gap-2 mb-8">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          <p className="text-sm font-medium text-slate-700">All settled up!</p>
          <p className="text-xs text-slate-500">No payments needed.</p>
        </div>
      ) : (
        <div className="space-y-2 mb-8">
          {suggestions.map((s, i) => (
            <div key={i} className="glass rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-slate-700 truncate">
                  {memberName(s.from)}
                </span>
                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-sm font-medium text-slate-700 truncate">
                  {memberName(s.to)}
                </span>
              </div>
              <span className="text-base font-semibold text-slate-800 tabular shrink-0"
                style={{ fontFamily: "var(--font-fraunces)" }}>
                {formatCurrency(s.amount, trip.defaultCurrency)}
              </span>
              {currentMember?.id === s.from && (
                <UpiPayButton
                  amount={s.amount}
                  currency={trip.defaultCurrency}
                  toName={memberName(s.to)}
                />
              )}
              {currentMember?.id === s.to && (
                <WhatsAppRemindButton
                  fromName={memberName(s.from)}
                  amount={formatCurrency(s.amount, trip.defaultCurrency)}
                  tripName={trip.name}
                  settleUrl={settleUrl}
                />
              )}
              <MarkPaidButton
                tripId={id}
                fromMemberId={s.from}
                toMemberId={s.to}
                amount={s.amount}
                currency={trip.defaultCurrency}
              />
            </div>
          ))}
        </div>
      )}

      {/* Per-member debt breakdown */}
      <MemberDebtBreakdown
        members={members}
        suggestions={suggestions}
        currency={trip.defaultCurrency}
      />

      {/* Settlement history */}
      {settlementHistory.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Payment history
          </h2>
          <div className="space-y-2">
            {settlementHistory.map((s) => (
              <div key={s.id} className="glass rounded-xl px-4 py-3 flex items-center gap-3 opacity-75">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-sm text-slate-600">
                    <span className="font-medium truncate">{memberName(s.fromMemberId)}</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span className="font-medium truncate">{memberName(s.toMemberId)}</span>
                  </div>
                  {s.note && <p className="text-xs text-slate-400 mt-0.5 truncate">{s.note}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-slate-700 tabular">
                    {formatCurrency(Number(s.amount), s.currency)}
                  </p>
                  <p className="text-xs text-slate-400">{formatDate(s.settledAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Breakdown */}
      <SettlementBreakdown
        expensesWithSplits={expensesWithSplits}
        members={members}
        balances={balances}
        suggestions={suggestions}
        currency={trip.defaultCurrency}
        pastSettlementsTotal={pastSettlementsTotal}
      />
    </div>
  );
}
