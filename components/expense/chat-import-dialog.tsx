"use client";

import { useState } from "react";
import { MessageSquarePlus, Loader2, CheckCircle2, XCircle, Check, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { parseChatExpenses, type ChatParsedExpense } from "@/app/actions/parse-chat";
import { addExpense } from "@/app/actions/expenses";
import { getMemberName, formatCurrency, smartDefaultDate, formatDate } from "@/lib/utils";
import { getCategory } from "@/lib/categories";
import type { TripMember } from "@/lib/db/schema/trip-members";
import type { SplitInput } from "@/lib/splits/compute";

interface Props {
  tripId: string;
  members: TripMember[];
  currency: string;
  defaultMemberId: string;
  tripStartDate: string | null;
  tripEndDate: string | null;
}

type RowStatus = "pending" | "adding" | "done" | "error";

interface RowState extends ChatParsedExpense {
  selected: boolean;
  status: RowStatus;
  editDescription: string;
  editAmount: string;
  editPaidByMemberId: string;
}

function resolveSplits(row: RowState, members: TripMember[]): SplitInput[] {
  if (row.splitMemberIds && row.splitMemberIds.length > 0)
    return row.splitMemberIds.map((id) => ({ memberId: id }));
  if (row.splitCount && row.splitCount > 0)
    return members.slice(0, row.splitCount).map((m) => ({ memberId: m.id }));
  return members.map((m) => ({ memberId: m.id }));
}

function splitLabel(row: RowState, members: TripMember[]): string {
  if (row.splitMemberIds && row.splitMemberIds.length > 0) {
    const names = row.splitMemberIds
      .map((id) => members.find((m) => m.id === id))
      .filter(Boolean)
      .map((m) => getMemberName(m!).split(" ")[0])
      .join(", ");
    return `÷ ${names}`;
  }
  if (row.splitCount) return `÷ ${row.splitCount}`;
  return `÷ all ${members.length}`;
}

export function ChatImportDialog({
  tripId, members, currency, defaultMemberId, tripStartDate, tripEndDate,
}: Props) {
  const [open, setOpen] = useState(false);
  const [chatText, setChatText] = useState("");
  const [rows, setRows] = useState<RowState[]>([]);
  const [step, setStep] = useState<"input" | "preview" | "adding" | "done">("input");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [addProgress, setAddProgress] = useState(0);

  function toRow(parsed: ChatParsedExpense): RowState {
    return {
      ...parsed,
      selected: true,
      status: "pending",
      editDescription: parsed.description,
      editAmount: String(parsed.amount),
      editPaidByMemberId: parsed.paidByMemberId ?? defaultMemberId,
    };
  }

  function handleClose() {
    setOpen(false);
    setTimeout(() => {
      setChatText("");
      setRows([]);
      setStep("input");
      setExtractError(null);
      setAddProgress(0);
    }, 200);
  }

  async function handleExtract() {
    if (!chatText.trim()) return;
    setExtracting(true);
    setExtractError(null);

    const today = new Date().toISOString().split("T")[0];
    const memberContext = members.map((m) => ({ id: m.id, name: getMemberName(m) }));
    const result = await parseChatExpenses(chatText, memberContext, {
      today,
      tripStart: tripStartDate,
      tripEnd: tripEndDate,
    });

    setExtracting(false);

    if (!result.ok) {
      setExtractError(result.error);
      return;
    }
    if (result.expenses.length === 0) {
      setExtractError("No expenses found in this chat. Try pasting a longer section.");
      return;
    }

    setRows(result.expenses.map(toRow));
    setStep("preview");
  }

  async function handleAddAll() {
    const selected = rows.filter((r) => r.selected);
    if (selected.length === 0) return;

    setStep("adding");
    setAddProgress(0);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.selected) continue;

      setRows((prev) =>
        prev.map((r, idx) => idx === i ? { ...r, status: "adding" } : r)
      );

      const amount = parseFloat(row.editAmount);
      if (!row.editDescription.trim() || isNaN(amount) || amount <= 0) {
        setRows((prev) =>
          prev.map((r, idx) => idx === i ? { ...r, status: "error" } : r)
        );
        setAddProgress((p) => p + 1);
        continue;
      }

      const splits = resolveSplits(row, members);
      const today = new Date().toISOString().split("T")[0];

      const result = await addExpense({
        tripId,
        paidByMemberId: row.editPaidByMemberId || defaultMemberId,
        description: row.editDescription.trim(),
        category: row.category,
        amount,
        currency,
        expenseDate: row.expenseDate ?? smartDefaultDate(tripStartDate, tripEndDate),
        notes: row.notes ?? undefined,
        splitMode: "equal",
        splits,
      });

      setRows((prev) =>
        prev.map((r, idx) =>
          idx === i ? { ...r, status: result.ok ? "done" : "error" } : r
        )
      );
      setAddProgress((p) => p + 1);
    }

    setStep("done");
  }

  const selectedCount = rows.filter((r) => r.selected).length;
  const doneCount = rows.filter((r) => r.status === "done").length;
  const errorCount = rows.filter((r) => r.status === "error").length;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 bg-white/60 hover:bg-white/80 border border-slate-200 px-3 py-2 rounded-xl transition-colors"
      >
        <MessageSquarePlus className="w-4 h-4" />
        Import chat
      </button>

      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent className="glass border-white/70 max-w-2xl w-full p-0 overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-white/40">
            <h2 className="text-base font-semibold text-slate-800" style={{ fontFamily: "var(--font-fraunces)" }}>
              Import from chat
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Paste a WhatsApp or group chat snippet — AI will extract the expenses.
            </p>
          </div>

          <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">

            {/* Step 1: input */}
            {(step === "input") && (
              <div className="space-y-4">
                <textarea
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  rows={8}
                  placeholder={`Paste your chat here, e.g.\n\nRaj: I paid 2400 for dinner, split 4 ways\nPriya: covered the cab — 650, just raj and me\nMe: hotel done! 15000 split everyone`}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-white/60 focus:outline-none focus:ring-2 focus:ring-cyan-400 placeholder:text-slate-400 resize-none"
                />
                {extractError && (
                  <p className="text-sm text-red-500">{extractError}</p>
                )}
                <button
                  onClick={handleExtract}
                  disabled={extracting || !chatText.trim()}
                  className="w-full py-2.5 bg-gradient-to-br from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {extracting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Extracting expenses…</>
                  ) : "Extract expenses"}
                </button>
              </div>
            )}

            {/* Step 2: preview table */}
            {(step === "preview" || step === "adding" || step === "done") && (
              <div className="space-y-3">
                {step === "preview" && (
                  <p className="text-xs text-slate-500">
                    Found <strong>{rows.length}</strong> expenses. Edit inline, uncheck to skip.
                  </p>
                )}

                <div className="space-y-2">
                  {rows.map((row, i) => (
                    <div
                      key={i}
                      className={`rounded-xl border p-3 transition-colors ${
                        row.status === "done" ? "border-teal-200 bg-teal-50/50" :
                        row.status === "error" ? "border-red-200 bg-red-50/50" :
                        row.selected ? "border-slate-200 bg-white/60" : "border-slate-100 bg-slate-50/60 opacity-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Status / checkbox */}
                        <div className="mt-1 shrink-0">
                          {row.status === "done" && <CheckCircle2 className="w-4 h-4 text-teal-500" />}
                          {row.status === "error" && <XCircle className="w-4 h-4 text-red-400" />}
                          {row.status === "adding" && <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />}
                          {row.status === "pending" && (
                            <button
                              type="button"
                              onClick={() =>
                                setRows((prev) =>
                                  prev.map((r, idx) => idx === i ? { ...r, selected: !r.selected } : r)
                                )
                              }
                              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                row.selected ? "bg-cyan-500 border-cyan-500" : "border-slate-300 bg-white"
                              }`}
                            >
                              {row.selected && <Check className="w-3 h-3 text-white" />}
                            </button>
                          )}
                        </div>

                        {/* Fields */}
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Description */}
                            <input
                              value={row.editDescription}
                              onChange={(e) =>
                                setRows((prev) =>
                                  prev.map((r, idx) => idx === i ? { ...r, editDescription: e.target.value } : r)
                                )
                              }
                              disabled={row.status !== "pending"}
                              className="flex-1 min-w-[140px] px-2 py-1 text-sm rounded-lg border border-slate-200 bg-white/70 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:bg-transparent disabled:border-transparent font-medium text-slate-700"
                            />
                            {/* Amount */}
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-xs text-slate-400">{currency}</span>
                              <input
                                value={row.editAmount}
                                onChange={(e) =>
                                  setRows((prev) =>
                                    prev.map((r, idx) => idx === i ? { ...r, editAmount: e.target.value } : r)
                                  )
                                }
                                disabled={row.status !== "pending"}
                                type="number"
                                inputMode="decimal"
                                className="w-24 px-2 py-1 text-sm rounded-lg border border-slate-200 bg-white/70 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:bg-transparent disabled:border-transparent tabular text-slate-700"
                              />
                            </div>
                          </div>

                          {/* Meta row */}
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Paid by */}
                            <select
                              value={row.editPaidByMemberId}
                              onChange={(e) =>
                                setRows((prev) =>
                                  prev.map((r, idx) => idx === i ? { ...r, editPaidByMemberId: e.target.value } : r)
                                )
                              }
                              disabled={row.status !== "pending"}
                              className="text-xs px-2 py-1 rounded-lg border border-slate-200 bg-white/70 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:bg-transparent disabled:border-transparent text-slate-600"
                            >
                              {members.map((m) => (
                                <option key={m.id} value={m.id}>{getMemberName(m)}</option>
                              ))}
                            </select>
                            {/* Split */}
                            <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700 font-medium">
                              {splitLabel(row, members)}
                            </span>
                            {/* Category */}
                            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${getCategory(row.category).color} ${getCategory(row.category).textColor}`}>
                              {getCategory(row.category).label}
                            </span>
                            {/* Date — show effective date even when not parsed */}
                            <span className={`text-xs ${row.expenseDate ? "text-slate-400" : "text-slate-300 italic"}`}>
                              {row.expenseDate
                                ? formatDate(row.expenseDate)
                                : formatDate(smartDefaultDate(tripStartDate, tripEndDate))}
                            </span>
                          </div>
                        </div>

                        {/* Remove button */}
                        {row.status === "pending" && (
                          <button
                            type="button"
                            onClick={() =>
                              setRows((prev) => prev.filter((_, idx) => idx !== i))
                            }
                            className="shrink-0 text-slate-300 hover:text-red-400 transition-colors mt-1"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Done summary */}
                {step === "done" && (
                  <div className={`rounded-xl p-4 text-center text-sm font-medium ${
                    errorCount === 0 ? "bg-teal-50 text-teal-700" : "bg-amber-50 text-amber-700"
                  }`}>
                    {doneCount} of {doneCount + errorCount} expenses added
                    {errorCount > 0 && ` · ${errorCount} failed`}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-white/40 flex items-center justify-between gap-3">
            {step === "preview" && (
              <>
                <button
                  onClick={() => setStep("input")}
                  className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleAddAll}
                  disabled={selectedCount === 0}
                  className="bg-gradient-to-br from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white text-sm font-medium px-5 py-2 rounded-xl transition-all disabled:opacity-60"
                >
                  Add {selectedCount} expense{selectedCount !== 1 ? "s" : ""}
                </button>
              </>
            )}
            {step === "adding" && (
              <p className="text-sm text-slate-500 flex items-center gap-2 mx-auto">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-500" />
                Adding {addProgress + 1} of {selectedCount}…
              </p>
            )}
            {step === "done" && (
              <button
                onClick={handleClose}
                className="mx-auto bg-gradient-to-br from-cyan-500 to-teal-500 text-white text-sm font-medium px-6 py-2 rounded-xl transition-all"
              >
                Done
              </button>
            )}
            {step === "input" && (
              <button
                onClick={handleClose}
                className="ml-auto text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
