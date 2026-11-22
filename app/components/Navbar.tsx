"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { href: "/", label: "Dashboard" },
    { href: "/workouts", label: "Workouts" },
    { href: "/foods", label: "Foods" },
  ];

  return (
    <header className="border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4 sm:gap-8">
          <Link href="/" className="flex items-center gap-1.5 py-1">
            <span className="font-semibold text-base tracking-tight text-zinc-950 dark:text-zinc-50">
              MacroLog
            </span>
          </Link>

          <nav className="flex items-center gap-0.5 sm:gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm transition-colors rounded-md touch-manipulation ${
                    isActive
                      ? "text-zinc-950 font-medium bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-100"
                      : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="hidden sm:flex items-center text-xs text-zinc-500 dark:text-zinc-400">
          <span>Screenshot-driven intake</span>
        </div>
      </div>
    </header>
  );
}
