"use client";

import { toast } from "sonner";
import { Copy } from "lucide-react";

export function ShareButton({ url }: { url: string }) {
  function handleCopy() {
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied!");
  }

  return (
    <button
      onClick={handleCopy}
      className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-cyan-600 hover:text-cyan-700 bg-cyan-50 hover:bg-cyan-100 px-3 py-1.5 rounded-lg transition-colors"
    >
      <Copy className="w-3.5 h-3.5" />
      Copy
    </button>
  );
}
