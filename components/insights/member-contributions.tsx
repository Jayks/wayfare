"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { MemberRow } from "@/lib/insights/trip-insights";
import { formatCurrency } from "@/lib/utils";

interface Props {
  data: MemberRow[];
  currency: string;
}

interface TooltipItem {
  name: string;
  value: number;
  fill: string;
}

interface MemberTooltipProps {
  active?: boolean;
  label?: string;
  payload?: TooltipItem[];
  currency: string;
}

function CustomTooltip({ active, payload, label, currency }: MemberTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-3 py-2 text-xs shadow-lg space-y-1">
      <p className="font-semibold text-slate-700">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.fill }} className="font-medium">
          {p.name}: {formatCurrency(p.value, currency)}
        </p>
      ))}
    </div>
  );
}

export function MemberContributions({ data, currency }: Props) {
  if (data.length === 0) return null;

  const chartData = data.map((m) => ({ name: m.name, Paid: m.paid, Owed: m.owed }));

  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-sm font-semibold text-slate-700 mb-4">Member contributions</p>
      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 42)}>
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 0, right: 8, left: 4, bottom: 0 }}
        >
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: "#94A3B8" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: "#475569" }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip content={<CustomTooltip currency={currency} />} cursor={{ fill: "rgba(6,182,212,0.06)" }} />
          <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs text-slate-600">{v}</span>} />
          <Bar dataKey="Paid"  fill="#06B6D4" radius={[0, 4, 4, 0]} barSize={10} />
          <Bar dataKey="Owed"  fill="#E2E8F0" radius={[0, 4, 4, 0]} barSize={10} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
