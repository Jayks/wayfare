import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number,
  currency = "INR",
  locale = "en-IN"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function getMemberName(member: {
  displayName?: string | null;
  guestName?: string | null;
}): string {
  return member.displayName ?? member.guestName ?? "Member";
}

export function extractDisplayName(user: {
  user_metadata?: Record<string, unknown> | null;
  email?: string | null;
}): string | null {
  const fullName = user.user_metadata?.full_name;
  return typeof fullName === "string" ? fullName : user.email?.split("@")[0] ?? null;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}
