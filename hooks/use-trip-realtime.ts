"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribes to all Supabase Realtime changes for a trip.
 * When any row changes on expenses, expense_splits, settlements, or
 * trip_members for this trip, calls router.refresh() so Next.js
 * re-runs the server components and gets fresh data.
 */
export function useTripRealtime(tripId: string) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`trip:${tripId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "expenses",
        filter: `trip_id=eq.${tripId}`,
      }, () => router.refresh())
      .on("postgres_changes", {
        event: "*", schema: "public", table: "settlements",
        filter: `trip_id=eq.${tripId}`,
      }, () => router.refresh())
      .on("postgres_changes", {
        event: "*", schema: "public", table: "trip_members",
        filter: `trip_id=eq.${tripId}`,
      }, () => router.refresh())
      // expense_splits has no trip_id column — listen broadly and debounce
      .on("postgres_changes", {
        event: "*", schema: "public", table: "expense_splits",
      }, () => router.refresh())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId, router]);
}
