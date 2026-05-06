"use client";

import { useState } from "react";
import { Zap, X, Sparkles, Loader2, CalendarDays } from "lucide-react";
import type { TripMember } from "@/lib/db/schema/trip-members";
import type { ParsedExpense } from "@/lib/parser/parse-expense";
import { parseExpenseText } from "@/lib/parser/parse-expense";
import { parseExpenseWithAI } from "@/app/actions/parse-expense";
import { getMemberName, formatCurrency, formatDate } from "@/lib/utils";
import { getCategory } from "@/lib/categories";

type ParseMode = "ai" | "basic";

interface Props {
  members: TripMember[];
  currency: string;
  tripStartDate?: string | null;
  tripEndDate?: string | null;
  onParsed: (result: ParsedExpense) => void;
}

export function QuickAddBar({ members, currency, tripStartDate, tripEndDate, onParsed }: Props) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedExpense | null>(null);
  const [loading, setLoading] = useState(false);
  const [parseMode, setParseMode] = useState<ParseMode | null>(null);

  async function handleFill() {
    if (!text.trim()) return;
    setLoading(true);

    const memberContext = members.map((m) => ({ id: m.id, name: getMemberName(m) }));
    const today = new Date().toISOString().split("T")[0];

    const aiResult = await parseExpenseWithAI(text, memberContext, {
      today,
      tripStart: tripStartDate,
      tripEnd: tripEndDate,
    });
    const result = aiResult ?? parseExpenseText(text, members);
    const mode: ParseMode = aiResult ? "ai" : "basic";

    setParsed(result);
    setParseMode(mode);
    onParsed(result);
    setLoading(false);
  }

  function handleClear() {
    setText("");
    setParsed(null);
    setParseMode(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleFill();
    }
  }

  const payer = parsed?.paidByMemberId
    ? members.find((m) => m.id === parsed.paidByMemberId)
    : null;
  const cat = parsed ? getCategory(parsed.category) : null;
  const showSplitChip =
    parsed !== null &&
    (parsed.splitCount !== undefined || (parsed.splitMemberIds && parsed.splitMemberIds.length > 0));

  return (
    <div className="mb-6 rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50/80 to-teal-50/80 p-4">
      {/* Header row */}
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-3.5 h-3.5 text-cyan-500" />
        <span className="text-xs font-semibold text-cyan-700 uppercase tracking-wide">
          Quick add
        </span>
        <span className="text-xs text-slate-400 normal-case font-normal tracking-normal">
          — type a short description and press Enter
        </span>

        {parseMode === "ai" && (
          <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500 text-white text-[10px] font-semibold">
            <Sparkles className="w-2.5 h-2.5" />
            AI
          </span>
        )}
        {parseMode === "basic" && (
          <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-300 text-slate-700 text-[10px] font-semibold">
            <Zap className="w-2.5 h-2.5" />
            Basic
          </span>
        )}
      </div>

      {/* Input row */}
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          placeholder="dinner 2400 raj yesterday split 4"
          className="flex-1 px-3 py-2 text-sm rounded-xl border border-cyan-200 bg-white/70 focus:outline-none focus:ring-2 focus:ring-cyan-400 placeholder:text-slate-400 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={handleFill}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium bg-gradient-to-br from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white rounded-xl transition-all disabled:opacity-60 flex items-center gap-1.5 whitespace-nowrap"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Parsing…
            </>
          ) : (
            "Fill form"
          )}
        </button>
      </div>

      {/* Chips row */}
      {parsed && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {parsed.description && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700 font-medium">
              {parsed.description}
            </span>
          )}
          {parsed.amount !== null && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-cyan-100 text-cyan-700 font-medium">
              {formatCurrency(parsed.amount, currency)}
            </span>
          )}
          {parsed.expenseDate && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 font-medium flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {formatDate(parsed.expenseDate)}
            </span>
          )}
          {payer && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-teal-100 text-teal-700 font-medium">
              {getMemberName(payer)} paid
            </span>
          )}
          {showSplitChip && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700 font-medium">
              {parsed.splitMemberIds && parsed.splitMemberIds.length > 0
                ? `÷ ${parsed.splitMemberIds.map((id) => {
                    const m = members.find((m) => m.id === id);
                    return m ? getMemberName(m).split(" ")[0] : "?";
                  }).join(", ")}`
                : parsed.splitCount === null
                ? "÷ all"
                : `÷ ${parsed.splitCount}`}
            </span>
          )}
          {cat && parsed.category !== "other" && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-600 font-medium">
              {cat.label}
            </span>
          )}
          <button
            type="button"
            onClick={handleClear}
            className="ml-auto flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
