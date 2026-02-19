import React from 'react';
import Link from 'next/link';
import { Trophy } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-white/[0.06] bg-[#070b16]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
              <Trophy className="h-4 w-4 text-emerald-400" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">
              Sport<span className="text-emerald-400">Score</span>
            </span>
            <span className="text-sm text-slate-600 ml-1">
              &copy; {currentYear}
            </span>
          </div>
          <nav className="flex items-center gap-6">
            <Link
              href="/about"
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Tentang
            </Link>
            <Link
              href="/privacy"
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Privasi
            </Link>
            <Link
              href="/terms"
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Ketentuan
            </Link>
            <Link
              href="/contact"
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Kontak
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
