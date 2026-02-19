'use client';

import { Standing } from '@/lib/types';
import InitialsAvatar from '@/components/ui/initials-avatar';

interface StandingsTableProps {
  standings: Standing[];
  title?: string;
  highlightTopN?: number;
}

function getFormIndicator(result: string) {
  switch (result.toUpperCase()) {
    case 'W':
      return (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold">
          W
        </span>
      );
    case 'D':
      return (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-400 text-white text-[10px] font-bold">
          D
        </span>
      );
    case 'L':
      return (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold">
          L
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/[0.1] text-slate-400 text-[10px] font-bold">
          -
        </span>
      );
  }
}

export default function StandingsTable({
  standings,
  title,
  highlightTopN = 2,
}: StandingsTableProps) {
  if (!standings || standings.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        Klasemen belum tersedia.
      </div>
    );
  }

  const sorted = [...standings].sort(
    (a, b) => (a.position ?? 999) - (b.position ?? 999)
  );

  return (
    <div className="overflow-x-auto">
      {title && (
        <h3 className="text-lg font-semibold text-white mb-3">{title}</h3>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-white/[0.08] text-left">
            <th className="py-2 px-2 font-semibold text-slate-400 w-10">#</th>
            <th className="py-2 px-2 font-semibold text-slate-400">Tim</th>
            <th className="py-2 px-2 font-semibold text-slate-400 text-center w-10">P</th>
            <th className="py-2 px-2 font-semibold text-slate-400 text-center w-10">W</th>
            <th className="py-2 px-2 font-semibold text-slate-400 text-center w-10">D</th>
            <th className="py-2 px-2 font-semibold text-slate-400 text-center w-10">L</th>
            <th className="py-2 px-2 font-semibold text-slate-400 text-center w-10 hidden md:table-cell">GF</th>
            <th className="py-2 px-2 font-semibold text-slate-400 text-center w-10 hidden md:table-cell">GA</th>
            <th className="py-2 px-2 font-semibold text-slate-400 text-center w-10 hidden md:table-cell">GD</th>
            <th className="py-2 px-2 font-semibold text-slate-400 text-center w-12">Pts</th>
            <th className="py-2 px-2 font-semibold text-slate-400 text-center hidden sm:table-cell">Performa</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((standing, index) => {
            const position = standing.position ?? index + 1;
            const isHighlighted = position <= highlightTopN;
            const form = standing.form
              ? standing.form.split('').slice(-5)
              : [];

            return (
              <tr
                key={standing.id || index}
                className={`
                  border-b border-white/[0.04] transition-colors hover:bg-white/[0.03]
                  ${isHighlighted ? 'bg-emerald-500/10 hover:bg-emerald-500/15' : ''}
                `}
              >
                <td className="py-2.5 px-2">
                  <span
                    className={`
                      inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                      ${isHighlighted ? 'bg-emerald-500 text-white' : 'text-slate-500'}
                    `}
                  >
                    {position}
                  </span>
                </td>
                <td className="py-2.5 px-2 font-medium text-white">
                  <div className="flex items-center gap-2">
                    <InitialsAvatar
                      name={standing.team?.name || '?'}
                      imageUrl={(standing.team as any)?.logoUrl}
                      size="xs"
                    />
                    <span className="truncate">{standing.team?.name || 'Tidak Diketahui'}</span>
                  </div>
                </td>
                <td className="py-2.5 px-2 text-center text-slate-400">{standing.played ?? 0}</td>
                <td className="py-2.5 px-2 text-center text-slate-400">{standing.won ?? 0}</td>
                <td className="py-2.5 px-2 text-center text-slate-400">{standing.drawn ?? 0}</td>
                <td className="py-2.5 px-2 text-center text-slate-400">{standing.lost ?? 0}</td>
                <td className="py-2.5 px-2 text-center text-slate-400 hidden md:table-cell">
                  {standing.goalsFor ?? 0}
                </td>
                <td className="py-2.5 px-2 text-center text-slate-400 hidden md:table-cell">
                  {standing.goalsAgainst ?? 0}
                </td>
                <td className="py-2.5 px-2 text-center text-slate-400 hidden md:table-cell">
                  {(standing.goalDifference ?? 0) >= 0 ? '+' : ''}
                  {standing.goalDifference ?? 0}
                </td>
                <td className="py-2.5 px-2 text-center font-bold text-white">
                  {standing.points ?? 0}
                </td>
                <td className="py-2.5 px-2 text-center hidden sm:table-cell">
                  <div className="flex items-center justify-center gap-0.5">
                    {form.length > 0 ? (
                      form.map((result, i) => (
                        <span key={i}>{getFormIndicator(result)}</span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-600">-</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
