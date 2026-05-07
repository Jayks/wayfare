"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPin, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/trips",    label: "Trips",    icon: MapPin   },
  { href: "/insights", label: "Insights", icon: BarChart2 },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden glass-nav border-t border-white/60 dark:border-slate-700/40">
      <div className="flex items-center justify-around h-16 px-4 safe-area-inset-bottom">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 px-6 py-1 rounded-xl transition-colors",
                active ? "text-cyan-600 dark:text-cyan-400" : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
              )}
            >
              <Icon className={cn("w-5 h-5", active && "drop-shadow-[0_0_6px_rgba(6,182,212,0.5)]")} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
