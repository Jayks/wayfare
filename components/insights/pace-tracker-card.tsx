import type { TrajectoryResult } from "@/lib/insights/cross-trip";

interface Props {
  data: TrajectoryResult;
  currency: string;
}

const STATUS_CONFIG = {
  on_track: { label: "On track",    color: "text-emerald-600", bar: "from-emerald-400 to-green-500",  bg: "bg-emerald-50"  },
  close:    { label: "Watch it",    color: "text-amber-600",   bar: "from-amber-400 to-orange-400",   bg: "bg-amber-50"    },
  over:     { label: "Over budget", color: "text-red-600",     bar: "from-red-400 to-rose-500",       bg: "bg-red-50"      },
  unknown:  { label: "",            color: "text-slate-500",   bar: "from-cyan-500 to-teal-500",      bg: "bg-slate-50"    },
};

export function PaceTrackerCard({ data, currency }: Props) {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

  const {
    dailyBurnRate, daysElapsed, tripDays, daysRemaining,
    projectedTotal, budget, projectedOverage, percentBudgetUsed, paceStatus,
  } = data;

  const cfg = STATUS_CONFIG[paceStatus];
  const barPct = percentBudgetUsed !== null ? Math.min(100, percentBudgetUsed) : null;

  return (
    <div className="glass rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-700">Spend pace</h2>
        {paceStatus !== "unknown" && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
            {cfg.label}
          </span>
        )}
      </div>

      {/* Daily burn + days */}
      <div className="flex items-end gap-6 mb-4">
        <div>
          <p className="text-2xl font-bold text-slate-800 tabular-nums">{fmt(dailyBurnRate)}</p>
          <p className="text-xs text-slate-500 mt-0.5">per day</p>
        </div>
        {tripDays !== null && (
          <div className="pb-0.5">
            <p className="text-sm font-medium text-slate-600">
              Day {daysElapsed} of {tripDays}
              {daysRemaining !== null && daysRemaining > 0 && (
                <span className="text-slate-400"> · {daysRemaining} left</span>
              )}
              {daysRemaining === 0 && (
                <span className="text-slate-400"> · trip ended</span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Projected vs budget */}
      {(projectedTotal !== null || budget !== null) && (
        <div className="space-y-2">
          {projectedTotal !== null && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Projected total</span>
              <span className="font-semibold text-slate-700 tabular-nums">{fmt(projectedTotal)}</span>
            </div>
          )}
          {budget !== null && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Budget</span>
              <span className="font-semibold text-slate-700 tabular-nums">{fmt(budget)}</span>
            </div>
          )}
          {projectedOverage !== null && projectedOverage !== 0 && (
            <div className={`flex items-center justify-between text-sm font-medium ${projectedOverage > 0 ? "text-red-600" : "text-emerald-600"}`}>
              <span>{projectedOverage > 0 ? "Projected over by" : "Projected under by"}</span>
              <span className="tabular-nums">{fmt(Math.abs(projectedOverage))}</span>
            </div>
          )}

          {barPct !== null && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Budget used</span>
                <span className="tabular-nums">{percentBudgetUsed}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${cfg.bar} transition-all duration-700`}
                  style={{ width: `${barPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
