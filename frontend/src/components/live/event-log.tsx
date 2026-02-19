'use client';

import React, { useEffect, useRef } from 'react';
import type { MatchEventRecord } from '@/lib/stores/live-match.store';

export interface EventLogProps {
  events: MatchEventRecord[];
  homeTeamId: string;
  awayTeamId: string;
}

/** Dark-themed row styles per event type */
function getEventStyle(type: string): { bg: string; border: string; accent: string; iconBg: string } {
  switch (type?.toUpperCase()) {
    case 'GOAL':
    case 'POINT':
      return {
        bg: 'bg-emerald-950/60',
        border: 'border-emerald-700/40',
        accent: 'text-emerald-400',
        iconBg: 'bg-emerald-900/80 text-emerald-300',
      };
    case 'OWN_GOAL':
      return {
        bg: 'bg-red-950/50',
        border: 'border-red-700/40',
        accent: 'text-red-400',
        iconBg: 'bg-red-900/80 text-red-300',
      };
    case 'YELLOW_CARD':
      return {
        bg: 'bg-yellow-950/40',
        border: 'border-yellow-700/30',
        accent: 'text-yellow-400',
        iconBg: 'bg-yellow-900/80 text-yellow-300',
      };
    case 'RED_CARD':
      return {
        bg: 'bg-red-950/50',
        border: 'border-red-700/40',
        accent: 'text-red-400',
        iconBg: 'bg-red-900/80 text-red-300',
      };
    case 'SUBSTITUTION':
      return {
        bg: 'bg-blue-950/40',
        border: 'border-blue-700/30',
        accent: 'text-blue-400',
        iconBg: 'bg-blue-900/80 text-blue-300',
      };
    case 'FOUL':
    case 'PENALTY':
      return {
        bg: 'bg-orange-950/40',
        border: 'border-orange-700/30',
        accent: 'text-orange-400',
        iconBg: 'bg-orange-900/80 text-orange-300',
      };
    case 'PERIOD_START':
    case 'PERIOD_END':
      return {
        bg: 'bg-slate-800/50',
        border: 'border-slate-600/30',
        accent: 'text-slate-400',
        iconBg: 'bg-slate-700/80 text-slate-300',
      };
    default:
      return {
        bg: 'bg-slate-800/50',
        border: 'border-slate-600/30',
        accent: 'text-slate-400',
        iconBg: 'bg-slate-700/80 text-slate-300',
      };
  }
}

function getEventIcon(type: string): React.ReactNode {
  switch (type?.toUpperCase()) {
    case 'GOAL':
    case 'POINT':
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
          <circle cx="12" cy="12" r="4" fill="currentColor" />
        </svg>
      );
    case 'YELLOW_CARD':
      return <div className="w-4 h-5 bg-yellow-400 rounded-sm shadow-sm" />;
    case 'RED_CARD':
      return <div className="w-4 h-5 bg-red-500 rounded-sm shadow-sm" />;
    case 'OWN_GOAL':
      return <span className="text-xs font-black tracking-tight">OG</span>;
    case 'SUBSTITUTION':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    case 'PENALTY':
      return <span className="text-xs font-black">PEN</span>;
    case 'FOUL':
      return <span className="text-xs font-black">F</span>;
    case 'PERIOD_START':
    case 'PERIOD_END':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    default:
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
}

function formatEventType(type: string): string {
  return (
    type
      ?.replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase()) || type
  );
}

/**
 * Scrolling timeline of match events with dark athletic theme.
 * Events from the home team are aligned left; away team events are aligned right.
 * Shows player name, jersey number, and minute for each event.
 */
export function EventLog({ events, homeTeamId, awayTeamId }: EventLogProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events.length]);

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-8">
        <h3 className="text-lg font-semibold text-slate-100 mb-6">
          Catatan Pertandingan
        </h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-800/80 border border-slate-700/50 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-slate-400 text-sm font-medium">Belum ada catatan</p>
          <p className="text-slate-500 text-xs mt-1">Semua aksi pertandingan akan muncul di sini</p>
        </div>
      </div>
    );
  }

  const sortedEvents = [...events].sort((a, b) => {
    const minuteA = a.minute ?? 0;
    const minuteB = b.minute ?? 0;
    if (minuteA !== minuteB) return minuteA - minuteB;
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-6">
      <h3 className="text-lg font-semibold text-slate-100 mb-4">
        Catatan Pertandingan
        <span className="ml-2 text-sm font-normal text-slate-500">
          ({events.length})
        </span>
      </h3>
      <div ref={containerRef} className="max-h-96 overflow-y-auto space-y-2 pr-1">
        {sortedEvents.map((event) => {
          const isHome = event.teamId === homeTeamId;
          const isAway = event.teamId === awayTeamId;
          const isPeriodEvent = event.type === 'PERIOD_START' || event.type === 'PERIOD_END';
          const style = getEventStyle(event.type);

          if (isPeriodEvent) {
            return (
              <div key={event.id} className="flex justify-center py-2">
                <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-800/60 rounded-full border border-slate-600/30">
                  <span className={style.accent}>{getEventIcon(event.type)}</span>
                  <span className="text-xs font-medium text-slate-400">
                    {event.description || formatEventType(event.type)}
                  </span>
                </div>
              </div>
            );
          }

          return (
            <div
              key={event.id}
              className={`flex items-center gap-3 py-3 px-4 rounded-xl border transition-colors ${isHome ? 'flex-row' : isAway ? 'flex-row-reverse text-right' : 'flex-row'
                } ${style.bg} ${style.border}`}
            >
              {/* Minute badge */}
              <div className="flex-shrink-0">
                {event.minute != null ? (
                  <span className="inline-flex items-center justify-center w-10 h-8 rounded-lg bg-slate-800/80 text-sm font-bold tabular-nums text-slate-200 border border-slate-600/30">
                    {event.minute}&apos;
                  </span>
                ) : (
                  <span className="w-10" />
                )}
              </div>

              {/* Event icon */}
              <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${style.iconBg}`}>
                {getEventIcon(event.type)}
              </div>

              {/* Player info + event type */}
              <div className={`flex-1 min-w-0 ${isAway ? 'text-right' : ''}`}>
                {event.playerName ? (
                  <div className="flex items-center gap-2 flex-wrap" style={{ justifyContent: isAway ? 'flex-end' : 'flex-start' }}>
                    {event.jerseyNumber != null && (
                      <span className="inline-flex items-center justify-center w-7 h-6 rounded bg-slate-700/80 text-xs font-bold text-slate-200 border border-slate-600/40">
                        #{event.jerseyNumber}
                      </span>
                    )}
                    <span className="text-sm font-bold text-slate-100 truncate">
                      {event.playerName}
                    </span>
                  </div>
                ) : null}

                <span className={`text-xs font-semibold ${style.accent} ${event.playerName ? 'opacity-80' : 'text-sm opacity-100'}`}>
                  {formatEventType(event.type)}
                </span>

                {event.description && (
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {event.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
