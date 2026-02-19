'use client';

import Link from 'next/link';
import { Event, EventStatus } from '@/lib/types';

interface EventCardProps {
  event: Event;
}

function getStatusBadge(status: EventStatus) {
  const styles: Record<string, string> = {
    [EventStatus.DRAFT]: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
    [EventStatus.PUBLISHED]: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    [EventStatus.ONGOING]: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    [EventStatus.COMPLETED]: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
    [EventStatus.CANCELLED]: 'bg-red-500/15 text-red-400 border-red-500/20',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[status] || 'bg-slate-500/15 text-slate-400 border-slate-500/20'}`}
    >
      {status}
    </span>
  );
}

function formatDateRange(startDate?: string, endDate?: string) {
  if (!startDate) return 'Tanggal belum ditentukan';
  const start = new Date(startDate);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  const startStr = start.toLocaleDateString(undefined, opts);
  if (!endDate) return startStr;
  const end = new Date(endDate);
  const endStr = end.toLocaleDateString(undefined, opts);
  return `${startStr} - ${endStr}`;
}

export default function EventCard({ event }: EventCardProps) {
  const slug = event.slug || event.id;

  return (
    <Link href={`/events/${slug}`}>
      <div className="glass-card p-5 cursor-pointer h-full flex flex-col transition-all duration-200 hover:scale-[1.02] group">
        {/* Gradient top accent */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          {event.sport && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {event.sport.name}
            </span>
          )}
          {getStatusBadge(event.status)}
        </div>

        {/* Name */}
        <h3 className="text-lg font-bold text-white mb-3 line-clamp-2 group-hover:text-emerald-400 transition-colors">
          {event.name}
        </h3>

        {/* Details */}
        <div className="space-y-2 mt-auto">
          {/* Date Range */}
          <div className="flex items-center gap-2.5 text-sm text-slate-400">
            <svg className="w-4 h-4 flex-shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{formatDateRange(event.startDate, event.endDate)}</span>
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex items-center gap-2.5 text-sm text-slate-400">
              <svg className="w-4 h-4 flex-shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="truncate">{event.location}</span>
            </div>
          )}

          {/* Team Count */}
          {event.maxTeams !== undefined && (
            <div className="flex items-center gap-2.5 text-sm text-slate-400">
              <svg className="w-4 h-4 flex-shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>
                {event.eventTeams?.length ?? 0}/{event.maxTeams} tim
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
