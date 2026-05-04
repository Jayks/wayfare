import { notFound } from "next/navigation";
import { getTripWithMembers } from "@/lib/db/queries/trips";
import { getTripExpensesWithSplits } from "@/lib/db/queries/expenses";
import { computeTripInsights } from "@/lib/insights/trip-insights";
import { KpiCard } from "@/components/insights/kpi-card";
import { SmartInsightCard } from "@/components/insights/smart-insight-card";
import { AnimatedList } from "@/components/shared/animated-list";
import { CategoryDonut } from "@/components/insights/category-donut";
import { DailySpendBar } from "@/components/insights/daily-spend-bar";
import { MemberContributions } from "@/components/insights/member-contributions";
import { ArrowLeft, BarChart2 } from "lucide-react";
import Link from "next/link";

export default async function TripInsightsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [tripData, expensesWithSplits] = await Promise.all([
    getTripWithMembers(id),
    getTripExpensesWithSplits(id),
  ]);
  if (!tripData) notFound();

  const { trip, members } = tripData;
  const insights = computeTripInsights({ trip, members, expensesWithSplits });
  const currency = trip.defaultCurrency;

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

  if (expensesWithSplits.length === 0) {
    return (
      <div className="max-w-3xl">
        <Link href={`/trips/${id}`}
          className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm font-medium mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <BarChart2 className="w-10 h-10 text-slate-300 mb-4" />
          <h2 className="text-lg text-slate-700 mb-1" style={{ fontFamily: "var(--font-fraunces)" }}>
            No expenses yet
          </h2>
          <p className="text-slate-500 text-sm">Add some expenses and come back for insights.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/trips/${id}`}
          className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div>
          <h1 className="text-2xl text-slate-800" style={{ fontFamily: "var(--font-fraunces)" }}>
            Insights
          </h1>
          <p className="text-xs text-slate-500">{trip.name}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total spend" value={fmt(insights.totalSpend)}
          numericValue={insights.totalSpend} currency={currency} accent />
        <KpiCard label="Per person" value={fmt(insights.perPerson)}
          numericValue={insights.perPerson} currency={currency} />
        <KpiCard label="Daily average" value={fmt(insights.dailyAverage)}
          numericValue={insights.dailyAverage} currency={currency} />
        <KpiCard label="Expenses" value={String(insights.expenseCount)}
          numericValue={insights.expenseCount}
          sub={`over ${insights.tripDays} day${insights.tripDays > 1 ? "s" : ""}`} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <CategoryDonut data={insights.byCategory} currency={currency} />
        <DailySpendBar data={insights.byDay} currency={currency} />
      </div>

      {/* Member contributions (full width) */}
      <div className="mb-6">
        <MemberContributions data={insights.byMember} currency={currency} />
      </div>

      {/* Smart insights */}
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Smart insights
      </h2>
      <AnimatedList className="grid grid-cols-1 sm:grid-cols-2 gap-3" staggerMs={50}>
        {insights.smartInsights.map((s, i) => (
          <SmartInsightCard key={i} emoji={s.emoji} title={s.title} sub={s.sub} />
        ))}
      </AnimatedList>
    </div>
  );
}
