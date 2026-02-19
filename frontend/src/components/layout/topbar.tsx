'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useUIStore } from '@/lib/stores/ui.store';
import { UserRole } from '@/lib/types';
import { Menu, ChevronRight, LogOut } from 'lucide-react';
import InitialsAvatar from '@/components/ui/initials-avatar';

function buildBreadcrumbs(pathname: string): { label: string; href: string }[] {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: { label: string; href: string }[] = [];

  let currentPath = '';
  for (const segment of segments) {
    currentPath += `/${segment}`;
    breadcrumbs.push({
      label: segment
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      href: currentPath,
    });
  }

  return breadcrumbs;
}

export function Topbar() {
  const { user, logout } = useAuthStore();
  const { toggleSidebar } = useUIStore();
  const router = useRouter();
  const pathname = usePathname();
  const breadcrumbs = buildBreadcrumbs(pathname);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const profileHref = user?.role === UserRole.ORGANIZER
    ? '/organizer/profile'
    : '/team-manager/profile';

  const fullName = user ? `${user.firstName} ${user.lastName}`.trim() : '';

  return (
    <header className="flex h-14 items-center justify-between border-b border-white/10 bg-background-secondary px-4 sm:px-6">
      {/* Left section */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="rounded p-2 text-slate-400 hover:bg-white/10 hover:text-slate-200 transition-colors lg:hidden"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        <nav className="hidden items-center gap-1 text-sm sm:flex" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.href}>
              {idx > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
              )}
              <span
                className={
                  idx === breadcrumbs.length - 1
                    ? 'font-medium text-slate-100'
                    : 'text-slate-400'
                }
              >
                {crumb.label}
              </span>
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        {user && (
          <>
            <Link
              href={profileHref}
              className="hidden items-center gap-2 sm:flex hover:opacity-80 transition-opacity"
            >
              <InitialsAvatar
                name={fullName}
                imageUrl={user.avatarUrl}
                size="sm"
              />
              <span className="text-sm font-medium text-slate-200">
                {fullName}
              </span>
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded px-3 py-2 text-sm text-slate-400 hover:bg-white/10 hover:text-slate-200 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
}
