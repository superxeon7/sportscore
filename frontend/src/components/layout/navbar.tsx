'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth.store';
import { UserRole } from '@/lib/types';
import { Menu, X, ChevronDown, User, LayoutDashboard, LogOut, Trophy } from 'lucide-react';

const navLinks = [
  { href: '/', label: 'Beranda' },
  { href: '/events', label: 'Acara' },
  { href: '/matches', label: 'Pertandingan' },
  { href: '/teams', label: 'Tim' },
  { href: '/players', label: 'Pemain' },
  { href: '/about', label: 'Tentang' },
];

function getDashboardPath(role: UserRole): string {
  switch (role) {
    case UserRole.ADMIN:
      return '/admin';
    case UserRole.ORGANIZER:
      return '/organizer';
    case UserRole.TEAM_MANAGER:
      return '/team-manager';
    default:
      return '/';
  }
}

export function Navbar() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    setDropdownOpen(false);
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0a0f1c]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
            <Trophy className="h-4.5 w-4.5 text-emerald-400" />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">
            Sport<span className="text-emerald-400">Score</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Auth section */}
        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] transition-colors"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-sm font-semibold text-white">
                  {user.firstName?.[0]}
                  {user.lastName?.[0]}
                </span>
                <span className="text-white">
                  {user.firstName} {user.lastName}
                </span>
                <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-white/[0.08] bg-[#1a2236] py-1 shadow-2xl animate-fade-in">
                  <Link
                    href="/profile"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white"
                  >
                    <User className="h-4 w-4 text-slate-500" />
                    Profil
                  </Link>
                  <Link
                    href={getDashboardPath(user.role)}
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white"
                  >
                    <LayoutDashboard className="h-4 w-4 text-slate-500" />
                    Dasbor
                  </Link>
                  <hr className="my-1 border-white/[0.06]" />
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white"
                  >
                    <LogOut className="h-4 w-4 text-slate-500" />
                    Keluar
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 hover:bg-white/[0.06] hover:text-white transition-colors"
              >
                Masuk
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
              >
                Daftar
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.06] hover:text-white md:hidden"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Mobile menu */}
      <div
        className={`overflow-hidden transition-all duration-200 md:hidden ${mobileMenuOpen ? 'max-h-96' : 'max-h-0'
          }`}
      >
        <div className="border-t border-white/[0.06] bg-[#0d1424] px-4 py-3">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/[0.06] hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <hr className="my-3 border-white/[0.06]" />
          {user ? (
            <div className="flex flex-col gap-1">
              <Link
                href={getDashboardPath(user.role)}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/[0.06] hover:text-white"
              >
                Dasbor
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-400 hover:bg-white/[0.06] hover:text-white"
              >
                Keluar
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/[0.06] hover:text-white"
              >
                Masuk
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg bg-emerald-500 px-3 py-2.5 text-center text-sm font-semibold text-white hover:bg-emerald-400"
              >
                Daftar
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
