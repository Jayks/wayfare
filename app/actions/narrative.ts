"use server";

import Anthropic from "@anthropic-ai/sdk";
import { getCategory } from "@/lib/categories";

interface NarrativeInput {
  tripName: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  tripDays: number;
  memberCount: number;
  totalSpend: number;
  currency: string;
  categoryBreakdown: { category: string; total: number; pct: number }[];
  topExpenses: { description: string; amount: number }[];
}

export async function generateTripNarrative(
  input: NarrativeInput
): Promise<{ ok: true; narrative: string } | { ok: false; error: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "AI narrative generation is not configured." };
  }

  const client = new Anthropic({ apiKey });

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: input.currency,
      maximumFractionDigits: 0,
    }).format(n);

  const dateRange =
    input.startDate && input.endDate
      ? `${input.startDate} to ${input.endDate} (${input.tripDays} ${input.tripDays === 1 ? "day" : "days"})`
      : input.startDate
      ? `From ${input.startDate}`
      : "Dates not set";

  const categoryLines = input.categoryBreakdown
    .map((c) => `  - ${getCategory(c.category).label}: ${fmt(c.total)} (${c.pct}%)`)
    .join("\n");

  const topExpenseLines = input.topExpenses
    .slice(0, 5)
    .map((e) => `  - ${e.description}: ${fmt(e.amount)}`)
    .join("\n");

  const prompt = `Write a warm, vivid 2–3 paragraph travel narrative for a group trip. Use third person ("the group", "the travelers", "they"). Write like a travel magazine — evocative, human, memorable. Focus on the journey's spirit, the shared experiences, and what made it special. Do not list expenses or mention money unless it adds flavour (e.g. a splurge or a bargain). End on a warm, reflective note.

Trip: ${input.tripName}
${input.description ? `Description: ${input.description}\n` : ""}Duration: ${dateRange}
Group size: ${input.memberCount} travelers
Total spent: ${fmt(input.totalSpend)} (${fmt(Math.round(input.totalSpend / input.memberCount))} per person)

Spending breakdown:
${categoryLines}

Highlight expenses:
${topExpenseLines}`;

  try {
    const response = await Promise.race([
      client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000)),
    ]);

    if (!response) return { ok: false, error: "Request timed out. Please try again." };

    const content = response.content[0];
    if (content.type !== "text") return { ok: false, error: "Unexpected response format." };

    return { ok: true, narrative: content.text.trim() };
  } catch {
    return { ok: false, error: "Failed to generate narrative. Please try again." };
  }
}
