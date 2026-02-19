'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useUIStore } from '@/lib/stores/ui.store';
import { UserRole } from '@/lib/types';
import {
  LayoutDashboard,
  Users,
  Trophy,
  Calendar,
  FileText,
  Play,
  Flag,
  UserCircle,
  Shield,
  FolderTree,
  Medal,
  Briefcase,
} from 'lucide-react';
import InitialsAvatar from '@/components/ui/initials-avatar';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const adminNav: NavItem[] = [
  { href: '/admin', label: 'Dasbor', icon: <LayoutDashboard className="h-5 w-5" /> },
  { href: '/admin/users', label: 'Pengguna', icon: <Users className="h-5 w-5" /> },
  { href: '/admin/sports', label: 'Olahraga', icon: <Trophy className="h-5 w-5" /> },
  { href: '/admin/events', label: 'Acara', icon: <Calendar className="h-5 w-5" /> },
  { href: '/admin/audit-logs', label: 'Log Audit', icon: <FileText className="h-5 w-5" /> },
];

const organizerNav: NavItem[] = [
  { href: '/organizer', label: 'Dasbor', icon: <LayoutDashboard className="h-5 w-5" /> },
  { href: '/organizer/events', label: 'Acara Saya', icon: <Calendar className="h-5 w-5" /> },
  { href: '/organizer/live-scoring', label: 'Skor Langsung', icon: <Play className="h-5 w-5" /> },
  { href: '/organizer/profile', label: 'Profil Saya', icon: <UserCircle className="h-5 w-5" /> },
];

const teamManagerNav: NavItem[] = [
  { href: '/team-manager', label: 'Dasbor', icon: <LayoutDashboard className="h-5 w-5" /> },
  { href: '/team-manager/teams', label: 'Tim Saya', icon: <Flag className="h-5 w-5" /> },
  { href: '/team-manager/players', label: 'Pemain', icon: <UserCircle className="h-5 w-5" /> },
  { href: '/team-manager/divisions', label: 'Divisi Tim', icon: <FolderTree className="h-5 w-5" /> },
  { href: '/team-manager/officials', label: 'Ofisial Tim', icon: <Briefcase className="h-5 w-5" /> },
  { href: '/team-manager/tournament-categories', label: 'Kategori Turnamen', icon: <Medal className="h-5 w-5" /> },
  { href: '/team-manager/matches', label: 'Jadwal & Lineup', icon: <Calendar className="h-5 w-5" /> },
  { href: '/team-manager/profile', label: 'Profil & Tim', icon: <UserCircle className="h-5 w-5" /> },
];

function getNavItems(role: UserRole): NavItem[] {
  switch (role) {
    case UserRole.ADMIN:
      return adminNav;
    case UserRole.ORGANIZER:
      return organizerNav;
    case UserRole.TEAM_MANAGER:
      return teamManagerNav;
    default:
      return [];
  }
}

function getRoleLabel(role: UserRole): string {
  switch (role) {
    case UserRole.ADMIN: return 'Admin';
    case UserRole.ORGANIZER: return 'Penyelenggara';
    case UserRole.TEAM_MANAGER: return 'Manajer Tim';
    default: return role;
  }
}

export function Sidebar() {
  const { user } = useAuthStore();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const pathname = usePathname();

  if (!user) return null;

  const navItems = getNavItems(user.role);
  const fullName = `${user.firstName} ${user.lastName}`.trim();
  const profileHref = user.role === UserRole.ORGANIZER ? '/organizer/profile' : '/team-manager/profile';

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar - fixed dark design */}
      <aside
        className={`fixed left-0 top-0 z-30 flex h-screen w-60 flex-col bg-sidebar-bg pt-16 lg:relative lg:pt-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          } transition-transform duration-200 lg:transition-none`}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Trophy className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-sm font-bold text-white tracking-wide">SportScore</span>
            <span className="block text-[10px] text-sidebar-text uppercase tracking-wider">
              {getRoleLabel(user.role)}
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Menu
          </p>
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/' && item.href !== '/admin' && pathname.startsWith(item.href + '/'));
            const isExactActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 mb-0.5 ${isActive || isExactActive
                  ? 'bg-primary/15 text-white'
                  : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white'
                  }`}
              >
                {/* Active indicator bar */}
                {(isActive || isExactActive) && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-primary" />
                )}
                <span className={`flex-shrink-0 ${isActive || isExactActive ? 'text-primary-light' : 'text-slate-400 group-hover:text-slate-300'}`}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User info at bottom */}
        <div className="border-t border-white/10 px-4 py-4">
          <Link href={profileHref} className="flex items-center gap-3 group">
            <InitialsAvatar
              name={fullName}
              imageUrl={user.avatarUrl}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-white group-hover:text-primary-light transition-colors">
                {fullName}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                <Shield className="h-3 w-3" />
                {getRoleLabel(user.role)}
              </div>
            </div>
          </Link>
        </div>
      </aside>
    </>
  );
}
