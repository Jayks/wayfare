import { notFound } from "next/navigation";
import { getTripWithMembers } from "@/lib/db/queries/trips";
import { getTripName } from "@/lib/db/queries/meta";
import { ArrowLeft, Crown, UserPlus } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { getMemberName } from "@/lib/utils";
import { AddGuestForm } from "./add-guest-form";
import { QRInvite } from "@/components/trip/qr-invite";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const name = await getTripName(id);
  return { title: name ? `Members — ${name} | Wayfare` : "Wayfare" };
}
import { RemoveMemberButton } from "./remove-member-button";
import { RegenerateTokenButton } from "./regenerate-token-button";

export default async function MembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getTripWithMembers(id);
  if (!data) notFound();

  const { trip, members, currentMember, currentUser } = data;
  const isAdmin = currentMember?.role === "admin";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const inviteUrl = `${appUrl}/join/${trip.shareToken}`;

  return (
    <div className="max-w-xl">
      <Link
        href={`/trips/${trip.id}`}
        className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm font-medium mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to trip
      </Link>

      <h1 className="text-2xl text-slate-800 mb-1" style={{ fontFamily: "var(--font-fraunces)" }}>
        Members
      </h1>
      <p className="text-slate-500 text-sm mb-6">{trip.name}</p>

      {/* Member list */}
      <div className="glass rounded-2xl divide-y divide-white/40 mb-4">
        {members.map((member) => {
          const isSelf = member.userId === currentUser.id;
          const isAdminMember = member.role === "admin";

          return (
            <div key={member.id} className="flex items-center gap-3 px-4 py-3">
              <MemberAvatar name={getMemberName(member)} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">
                  {isSelf ? `${getMemberName(member)} (you)` : getMemberName(member)}
                  {member.guestName && (
                    <span className="ml-1.5 text-xs text-slate-400 font-normal">guest</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isAdminMember && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                    <Crown className="w-3 h-3" />
                    Admin
                  </span>
                )}
                {isAdmin && !isSelf && !isAdminMember && (
                  <RemoveMemberButton tripId={trip.id} memberId={member.id} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add guest */}
      {isAdmin && (
        <div className="glass rounded-2xl p-5 mb-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-cyan-500" />
            Add a guest member
          </h2>
          <AddGuestForm tripId={trip.id} />
        </div>
      )}

      {/* Invite link */}
      {isAdmin && (
        <div className="glass rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Invite link</h2>
          <p className="text-xs text-slate-500 mb-3">Anyone with this link can join the trip.</p>
          <div className="flex items-center gap-2 bg-white/50 border border-slate-200 rounded-xl px-3 py-2 mb-3">
            <p className="text-xs text-slate-600 truncate flex-1">{inviteUrl}</p>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <RegenerateTokenButton tripId={trip.id} inviteUrl={inviteUrl} />
            </div>
            <QRInvite url={inviteUrl} />
          </div>
        </div>
      )}
    </div>
  );
}
