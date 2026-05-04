"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { QrCode } from "lucide-react";

export function QRInvite({ url }: { url: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
        title="Show QR code"
      >
        <QrCode className="w-3.5 h-3.5" />
        QR
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass border-white/70 max-w-xs p-6 flex flex-col items-center gap-4">
          <h3 className="text-slate-800 font-semibold text-sm" style={{ fontFamily: "var(--font-fraunces)" }}>
            Scan to join
          </h3>
          <div className="bg-white p-4 rounded-2xl shadow-sm">
            <QRCodeSVG
              value={url}
              size={200}
              fgColor="#0F172A"
              bgColor="#FFFFFF"
              level="M"
            />
          </div>
          <p className="text-xs text-slate-500 text-center leading-relaxed">
            Scan this QR code to join the trip, or share the invite link directly.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
