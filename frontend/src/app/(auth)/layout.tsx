'use client';

import React from 'react';
import Link from 'next/link';
import { Trophy, Zap, Shield, Users } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[#060a14]">
      {/* ── Full-screen animated background ── */}
      <div className="pointer-events-none absolute inset-0">
        {/* Main gradient orbs */}
        <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-emerald-500/15 blur-[150px]" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-blue-600/15 blur-[130px]" />
        <div className="absolute left-1/3 top-1/2 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-purple-600/10 blur-[120px]" />
        <div className="absolute right-1/4 top-1/4 h-[300px] w-[300px] rounded-full bg-cyan-500/8 blur-[100px]" />

        {/* Subtle animated floating orbs */}
        <div className="absolute left-[15%] top-[20%] h-[200px] w-[200px] rounded-full bg-emerald-400/8 blur-[80px] animate-float" />
        <div
          className="absolute right-[20%] bottom-[25%] h-[250px] w-[250px] rounded-full bg-blue-400/8 blur-[90px] animate-float"
          style={{ animationDelay: '1.5s', animationDuration: '4s' }}
        />

        {/* Dot grid overlay */}
        <div className="absolute inset-0 pattern-dots opacity-30" />

        {/* Top decorative gradient line */}
        <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
      </div>

      {/* ── Left panel – Hero / Branding (desktop only) ── */}
      <div className="relative hidden w-[55%] lg:flex lg:flex-col lg:items-center lg:justify-center">
        <div className="relative z-10 flex flex-col items-center px-16 text-center">
          {/* Logo */}
          <div className="mb-10 flex items-center gap-4">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-xl shadow-emerald-500/25">
              <Trophy className="h-9 w-9 text-white" />
              <div className="absolute -inset-1 rounded-2xl bg-emerald-500/20 blur-md" />
            </div>
            <span className="text-5xl font-bold tracking-tight text-white">
              Sport<span className="text-emerald-400">Score</span>
            </span>
          </div>

          <h2 className="mb-3 text-2xl font-semibold text-white/90">
            Platform Skor Olahraga
          </h2>
          <p className="mb-14 max-w-md text-base text-slate-400/80 leading-relaxed">
            Kelola turnamen, pantau skor langsung, dan organisasi tim dengan mudah dalam satu platform.
          </p>

          {/* Feature cards – glass style */}
          <div className="grid w-full max-w-md gap-4">
            {[
              {
                icon: Zap,
                color: 'emerald',
                title: 'Skor Langsung',
                desc: 'Update skor real-time untuk semua pertandingan',
              },
              {
                icon: Shield,
                color: 'blue',
                title: 'Manajemen Turnamen',
                desc: 'Buat dan kelola turnamen dengan mudah',
              },
              {
                icon: Users,
                color: 'purple',
                title: 'Manajemen Tim',
                desc: 'Atur roster, pemain, dan statistik tim',
              },
            ].map((feat) => {
              const colorMap: Record<string, string> = {
                emerald:
                  'from-emerald-500/20 to-emerald-500/5 ring-emerald-500/20 text-emerald-400',
                blue: 'from-blue-500/20 to-blue-500/5 ring-blue-500/20 text-blue-400',
                purple:
                  'from-purple-500/20 to-purple-500/5 ring-purple-500/20 text-purple-400',
              };
              const cls = colorMap[feat.color];
              return (
                <div
                  key={feat.title}
                  className="group flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-5 py-4 backdrop-blur-lg transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.06]"
                >
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ring-1 ${cls}`}
                  >
                    <feat.icon className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-white/90">
                      {feat.title}
                    </p>
                    <p className="text-xs text-slate-500">{feat.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center divider line */}
        <div className="absolute bottom-0 right-0 top-0 w-px bg-gradient-to-b from-transparent via-white/[0.08] to-transparent" />
      </div>

      {/* ── Right panel – Form ── */}
      <div className="relative flex w-full flex-col items-center justify-center px-6 py-12 lg:w-[45%]">
        {/* Mobile logo */}
        <div className="mb-10 flex items-center gap-3 lg:hidden">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/20">
            <Trophy className="h-6 w-6 text-white" />
          </div>
          <Link href="/" className="text-3xl font-bold text-white">
            Sport<span className="text-emerald-400">Score</span>
          </Link>
        </div>

        <div className="w-full max-w-md">
          {/* ✦ Main glass card ✦ */}
          <div className="relative rounded-3xl border border-white/[0.08] bg-white/[0.04] p-8 shadow-2xl shadow-black/30 backdrop-blur-2xl sm:p-10">
            {/* Inner glow at top */}
            <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
            {/* Subtle inner highlight */}
            <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-b from-white/[0.04] to-transparent" />

            <div className="relative">{children}</div>
          </div>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-slate-600/60">
            © 2026 SportScore. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
