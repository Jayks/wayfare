import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LoginForm from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; returnTo?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) redirect("/trips");

  const { error, returnTo } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-500 mb-4 shadow-lg shadow-cyan-500/25">
            <span className="text-white text-2xl" style={{ fontFamily: "var(--font-fraunces)" }}>W</span>
          </div>
          <h1
            className="text-4xl text-slate-800"
            style={{ fontFamily: "var(--font-fraunces)" }}
          >
            Wayfare
          </h1>
          <p className="mt-2 text-slate-500 text-sm">
            Travel together. Settle easy.
          </p>
        </div>

        {/* Glass card */}
        <div className="glass rounded-2xl p-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-1">
            {returnTo?.startsWith("/join") ? "Sign in to join the trip" : "Sign in to Wayfare"}
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            {returnTo?.startsWith("/join")
              ? "You'll be taken directly to the trip invitation after signing in."
              : "Manage group expenses for your trips, squared up."}
          </p>

          {error === "auth_callback_failed" && (
            <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-100">
              Sign-in failed. Please try again.
            </p>
          )}

          <LoginForm returnTo={returnTo} />
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          By signing in you agree to our{" "}
          <a href="/terms" className="underline hover:text-slate-600">terms of service</a>.
        </p>
      </div>
    </div>
  );
}
