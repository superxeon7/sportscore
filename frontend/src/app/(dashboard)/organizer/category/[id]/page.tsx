'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet, apiPatch, apiPost } from '@/lib/api/client';
import { Tabs } from '@/components/ui/tabs';

import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    useDraggable,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import { useToast } from '@/components/ui/toast';

/* ────────────────────────────────────────────
   Types
   ──────────────────────────────────────────── */

interface Team {
    id: string;
    name: string;
    shortName?: string;
    logoUrl?: string;
    slug: string;
}

interface CategoryTeam {
    id: string;
    teamId: string;
    seed?: number | null;
    groupId?: string | null;
    team?: Team;
}

interface CategoryGroup {
    id: string;
    name: string;
    categoryId: string;
}

interface CategoryStage {
    id: string;
    stageType: string;
    stageOrder: number;
    groupCount?: number | null;
    qualifyPerGroup?: number | null;
    matchPerTeam?: number | null;
    penaltyEnabled: boolean;
    status: string;
}

interface BracketMatch {
    id: string;
    round?: number | null;
    matchIndex?: number | null;
    status: string;
    scheduledAt: string;
    venue?: string | null;
    matchDay?: number | null;
    stageType?: string | null;
    groupName?: string | null;
    groupId?: string | null;
    homeTeam?: Team | null;
    awayTeam?: Team | null;
    homeTeamId?: string | null;
    awayTeamId?: string | null;
    isBye?: boolean;
    matchScore?: { homeScore: number; awayScore: number } | null;
    homeScore: number;
    awayScore: number;
}

interface FormEntry {
    matchId: string;
    opponentName: string;
    teamScore: number;
    opponentScore: number;
    result: 'W' | 'L' | 'D' | 'WP' | 'LP';
    date: string;
}

interface StandingEntry {
    position: number;
    teamId: string;
    team: Team | null;
    played: number;
    win: number;
    draw: number;
    lose: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDiff: number;
    points: number;
    penaltyWins: number;
    penaltyLosses: number;
    form?: FormEntry[];
}

/* ────────────────────────────────────────────
   Sortable Team Card (for seeding)
   ──────────────────────────────────────────── */

function SortableTeamCard({ ct, index }: { ct: CategoryTeam; index: number }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: ct.teamId });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
        opacity: isDragging ? 0.6 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 
                        hover:border-emerald-500/30 transition-all cursor-grab active:cursor-grabbing"
        >
            <span className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                {index + 1}
            </span>
            {ct.team?.logoUrl ? (
                <img src={ct.team.logoUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />
            ) : (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-xs text-slate-400">
                    {ct.team?.name?.charAt(0) || '?'}
                </div>
            )}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{ct.team?.name || 'Unknown'}</p>
                {ct.team?.shortName && (
                    <p className="text-[10px] text-slate-500 truncate">{ct.team.shortName}</p>
                )}
            </div>
            <span className="text-slate-600 text-lg">⠿</span>
        </div>
    );
}

/* ────────────────────────────────────────────
   Team Pill for Drag (Groups tab)
   ──────────────────────────────────────────── */

function DraggableTeamPill({ ct, position }: { ct: CategoryTeam; position?: number }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: ct.teamId });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="flex items-center gap-2 p-2 rounded-lg border border-white/10 bg-white/[0.04] 
                        hover:border-emerald-500/30 cursor-grab active:cursor-grabbing transition-all"
        >
            {position !== undefined && (
                <span className="w-5 h-5 flex items-center justify-center rounded bg-white/10 text-[10px] text-slate-400 font-bold">
                    {position}
                </span>
            )}
            {ct.team?.logoUrl ? (
                <img src={ct.team.logoUrl} alt="" className="w-5 h-5 rounded object-cover" />
            ) : (
                <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-[9px] text-slate-500">
                    {ct.team?.name?.charAt(0) || '?'}
                </div>
            )}
            <span className="text-xs text-white truncate">{ct.team?.shortName || ct.team?.name || '?'}</span>
        </div>
    );
}

function DroppableGroup({ group, children, teamCount }: { group: CategoryGroup; children: React.ReactNode; teamCount: number }) {
    const { setNodeRef, isOver } = useDroppable({ id: `group-${group.id}` });
    return (
        <div
            ref={setNodeRef}
            className={`flex-shrink-0 w-56 rounded-xl border p-3 transition-all ${isOver
                ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10'
                : 'border-white/10 bg-white/[0.02]'
                }`}
        >
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{group.name}</h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-slate-400 font-medium">
                    {teamCount} tim
                </span>
            </div>
            <div className={`space-y-1.5 ${teamCount > 8 ? 'max-h-80 overflow-y-auto pr-1' : ''}`}>
                {children}
            </div>
            {teamCount === 0 && (
                <p className="text-[10px] text-slate-600 text-center py-4">Seret tim ke sini</p>
            )}
        </div>
    );
}

function DroppablePool({ children }: { children: React.ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({ id: 'pool' });
    return (
        <div
            ref={setNodeRef}
            className={`flex-shrink-0 w-56 rounded-xl border-2 border-dashed p-3 min-h-[120px] transition-all ${isOver ? 'border-yellow-500 bg-yellow-500/5' : 'border-white/10 bg-white/[0.01]'
                }`}
        >
            <h3 className="text-xs font-bold text-yellow-500 uppercase tracking-wider mb-3">Belum Diassign</h3>
            <div className="space-y-1.5">{children}</div>
        </div>
    );
}

/* ────────────────────────────────────────────
   Bracket Components — Professional Tournament Tree
   ──────────────────────────────────────────── */

// Match card dimensions for layout calculations
const MATCH_CARD_H = 88;   // height of a match card in px
const MATCH_GAP = 16;       // gap between match cards in same round
const ROUND_GAP = 80;      // horizontal gap between round columns
const CARD_W = 220;         // card width

/* ── Draggable team chip for pool ── */
function PoolTeamChip({ team, disabled }: { team: Team; disabled?: boolean }) {
    const dndId = `pool:${team.id}`;
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: dndId, disabled });

    return (
        <div
            ref={setNodeRef}
            {...(disabled ? {} : { ...attributes, ...listeners })}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all select-none
                ${disabled ? 'border-white/[0.04] opacity-30 cursor-default' : 'border-white/10 bg-white/[0.03] cursor-grab active:cursor-grabbing hover:border-emerald-500/30 hover:bg-emerald-500/5'}
                ${isDragging ? 'opacity-30 scale-95' : ''}`}
        >
            {team.logoUrl ? (
                <img src={team.logoUrl} alt="" className="w-5 h-5 rounded object-cover flex-shrink-0" />
            ) : (
                <div className="w-5 h-5 rounded bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-[9px] text-slate-400 font-bold flex-shrink-0">
                    {team.name.charAt(0)}
                </div>
            )}
            <span className="text-[11px] text-slate-300 font-medium truncate max-w-[100px]">{team.shortName || team.name}</span>
        </div>
    );
}

function TeamSlotRow({
    matchId,
    slot,
    team,
    isByeSlot,
    canDrag,
    canDrop,
    score,
    isWinner,
    isTop,
}: {
    matchId: string;
    slot: 'home' | 'away';
    team?: Team | null;
    isByeSlot?: boolean;
    canDrag?: boolean;
    canDrop?: boolean;
    score?: number | null;
    isWinner?: boolean;
    isTop?: boolean;
}) {
    const dndId = `b:${matchId}:${slot}`;
    const {
        attributes,
        listeners,
        setNodeRef: setDragRef,
        isDragging,
    } = useDraggable({ id: dndId, disabled: !canDrag || !team });
    const { setNodeRef: setDropRef, isOver } = useDroppable({ id: dndId, disabled: !canDrop });

    const setRef = (el: HTMLElement | null) => { setDragRef(el); setDropRef(el); };

    const baseClass = `flex items-center gap-2 h-[38px] px-3 transition-all ${isTop ? 'rounded-t-lg' : 'rounded-b-lg'}`;

    if (isByeSlot) {
        return (
            <div className={`${baseClass} bg-yellow-500/[0.04]`}>
                <div className="w-6 h-6 rounded-md bg-yellow-500/20 flex items-center justify-center text-[9px] text-yellow-500 font-black flex-shrink-0">B</div>
                <span className="text-[11px] text-yellow-500/50 italic font-medium tracking-wide">BYE</span>
            </div>
        );
    }

    if (!team) {
        return (
            <div ref={setDropRef} className={`${baseClass} ${isOver ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30 ring-inset' : 'border border-dashed border-transparent'} ${canDrop ? 'border-white/10' : ''}`}>
                <div className={`w-6 h-6 rounded-md flex-shrink-0 ${canDrop ? 'bg-white/[0.04] border border-dashed border-white/10' : 'bg-white/[0.04]'}`} />
                <span className={`text-[11px] italic ${canDrop ? 'text-slate-500' : 'text-slate-600'}`}>{canDrop ? 'Drop tim di sini' : 'TBD'}</span>
            </div>
        );
    }

    return (
        <div
            ref={setRef}
            {...(canDrag ? { ...attributes, ...listeners } : {})}
            className={`${baseClass} select-none group/slot
                ${isDragging ? 'opacity-30 scale-95' : ''}
                ${isOver ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30 ring-inset' : ''}
                ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''}
                ${isWinner ? 'bg-emerald-500/[0.08]' : 'hover:bg-white/[0.04]'}`}
        >
            {team.logoUrl ? (
                <img src={team.logoUrl} alt="" className="w-6 h-6 rounded-md object-cover flex-shrink-0 ring-1 ring-white/10" />
            ) : (
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-[10px] text-slate-400 font-bold flex-shrink-0 ring-1 ring-white/10">
                    {team.name.charAt(0)}
                </div>
            )}
            <span className={`text-[12px] flex-1 truncate leading-none ${isWinner ? 'text-white font-semibold' : 'text-slate-300 font-medium'}`}>
                {team.shortName || team.name}
            </span>
            {score !== null && score !== undefined && (
                <span className={`text-sm font-black tabular-nums w-6 text-center flex-shrink-0 ${isWinner ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {score}
                </span>
            )}
            {canDrag && team && (
                <span className="text-slate-700 text-[10px] opacity-0 group-hover/slot:opacity-100 transition-opacity flex-shrink-0">⠿</span>
            )}
        </div>
    );
}

function BracketMatchCard({
    match,
    canDrag,
    canDrop,
    onClick,
    matchNumber,
}: {
    match: BracketMatch;
    canDrag: boolean;
    canDrop?: boolean;
    onClick?: () => void;
    matchNumber?: number;
}) {
    const isCompleted = match.status === 'COMPLETED';
    const isDraft = match.status === 'DRAFT';
    const isLive = match.status === 'LIVE';
    const isLocked = isCompleted || isLive;
    const hs = match.matchScore?.homeScore;
    const as_ = match.matchScore?.awayScore;
    const homeWins = isCompleted && hs !== undefined && as_ !== undefined && hs > as_;
    const awayWins = isCompleted && hs !== undefined && as_ !== undefined && as_ > hs;

    const homeIsBye = !!match.isBye && !match.homeTeam;
    const awayIsBye = !!match.isBye && !match.awayTeam;

    const statusConfig: Record<string, { dot: string; ring: string; label: string; bg: string }> = {
        DRAFT: { dot: 'bg-slate-500', ring: 'border-white/[0.06]', label: 'Draft', bg: '' },
        PUBLISHED: { dot: 'bg-blue-400', ring: 'border-blue-500/20', label: 'Published', bg: '' },
        SCHEDULED: { dot: 'bg-blue-400', ring: 'border-blue-500/20', label: 'Terjadwal', bg: '' },
        WARMUP: { dot: 'bg-amber-400', ring: 'border-amber-500/20', label: 'Warmup', bg: '' },
        LIVE: { dot: 'bg-red-500 animate-pulse', ring: 'border-red-500/40 shadow-[0_0_12px_rgba(239,68,68,0.15)]', label: 'LIVE', bg: 'bg-red-500/[0.03]' },
        HALF_TIME: { dot: 'bg-amber-400', ring: 'border-amber-500/20', label: 'Half Time', bg: '' },
        PAUSED: { dot: 'bg-amber-400', ring: 'border-amber-500/20', label: 'Paused', bg: '' },
        COMPLETED: { dot: 'bg-emerald-400', ring: 'border-emerald-500/20', label: 'Selesai', bg: '' },
    };
    const sc = statusConfig[match.status] || statusConfig.DRAFT;

    const showEditHint = onClick && !canDrag && !canDrop && !isDraft;

    return (
        <div
            onClick={(!canDrag && !canDrop) ? onClick : undefined}
            className={`w-full rounded-lg border overflow-hidden transition-all relative group
                ${sc.ring} ${sc.bg}
                ${isDraft ? 'opacity-40' : ''}
                ${showEditHint ? 'cursor-pointer hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5' : ''}
                bg-[#0d1117]`}
        >
            {/* Status indicator bar */}
            <div className={`absolute top-0 left-0 right-0 h-[2px] ${isLive ? 'bg-gradient-to-r from-red-500 via-red-400 to-red-500 animate-pulse' : isCompleted ? 'bg-emerald-500/40' : 'bg-transparent'}`} />

            {/* Match number + time header */}
            <div className="flex items-center justify-between px-3 py-1 bg-white/[0.02] border-b border-white/[0.04]">
                <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                    <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">{sc.label}</span>
                </div>
                {matchNumber !== undefined && (
                    <span className="text-[9px] text-slate-600 font-mono">M{matchNumber}</span>
                )}
            </div>

            {/* Teams */}
            <TeamSlotRow
                matchId={match.id} slot="home" team={match.homeTeam}
                isByeSlot={homeIsBye}
                canDrag={canDrag && !isLocked && !isDraft}
                canDrop={(canDrop || canDrag) && !isLocked && !isDraft}
                score={isCompleted || isLive ? hs : undefined} isWinner={homeWins} isTop
            />
            <div className="h-px bg-white/[0.04] mx-2" />
            <TeamSlotRow
                matchId={match.id} slot="away" team={match.awayTeam}
                isByeSlot={awayIsBye}
                canDrag={canDrag && !isLocked && !isDraft}
                canDrop={(canDrop || canDrag) && !isLocked && !isDraft}
                score={isCompleted || isLive ? as_ : undefined} isWinner={awayWins}
            />

            {/* Schedule info footer */}
            {(match.scheduledAt || match.venue) && !isDraft && (
                <div className="px-3 py-1 bg-white/[0.015] border-t border-white/[0.04] flex items-center gap-2">
                    {match.scheduledAt && (
                        <span className="text-[9px] text-slate-500">
                            {new Date(match.scheduledAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                    {match.venue && <span className="text-[9px] text-slate-600">• {match.venue}</span>}
                </div>
            )}

            {/* Hover edit hint */}
            {showEditHint && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg pointer-events-none">
                    <span className="text-[10px] text-white font-semibold bg-emerald-600 px-2.5 py-1 rounded-md shadow">Edit Match</span>
                </div>
            )}
        </div>
    );
}

/* ── Match Edit Modal ── */
function MatchEditModal({
    match,
    onClose,
    onSave,
    saving,
}: {
    match: BracketMatch;
    onClose: () => void;
    onSave: (data: { scheduledAt?: string; venue?: string; homeScore?: number; awayScore?: number }) => Promise<void>;
    saving: boolean;
}) {
    const [form, setForm] = useState({
        scheduledAt: match.scheduledAt ? new Date(match.scheduledAt).toISOString().slice(0, 16) : '',
        venue: match.venue || '',
        homeScore: match.matchScore?.homeScore?.toString() ?? '',
        awayScore: match.matchScore?.awayScore?.toString() ?? '',
    });

    const isEditable = match.status !== 'COMPLETED' && match.status !== 'LIVE';
    const isCompleted = match.status === 'COMPLETED';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload: any = {};
        if (form.scheduledAt) payload.scheduledAt = new Date(form.scheduledAt).toISOString();
        if (form.venue) payload.venue = form.venue;
        if (isCompleted && form.homeScore !== '' && form.awayScore !== '') {
            payload.homeScore = parseInt(form.homeScore, 10);
            payload.awayScore = parseInt(form.awayScore, 10);
        }
        await onSave(payload);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            {/* Modal */}
            <div
                onClick={(e) => e.stopPropagation()}
                className="relative bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl shadow-black/50"
            >
                {/* Modal header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <div>
                        <h3 className="text-base font-bold text-white">Edit Match</h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            {match.homeTeam?.name || 'TBD'} vs {match.awayTeam?.name || 'TBD'}
                        </p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                        &times;
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Teams display */}
                    <div className="rounded-xl border border-white/10 overflow-hidden bg-white/[0.02]">
                        <div className="flex items-center gap-3 px-4 py-3">
                            {match.homeTeam?.logoUrl ? (
                                <img src={match.homeTeam.logoUrl} alt="" className="w-8 h-8 rounded-lg object-cover ring-1 ring-white/10" />
                            ) : (
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-xs text-slate-400 font-bold ring-1 ring-white/10">
                                    {match.homeTeam?.name?.charAt(0) || '?'}
                                </div>
                            )}
                            <span className="text-sm font-semibold text-white flex-1">{match.homeTeam?.name || 'TBD'}</span>
                            {isCompleted && (
                                <input
                                    type="number" min="0" value={form.homeScore}
                                    onChange={(e) => setForm(f => ({ ...f, homeScore: e.target.value }))}
                                    className="w-12 h-8 px-1 rounded-lg bg-white/5 border border-white/10 text-white text-sm text-center font-bold focus:outline-none focus:border-emerald-500/50"
                                />
                            )}
                        </div>
                        <div className="border-t border-white/[0.06] mx-4" />
                        <div className="flex items-center gap-3 px-4 py-3">
                            {match.awayTeam?.logoUrl ? (
                                <img src={match.awayTeam.logoUrl} alt="" className="w-8 h-8 rounded-lg object-cover ring-1 ring-white/10" />
                            ) : (
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-xs text-slate-400 font-bold ring-1 ring-white/10">
                                    {match.awayTeam?.name?.charAt(0) || '?'}
                                </div>
                            )}
                            <span className="text-sm font-semibold text-white flex-1">{match.awayTeam?.name || 'TBD'}</span>
                            {isCompleted && (
                                <input
                                    type="number" min="0" value={form.awayScore}
                                    onChange={(e) => setForm(f => ({ ...f, awayScore: e.target.value }))}
                                    className="w-12 h-8 px-1 rounded-lg bg-white/5 border border-white/10 text-white text-sm text-center font-bold focus:outline-none focus:border-emerald-500/50"
                                />
                            )}
                        </div>
                    </div>

                    {/* Schedule fields */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] text-slate-500 font-semibold uppercase tracking-wider mb-1.5">Jadwal</label>
                            <input
                                type="datetime-local"
                                value={form.scheduledAt}
                                onChange={(e) => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
                                disabled={!isEditable && !isCompleted}
                                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-500/50 disabled:opacity-40"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] text-slate-500 font-semibold uppercase tracking-wider mb-1.5">Venue</label>
                            <input
                                type="text" placeholder="Lapangan 1"
                                value={form.venue}
                                onChange={(e) => setForm(f => ({ ...f, venue: e.target.value }))}
                                disabled={!isEditable && !isCompleted}
                                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-500/50 disabled:opacity-40"
                            />
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose}
                            className="px-4 py-2 rounded-lg bg-white/5 text-slate-400 text-sm font-medium hover:bg-white/10 transition-colors">
                            Batal
                        </button>
                        <button type="submit" disabled={saving}
                            className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors flex items-center gap-2">
                            {saving ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Menyimpan...</> : 'Simpan'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ────────────────────────────────────────────
   Stage Stepper Component
   ──────────────────────────────────────────── */

function StageStepper({ stages, activeStage, onStageClick }: {
    stages: CategoryStage[];
    activeStage: number | null;
    onStageClick: (order: number) => void;
}) {
    if (stages.length === 0) return null;

    const stageLabels: Record<string, string> = {
        GROUP: 'Grup',
        SPECIAL_GROUP: 'Grup Khusus',
        GROUP_NEIGHBOR: 'Grup Neighbor',
        KNOCKOUT: 'Knockout',
        LEAGUE: 'Liga',
        DOUBLE_ELIMINATION: 'Double Elim',
        SWISS: 'Swiss',
    };

    const statusColors: Record<string, string> = {
        SETUP: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
        IN_PROGRESS: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        COMPLETED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    };

    return (
        <div className="flex items-center gap-2 px-6 py-3 border-b border-white/10 bg-white/[0.01] overflow-x-auto">
            {stages.map((stage, i) => {
                const isActive = activeStage === stage.stageOrder;
                const color = statusColors[stage.status] || statusColors.SETUP;
                return (
                    <React.Fragment key={stage.id}>
                        {i > 0 && <span className="text-slate-600 text-xs">→</span>}
                        <button
                            onClick={() => onStageClick(stage.stageOrder)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all whitespace-nowrap
                                ${isActive
                                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 shadow-md shadow-emerald-500/10'
                                    : `${color} hover:opacity-80`
                                }`}
                        >
                            <span className="w-5 h-5 flex items-center justify-center rounded-full bg-white/10 text-[10px] font-bold">
                                {stage.stageOrder}
                            </span>
                            {stageLabels[stage.stageType] || stage.stageType}
                            <span className={`w-1.5 h-1.5 rounded-full ${stage.status === 'IN_PROGRESS' ? 'bg-emerald-400 animate-pulse' :
                                stage.status === 'COMPLETED' ? 'bg-blue-400' : 'bg-slate-500'
                                }`} />
                        </button>
                    </React.Fragment>
                );
            })}
        </div>
    );
}

/* ────────────────────────────────────────────
   MAIN PAGE
   ──────────────────────────────────────────── */

export default function CategoryControlCenter() {
    const params = useParams();
    const router = useRouter();
    const categoryId = params.id as string;
    const toast = useToast();

    // Data state
    const [category, setCategory] = useState<any>(null);
    const [teams, setTeams] = useState<CategoryTeam[]>([]);
    const [groups, setGroups] = useState<CategoryGroup[]>([]);
    const [stages, setStages] = useState<CategoryStage[]>([]);
    const [bracket, setBracket] = useState<any>(null);
    const [matches, setMatches] = useState<BracketMatch[]>([]);
    const [standings, setStandings] = useState<{ penaltyEnabled: boolean; standings: StandingEntry[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeStage, setActiveStage] = useState<number | null>(null);

    // Fetch all data
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [cat, teamsRes, stagesRes, groupsRes] = await Promise.all([
                apiGet<any>(`/event-categories/${categoryId}`),
                apiGet<any>(`/event-categories/${categoryId}/teams`),
                apiGet<any>(`/event-categories/${categoryId}/stages`),
                apiGet<any>(`/event-categories/${categoryId}/stage-groups`),
            ]);
            setCategory(cat);
            const teamList = teamsRes?.data || teamsRes || [];
            setTeams(teamList.sort((a: CategoryTeam, b: CategoryTeam) => (a.seed ?? 999) - (b.seed ?? 999)));
            const stageList: CategoryStage[] = stagesRes?.data || stagesRes || [];
            setStages(stageList);
            setGroups(groupsRes?.data || groupsRes || []);

            // Set default active stage to first
            if (stageList.length > 0 && activeStage === null) {
                setActiveStage(stageList[0].stageOrder);
            }

            // fetch bracket
            try {
                const br = await apiGet<any>(`/event-categories/${categoryId}/bracket`);
                setBracket(br);
            } catch (e) {
                console.warn('Bracket fetch failed:', e);
                setBracket(null);
            }

            // fetch matches
            if (cat?.eventId) {
                try {
                    const matchRes = await apiGet<any>(`/events/${cat.eventId}/matches?eventCategoryId=${categoryId}`);
                    setMatches(matchRes?.data || matchRes || []);
                } catch { setMatches([]); }
            }

            // fetch standings
            try {
                const standingsRes = await apiGet<any>(`/event-categories/${categoryId}/standings`);
                setStandings(standingsRes);
            } catch { setStandings(null); }
        } catch (err: any) {
            toast.error(err.message || 'Gagal memuat data');
        } finally {
            setLoading(false);
        }
    }, [categoryId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Sensors for dnd-kit
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    // Determine what stage types exist
    const hasGroupStage = stages.some(s => ['GROUP', 'SPECIAL_GROUP', 'GROUP_NEIGHBOR'].includes(s.stageType));
    const hasKnockout = stages.some(s => s.stageType === 'KNOCKOUT');

    // Current active stage object
    const currentStage = stages.find(s => s.stageOrder === activeStage);

    // Filter matches by active stage
    const stageFilteredMatches = useMemo(() => {
        if (!currentStage) return matches;
        const stType = currentStage.stageType;
        if (['GROUP', 'SPECIAL_GROUP', 'GROUP_NEIGHBOR'].includes(stType)) {
            return matches.filter(m => m.groupId || m.groupName);
        }
        if (stType === 'KNOCKOUT') {
            return matches.filter(m => m.round != null && !m.groupId);
        }
        return matches;
    }, [matches, currentStage]);

    /* ────────────────────────────────────────
       TAB 1: SEEDING
       ──────────────────────────────────────── */

    const handleSeedingDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = teams.findIndex((t) => t.teamId === active.id);
        const newIndex = teams.findIndex((t) => t.teamId === over.id);
        const newTeams = arrayMove(teams, oldIndex, newIndex);
        setTeams(newTeams);

        try {
            setSaving(true);
            await apiPatch(`/event-categories/${categoryId}/seeding`, {
                teamIds: newTeams.map((t) => t.teamId),
            });
            toast.success('Urutan seed disimpan');
        } catch (err: any) {
            toast.error(err.message || 'Gagal menyimpan seed');
        } finally {
            setSaving(false);
        }
    };

    const SeedingTab = (
        <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-lg font-bold text-white">Urutan Seed Tim</h2>
                    <p className="text-slate-500 text-sm mt-1">Seret untuk mengatur ulang posisi seed</p>
                </div>
                {saving && (
                    <span className="text-xs text-emerald-400 animate-pulse">Menyimpan...</span>
                )}
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSeedingDragEnd}>
                <SortableContext items={teams.map((t) => t.teamId)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                        {teams.map((ct, i) => (
                            <SortableTeamCard key={ct.teamId} ct={ct} index={i} />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
            {teams.length === 0 && (
                <div className="text-center py-16 text-slate-500">
                    <p className="text-4xl mb-3">🏟️</p>
                    <p>Belum ada tim terdaftar di kategori ini</p>
                </div>
            )}
        </div>
    );

    /* ────────────────────────────────────────
       TAB 2: GROUPS
       ──────────────────────────────────────── */

    const unassignedTeams = teams.filter(ct => !ct.groupId);
    const groupedTeams = useMemo(() => {
        const map: Record<string, CategoryTeam[]> = {};
        for (const g of groups) map[g.id] = [];
        for (const ct of teams) {
            if (ct.groupId && map[ct.groupId]) {
                map[ct.groupId].push(ct);
            }
        }
        return map;
    }, [teams, groups]);

    const handleGroupDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const teamId = active.id as string;
        const overId = over.id as string;
        const draggedTeam = teams.find(t => t.teamId === teamId);

        let newGroupId: string | null = null;
        if (overId.startsWith('group-')) {
            newGroupId = overId.replace('group-', '');
        } else if (overId === 'pool') {
            newGroupId = null;
        } else {
            const targetTeam = teams.find(t => t.teamId === overId);
            if (targetTeam?.groupId) newGroupId = targetTeam.groupId;
            else newGroupId = null;
        }

        // Within-group reorder
        if (draggedTeam?.groupId && draggedTeam.groupId === newGroupId && !overId.startsWith('group-') && overId !== 'pool') {
            const groupTeams = teams.filter(t => t.groupId === newGroupId);
            const oldIndex = groupTeams.findIndex(t => t.teamId === teamId);
            const newIndex = groupTeams.findIndex(t => t.teamId === overId);
            if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

            const reordered = arrayMove(groupTeams, oldIndex, newIndex);
            const updatedTeams = teams.map(t => {
                if (t.groupId !== newGroupId) return t;
                const pos = reordered.findIndex(rt => rt.teamId === t.teamId);
                return { ...t, seed: pos + 1 };
            });
            setTeams(updatedTeams);

            try {
                await apiPatch(`/event-categories/${categoryId}/seeding`, {
                    teamIds: updatedTeams
                        .sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999))
                        .map(t => t.teamId),
                });
                toast.success('Posisi dalam grup diperbarui');
            } catch (err: any) {
                toast.error(err.message || 'Gagal memperbarui posisi');
                fetchData();
            }
            return;
        }

        // Cross-group move
        setTeams(prev => prev.map(t => t.teamId === teamId ? { ...t, groupId: newGroupId } : t));

        try {
            await apiPatch(`/event-categories/${categoryId}/teams/${teamId}/group`, { groupId: newGroupId });
            toast.success(newGroupId ? 'Tim diassign ke grup' : 'Tim dihapus dari grup');
        } catch (err: any) {
            toast.error(err.message || 'Gagal mengassign');
            fetchData();
        }
    };

    const handleGenerateFixtures = async () => {
        try {
            setSaving(true);
            await apiPost(`/event-categories/${categoryId}/generate-group-fixtures`);
            toast.success('Fixture berhasil di-generate!');
            fetchData();
        } catch (err: any) {
            toast.error(err.message || 'Gagal generate fixture');
        } finally {
            setSaving(false);
        }
    };

    const [recalculating, setRecalculating] = useState(false);
    const [matchDetailId, setMatchDetailId] = useState<string | null>(null);
    const [matchDetail, setMatchDetail] = useState<any>(null);
    const [matchDetailLoading, setMatchDetailLoading] = useState(false);

    const handleOpenMatchDetail = async (matchId: string) => {
        setMatchDetailId(matchId);
        setMatchDetailLoading(true);
        try {
            const res = await apiGet<any>(`/matches/public/${matchId}`);
            setMatchDetail(res);
        } catch {
            setMatchDetail(null);
        } finally {
            setMatchDetailLoading(false);
        }
    };

    const handleCloseMatchDetail = () => {
        setMatchDetailId(null);
        setMatchDetail(null);
    };

    const handleRecalculateStandings = async () => {
        try {
            setRecalculating(true);
            const standingsRes = await apiPost<any>(`/event-categories/${categoryId}/recalculate-standings`);
            setStandings(standingsRes);
            toast.success('Klasemen berhasil dihitung ulang');
        } catch (err: any) {
            toast.error(err.message || 'Gagal menghitung ulang klasemen');
        } finally {
            setRecalculating(false);
        }
    };

    const GroupsTab = (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-lg font-bold text-white">Pengelolaan Grup</h2>
                    <p className="text-slate-500 text-sm mt-1">Seret tim ke dalam kolom grup atau atur ulang posisi dalam grup</p>
                </div>
                <button
                    onClick={handleGenerateFixtures}
                    disabled={saving || unassignedTeams.length > 0}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center gap-2"
                >
                    <span>⚽</span> Generate Fixture
                    {saving && <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />}
                </button>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGroupDragEnd}>
                <SortableContext items={teams.map(t => t.teamId)}>
                    <div className="flex gap-4 overflow-x-auto pb-4">
                        <DroppablePool>
                            {unassignedTeams.map(ct => (
                                <DraggableTeamPill key={ct.teamId} ct={ct} />
                            ))}
                        </DroppablePool>

                        {groups.map(g => {
                            const gTeams = groupedTeams[g.id] || [];
                            return (
                                <DroppableGroup key={g.id} group={g} teamCount={gTeams.length}>
                                    {gTeams.map((ct, idx) => (
                                        <DraggableTeamPill key={ct.teamId} ct={ct} position={idx + 1} />
                                    ))}
                                </DroppableGroup>
                            );
                        })}
                    </div>
                </SortableContext>
            </DndContext>

            {groups.length === 0 && (
                <div className="text-center py-16 text-slate-500">
                    <p className="text-4xl mb-3">📋</p>
                    <p>Belum ada grup. Grup dibuat otomatis saat kategori dikonfigurasi.</p>
                </div>
            )}
        </div>
    );

    /* ────────────────────────────────────────
       TAB 3: STANDINGS (NEW)
       ──────────────────────────────────────── */

    // Build standings grouped by CategoryGroup — always from teams+groups, overlay API data
    const standingsByGroup = useMemo(() => {
        // Build a lookup from API data (may be null/empty — that's fine)
        const standingsMap = new Map<string, StandingEntry>();
        if (standings?.standings) {
            for (const s of standings.standings) {
                standingsMap.set(s.teamId, s);
            }
        }

        const makeDefault = (ct: CategoryTeam): StandingEntry => ({
            position: 0,
            teamId: ct.teamId,
            team: ct.team || null,
            played: 0, win: 0, draw: 0, lose: 0,
            goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0,
            penaltyWins: 0, penaltyLosses: 0,
            form: [],
        });

        const sortEntries = (entries: StandingEntry[]) =>
            entries.sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
                return b.goalsFor - a.goalsFor;
            });

        const grouped: { groupId: string; groupName: string; entries: StandingEntry[] }[] = [];

        if (groups.length > 0) {
            // Has groups → one table per group
            for (const g of groups) {
                const gTeams = teams.filter(ct => ct.groupId === g.id);
                const entries: StandingEntry[] = gTeams.map(ct =>
                    standingsMap.get(ct.teamId) || makeDefault(ct),
                );
                sortEntries(entries);
                grouped.push({ groupId: g.id, groupName: g.name, entries });
            }
        } else if (teams.length > 0) {
            // No groups (league / swiss / etc) → single global table
            const entries: StandingEntry[] = teams.map(ct =>
                standingsMap.get(ct.teamId) || makeDefault(ct),
            );
            sortEntries(entries);
            grouped.push({ groupId: 'all', groupName: 'Klasemen', entries });
        }

        return grouped;
    }, [standings, teams, groups]);

    const StandingsTab = (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-lg font-bold text-white">Klasemen</h2>
                    <p className="text-slate-500 text-sm mt-1">
                        Klasemen otomatis berdasarkan hasil pertandingan yang selesai
                        {standings?.penaltyEnabled && (
                            <span className="ml-2 text-yellow-500 text-xs">• Mode penalti aktif</span>
                        )}
                    </p>
                </div>
                <button
                    onClick={handleRecalculateStandings}
                    disabled={recalculating}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center gap-2"
                >
                    {recalculating
                        ? <><span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> Menghitung...</>
                        : <><span>🔄</span> Hitung Ulang Klasemen</>
                    }
                </button>
            </div>

            {standingsByGroup.length > 0 ? (
                <div className="space-y-6">
                    {standingsByGroup.map(sg => (
                        <div key={sg.groupId} className="rounded-xl border border-white/10 overflow-hidden">
                            <div className="bg-white/5 px-4 py-2.5 border-b border-white/5">
                                <h3 className="text-sm font-bold text-emerald-400">{sg.groupName}</h3>
                            </div>
                            <div className="overflow-x-auto">
                            <table className="w-full min-w-[640px]">
                                <thead>
                                    <tr className="bg-white/[0.02]">
                                        <th className="text-left text-[10px] font-semibold text-slate-500 px-4 py-2 w-8">#</th>
                                        <th className="text-left text-[10px] font-semibold text-slate-500 px-4 py-2">Tim</th>
                                        <th className="text-center text-[10px] font-semibold text-slate-500 px-2 py-2 w-8">P</th>
                                        <th className="text-center text-[10px] font-semibold text-slate-500 px-2 py-2 w-8">W</th>
                                        <th className="text-center text-[10px] font-semibold text-slate-500 px-2 py-2 w-8">D</th>
                                        <th className="text-center text-[10px] font-semibold text-slate-500 px-2 py-2 w-8">L</th>
                                        <th className="text-center text-[10px] font-semibold text-slate-500 px-2 py-2 w-8">GF</th>
                                        <th className="text-center text-[10px] font-semibold text-slate-500 px-2 py-2 w-8">GA</th>
                                        <th className="text-center text-[10px] font-semibold text-slate-500 px-2 py-2 w-8">GD</th>
                                        {standings?.penaltyEnabled && (
                                            <>
                                                <th className="text-center text-[10px] font-semibold text-slate-500 px-2 py-2 w-8">PW</th>
                                                <th className="text-center text-[10px] font-semibold text-slate-500 px-2 py-2 w-8">PL</th>
                                            </>
                                        )}
                                        <th className="text-center text-[10px] font-bold text-emerald-400 px-2 py-2 w-10">PTS</th>
                                        <th className="text-center text-[10px] font-semibold text-slate-500 px-2 py-2">Form</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {sg.entries.map((entry, idx) => (
                                        <tr key={entry.teamId} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="px-4 py-2.5 text-xs text-slate-500 font-medium">{idx + 1}</td>
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center gap-2">
                                                    {entry.team?.logoUrl ? (
                                                        <img src={entry.team.logoUrl} alt="" className="w-5 h-5 rounded object-cover" />
                                                    ) : (
                                                        <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-[9px] text-slate-500">
                                                            {entry.team?.name?.charAt(0) || '?'}
                                                        </div>
                                                    )}
                                                    <span className="text-xs text-white font-medium truncate max-w-[140px]">
                                                        {entry.team?.name || 'Unknown'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="text-center text-xs text-slate-300 px-2 py-2.5">{entry.played}</td>
                                            <td className="text-center text-xs text-slate-300 px-2 py-2.5">{entry.win}</td>
                                            <td className="text-center text-xs text-slate-300 px-2 py-2.5">{entry.draw}</td>
                                            <td className="text-center text-xs text-slate-300 px-2 py-2.5">{entry.lose}</td>
                                            <td className="text-center text-xs text-slate-300 px-2 py-2.5">{entry.goalsFor}</td>
                                            <td className="text-center text-xs text-slate-300 px-2 py-2.5">{entry.goalsAgainst}</td>
                                            <td className={`text-center text-xs font-medium px-2 py-2.5 ${entry.goalDiff > 0 ? 'text-emerald-400' : entry.goalDiff < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                                                {entry.goalDiff > 0 ? `+${entry.goalDiff}` : entry.goalDiff}
                                            </td>
                                            {standings?.penaltyEnabled && (
                                                <>
                                                    <td className="text-center text-xs text-yellow-400 px-2 py-2.5">{entry.penaltyWins}</td>
                                                    <td className="text-center text-xs text-orange-400 px-2 py-2.5">{entry.penaltyLosses}</td>
                                                </>
                                            )}
                                            <td className="text-center text-xs font-bold text-emerald-400 px-2 py-2.5">{entry.points}</td>
                                            <td className="px-2 py-2.5">
                                                <div className="flex items-center justify-center gap-1">
                                                    {(entry.form || []).map((f, fi) => {
                                                        const colors: Record<string, string> = {
                                                            W: 'bg-emerald-500 hover:bg-emerald-400',
                                                            L: 'bg-red-500 hover:bg-red-400',
                                                            D: 'bg-slate-500 hover:bg-slate-400',
                                                            WP: 'bg-yellow-500 hover:bg-yellow-400',
                                                            LP: 'bg-orange-500 hover:bg-orange-400',
                                                        };
                                                        return (
                                                            <button
                                                                key={fi}
                                                                onClick={() => handleOpenMatchDetail(f.matchId)}
                                                                className={`w-5 h-5 rounded text-[9px] font-bold text-white flex items-center justify-center cursor-pointer transition-colors ${colors[f.result] || 'bg-slate-600'}`}
                                                                title={`${f.result} vs ${f.opponentName} (${f.teamScore}-${f.opponentScore})`}
                                                            >
                                                                {f.result.length > 1 ? f.result[0] : f.result}
                                                            </button>
                                                        );
                                                    })}
                                                    {(!entry.form || entry.form.length === 0) && (
                                                        <span className="text-[10px] text-slate-600">-</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 text-slate-500">
                    <p className="text-4xl mb-3">👥</p>
                    <p>Tambahkan tim ke kategori untuk melihat klasemen.</p>
                </div>
            )}

            {/* ── Match Detail Modal ── */}
            {matchDetailId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={handleCloseMatchDetail} />
                    <div className="relative z-10 w-full max-w-2xl mx-4 rounded-xl bg-slate-900 border border-slate-700/60 shadow-2xl shadow-black/40 max-h-[90vh] flex flex-col">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5 flex-shrink-0">
                            <h2 className="text-lg font-semibold text-slate-100">Detail Pertandingan</h2>
                            <button
                                onClick={handleCloseMatchDetail}
                                className="rounded p-1 text-slate-500 hover:bg-white/10 hover:text-slate-300 transition-colors"
                            >
                                <span className="text-xl leading-none">&times;</span>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="px-5 py-4 overflow-y-auto flex-1">
                            {matchDetailLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : !matchDetail ? (
                                <div className="text-center py-12 text-slate-500">Data pertandingan tidak ditemukan</div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Score Header */}
                                    <div className="text-center space-y-3">
                                        <div className="flex items-center justify-center gap-4">
                                            {/* Home */}
                                            <div className="flex-1 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <span className="text-sm font-semibold text-white truncate">
                                                        {matchDetail.homeTeam?.shortName || matchDetail.homeTeam?.name || 'TBD'}
                                                    </span>
                                                    {matchDetail.homeTeam?.logoUrl ? (
                                                        <img src={matchDetail.homeTeam.logoUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-xs text-slate-400">
                                                            {(matchDetail.homeTeam?.name || 'H')[0]}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {/* Score */}
                                            <div className="px-4">
                                                <span className="text-3xl font-bold text-white">
                                                    {matchDetail.matchScore
                                                        ? `${matchDetail.matchScore.homeScore} - ${matchDetail.matchScore.awayScore}`
                                                        : 'vs'}
                                                </span>
                                                {matchDetail.isPenaltyUsed && (
                                                    <div className="text-xs text-yellow-400 mt-1">
                                                        Pen: {matchDetail.homePenaltyScore} - {matchDetail.awayPenaltyScore}
                                                    </div>
                                                )}
                                            </div>
                                            {/* Away */}
                                            <div className="flex-1 text-left">
                                                <div className="flex items-center gap-2">
                                                    {matchDetail.awayTeam?.logoUrl ? (
                                                        <img src={matchDetail.awayTeam.logoUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-xs text-slate-400">
                                                            {(matchDetail.awayTeam?.name || 'A')[0]}
                                                        </div>
                                                    )}
                                                    <span className="text-sm font-semibold text-white truncate">
                                                        {matchDetail.awayTeam?.shortName || matchDetail.awayTeam?.name || 'TBD'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        {/* Meta info */}
                                        <div className="flex items-center justify-center gap-3 text-xs text-slate-500">
                                            {matchDetail.scheduledAt && (
                                                <span>{new Date(matchDetail.scheduledAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                            )}
                                            {matchDetail.venue && <span>• {matchDetail.venue}</span>}
                                            {matchDetail.groupName && <span>• {matchDetail.groupName}</span>}
                                        </div>
                                    </div>

                                    {/* Match Events / Goals */}
                                    {matchDetail.matchEvents && matchDetail.matchEvents.length > 0 && (
                                        <div className="rounded-lg border border-white/10 overflow-hidden">
                                            <div className="bg-white/5 px-4 py-2 border-b border-white/5">
                                                <h3 className="text-xs font-bold text-slate-400 uppercase">Kejadian Pertandingan</h3>
                                            </div>
                                            <div className="divide-y divide-white/5">
                                                {matchDetail.matchEvents.map((ev: any, i: number) => {
                                                    const isHome = ev.teamId === matchDetail.homeTeamId;
                                                    const eventIcons: Record<string, string> = {
                                                        GOAL: '\u26BD', OWN_GOAL: '\u26BD\uFE0F\u200D\u2B50', PENALTY_GOAL: '\u26BD(P)',
                                                        YELLOW_CARD: '\uD83D\uDFE8', RED_CARD: '\uD83D\uDFE5', SECOND_YELLOW: '\uD83D\uDFE8\uD83D\uDFE5',
                                                        SUBSTITUTION: '\uD83D\uDD04',
                                                    };
                                                    return (
                                                        <div key={i} className={`flex items-center gap-2 px-4 py-2 text-xs ${isHome ? '' : 'flex-row-reverse text-right'}`}>
                                                            <span className="text-slate-500 w-8 text-center flex-shrink-0">{ev.minute}&apos;</span>
                                                            <span className="flex-shrink-0">{eventIcons[ev.eventType] || '\u2022'}</span>
                                                            <span className="text-slate-200 truncate">
                                                                {ev.player?.fullName || ev.description || ev.eventType}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Lineups */}
                                    {matchDetail.matchLineups && matchDetail.matchLineups.length > 0 && (
                                        <div className="rounded-lg border border-white/10 overflow-hidden">
                                            <div className="bg-white/5 px-4 py-2 border-b border-white/5">
                                                <h3 className="text-xs font-bold text-slate-400 uppercase">Susunan Pemain</h3>
                                            </div>
                                            <div className="grid grid-cols-2 divide-x divide-white/5">
                                                {matchDetail.matchLineups.map((lineup: any) => (
                                                    <div key={lineup.id} className="p-3">
                                                        <h4 className="text-xs font-semibold text-slate-300 mb-2">
                                                            {lineup.team?.shortName || lineup.team?.name}
                                                        </h4>
                                                        <div className="space-y-1">
                                                            {lineup.players?.map((lp: any) => (
                                                                <div key={lp.id} className="flex items-center gap-1.5 text-[11px]">
                                                                    <span className="text-slate-500 w-5 text-right">{lp.jerseyNumber}</span>
                                                                    <span className={lp.isStarter ? 'text-slate-200' : 'text-slate-500'}>
                                                                        {lp.player?.fullName || 'Unknown'}
                                                                    </span>
                                                                    {!lp.isStarter && <span className="text-[9px] text-slate-600">(sub)</span>}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* POTM */}
                                    {matchDetail.playerOfTheMatch && (
                                        <div className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 flex items-center gap-3">
                                            <span className="text-yellow-400 text-lg">&#9733;</span>
                                            <div>
                                                <div className="text-[10px] text-slate-500 uppercase font-semibold">Pemain Terbaik</div>
                                                <div className="text-sm text-white font-medium">
                                                    {matchDetail.playerOfTheMatch.fullName}
                                                    {matchDetail.playerOfTheMatch.team && (
                                                        <span className="text-slate-500 ml-1">({matchDetail.playerOfTheMatch.team.shortName || matchDetail.playerOfTheMatch.team.name})</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    /* ────────────────────────────────────────
       TAB 4: BRACKET
       ──────────────────────────────────────── */

    const bracketRounds = useMemo(() => {
        if (!bracket) return {};
        if (bracket.type === 'STANDARD') return bracket.rounds || {};
        if (bracket.type === 'DOUBLE_ELIMINATION') return bracket.upper || {};
        return {};
    }, [bracket]);

    const roundKeys = Object.keys(bracketRounds).map(Number).sort((a, b) => a - b);

    const getRoundLabel = (round: number, totalRounds: number) => {
        const diff = totalRounds - round;
        if (diff === 0) return 'Final';
        if (diff === 1) return 'Semi Final';
        if (diff === 2) return 'Perempat Final';
        return `Babak ${round}`;
    };

    const knockoutStage = stages.find(s => s.stageType === 'KNOCKOUT');

    // Lightweight bracket-only refresh
    const fetchBracket = useCallback(async () => {
        try {
            const br = await apiGet<any>(`/event-categories/${categoryId}/bracket`);
            setBracket(br);
        } catch (e) {
            console.warn('Bracket fetch failed:', e);
        }
    }, [categoryId]);

    const refreshStages = useCallback(async () => {
        try {
            const stagesRes = await apiGet<any>(`/event-categories/${categoryId}/stages`);
            setStages(stagesRes?.data || stagesRes || []);
        } catch { /* non-critical */ }
    }, [categoryId]);

    const refreshMatches = useCallback(async () => {
        if (!category?.eventId) return;
        try {
            const matchRes = await apiGet<any>(`/events/${category.eventId}/matches?eventCategoryId=${categoryId}`);
            setMatches(matchRes?.data || matchRes || []);
        } catch { /* non-critical */ }
    }, [categoryId, category?.eventId]);

    const handleGenerateBracket = async () => {
        if (!knockoutStage) { toast.error('Tidak ada stage knockout di kategori ini'); return; }
        try {
            setSaving(true);
            const result = await apiPost<any>(`/stages/${knockoutStage.id}/generate-bracket`);
            if (result?.type) {
                setBracket(result);
            } else {
                await fetchBracket();
            }
            await Promise.all([refreshStages(), refreshMatches()]);
            setBracketEditMode(false);
            toast.success('Bracket berhasil di-generate');
        } catch (err: any) {
            toast.error(err.message || 'Gagal generate bracket');
        } finally {
            setSaving(false);
        }
    };

    const handleRegenerateBracket = async () => {
        if (!confirm('Yakin regenerate bracket? Semua match, skor, dan jadwal knockout akan dihapus dan dibuat ulang.')) return;
        if (!knockoutStage) { toast.error('Tidak ada stage knockout di kategori ini'); return; }
        try {
            setSaving(true);
            const result = await apiPost<any>(`/stages/${knockoutStage.id}/generate-bracket`);
            if (result?.type) {
                setBracket(result);
            } else {
                await fetchBracket();
            }
            // Refresh all related state: stages, matches, standings
            await Promise.all([refreshStages(), refreshMatches()]);
            setBracketEditMode(false);
            toast.success('Bracket berhasil di-regenerate. Match & jadwal telah direset.');
        } catch (err: any) {
            toast.error(err.message || 'Gagal regenerate');
        } finally {
            setSaving(false);
        }
    };

    const bracketDragEnabled = knockoutStage?.status !== 'COMPLETED' && knockoutStage?.status !== 'IN_PROGRESS';

    // Edit mode toggle for full manual bracket control
    const [bracketEditMode, setBracketEditMode] = useState(false);

    // Match edit modal state
    const [bracketEditMatch, setBracketEditMatch] = useState<BracketMatch | null>(null);

    const handleBracketMatchSave = async (data: { scheduledAt?: string; venue?: string; homeScore?: number; awayScore?: number }) => {
        if (!bracketEditMatch) return;
        try {
            setSaving(true);
            await apiPatch(`/matches/${bracketEditMatch.id}`, {
                ...(data.scheduledAt ? { scheduledAt: data.scheduledAt } : {}),
                venue: data.venue || null,
            });
            if (data.homeScore !== undefined && data.awayScore !== undefined) {
                await apiPatch(`/matches/${bracketEditMatch.id}/score`, {
                    homeScore: data.homeScore,
                    awayScore: data.awayScore,
                });
            }
            toast.success('Match disimpan');
            setBracketEditMatch(null);
            await fetchBracket();
        } catch (err: any) {
            toast.error(err.message || 'Gagal menyimpan');
        } finally {
            setSaving(false);
        }
    };

    // Collect all teams currently placed in any bracket match
    const teamsInBracket = useMemo(() => {
        const ids = new Set<string>();
        const allMatches = Object.values(bracketRounds).flat() as BracketMatch[];
        for (const m of allMatches) {
            if (m.homeTeamId) ids.add(m.homeTeamId);
            if (m.awayTeamId) ids.add(m.awayTeamId);
        }
        return ids;
    }, [bracketRounds]);

    // Teams available in pool (not placed in any bracket match)
    const poolTeams = useMemo(() => {
        return teams
            .filter(ct => ct.team && !teamsInBracket.has(ct.teamId))
            .map(ct => ct.team!)
            .filter(Boolean);
    }, [teams, teamsInBracket]);

    // ── Optimistic bracket state helpers ──
    // Apply a team swap/move directly to bracket state without waiting for API
    const applyBracketUpdate = useCallback((updates: { matchId: string; slot: 'home' | 'away'; teamId: string | null; team: Team | null }[]) => {
        setBracket((prev: any) => {
            if (!prev) return prev;
            const rounds = { ...(prev.rounds || prev.upper || {}) };
            for (const roundKey of Object.keys(rounds)) {
                rounds[roundKey] = (rounds[roundKey] as BracketMatch[]).map((m: BracketMatch) => {
                    const upd = updates.filter(u => u.matchId === m.id);
                    if (upd.length === 0) return m;
                    const copy = { ...m };
                    for (const u of upd) {
                        if (u.slot === 'home') {
                            copy.homeTeamId = u.teamId;
                            copy.homeTeam = u.team;
                        } else {
                            copy.awayTeamId = u.teamId;
                            copy.awayTeam = u.team;
                        }
                    }
                    return copy;
                });
            }
            if (prev.type === 'STANDARD') return { ...prev, rounds };
            if (prev.type === 'DOUBLE_ELIMINATION') return { ...prev, upper: rounds };
            return { ...prev, rounds };
        });
    }, []);

    // Full cross-match drag handler with optimistic updates
    const handleBracketDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const activeStr = active.id as string;
        const overStr = over.id as string;

        // Target must be a bracket slot
        if (!overStr.startsWith('b:')) return;
        const [, targetMatchId, targetSlot] = overStr.split(':') as [string, string, 'home' | 'away'];

        const allMatches = Object.values(bracketRounds).flat() as BracketMatch[];
        const targetMatch = allMatches.find(m => m.id === targetMatchId);
        if (!targetMatch) return;

        // Don't allow drops onto locked matches
        if (targetMatch.status === 'COMPLETED' || targetMatch.status === 'LIVE') return;

        // ── Case 1: Pool team → bracket slot ──
        if (activeStr.startsWith('pool:')) {
            const teamId = activeStr.replace('pool:', '');
            const draggedTeam = teams.find(ct => ct.teamId === teamId)?.team || null;
            if (!draggedTeam) return;

            // Find existing team in target slot (will be displaced to pool)
            const displacedTeam = targetSlot === 'home' ? targetMatch.homeTeam : targetMatch.awayTeam;
            const displacedTeamId = targetSlot === 'home' ? targetMatch.homeTeamId : targetMatch.awayTeamId;

            // Find if dragged team is already in another match, remove it
            const optimisticUpdates: { matchId: string; slot: 'home' | 'away'; teamId: string | null; team: Team | null }[] = [];
            const apiCalls: Promise<any>[] = [];

            for (const m of allMatches) {
                if (m.id === targetMatchId) continue;
                if (m.homeTeamId === teamId) {
                    optimisticUpdates.push({ matchId: m.id, slot: 'home', teamId: null, team: null });
                    apiCalls.push(apiPatch(`/matches/${m.id}`, { homeTeamId: null }));
                } else if (m.awayTeamId === teamId) {
                    optimisticUpdates.push({ matchId: m.id, slot: 'away', teamId: null, team: null });
                    apiCalls.push(apiPatch(`/matches/${m.id}`, { awayTeamId: null }));
                }
            }

            // Place team in target slot
            optimisticUpdates.push({ matchId: targetMatchId, slot: targetSlot, teamId, team: draggedTeam });
            apiCalls.push(apiPatch(`/matches/${targetMatchId}`, {
                [targetSlot === 'home' ? 'homeTeamId' : 'awayTeamId']: teamId,
            }));

            // Optimistic update first
            applyBracketUpdate(optimisticUpdates);

            try {
                await Promise.all(apiCalls);
            } catch (err: any) {
                toast.error(err.message || 'Gagal menempatkan tim');
                await fetchBracket(); // Revert on error
            }
            return;
        }

        // ── Case 2: Bracket slot → bracket slot (cross-match swap) ──
        if (!activeStr.startsWith('b:')) return;
        const [, srcMatchId, srcSlot] = activeStr.split(':') as [string, string, 'home' | 'away'];

        if (srcMatchId === targetMatchId) return;

        const srcMatch = allMatches.find(m => m.id === srcMatchId);
        if (!srcMatch) return;
        if (srcMatch.status === 'COMPLETED' || srcMatch.status === 'LIVE') return;

        const srcTeamId = srcSlot === 'home' ? srcMatch.homeTeamId : srcMatch.awayTeamId;
        const srcTeam = srcSlot === 'home' ? srcMatch.homeTeam : srcMatch.awayTeam;
        const tgtTeamId = targetSlot === 'home' ? targetMatch.homeTeamId : targetMatch.awayTeamId;
        const tgtTeam = targetSlot === 'home' ? targetMatch.homeTeam : targetMatch.awayTeam;

        // Optimistic swap
        applyBracketUpdate([
            { matchId: srcMatchId, slot: srcSlot, teamId: tgtTeamId || null, team: tgtTeam || null },
            { matchId: targetMatchId, slot: targetSlot, teamId: srcTeamId || null, team: srcTeam || null },
        ]);

        try {
            if (srcMatch.round === targetMatch.round) {
                // Same round: use dedicated swap endpoint
                await apiPatch(`/event-categories/${categoryId}/bracket/swap-teams`, {
                    matchId1: srcMatchId, slot1: srcSlot,
                    matchId2: targetMatchId, slot2: targetSlot,
                });
            } else {
                // Cross-round: parallel PATCH calls
                await Promise.all([
                    apiPatch(`/matches/${srcMatchId}`, {
                        [srcSlot === 'home' ? 'homeTeamId' : 'awayTeamId']: tgtTeamId || null,
                    }),
                    apiPatch(`/matches/${targetMatchId}`, {
                        [targetSlot === 'home' ? 'homeTeamId' : 'awayTeamId']: srcTeamId || null,
                    }),
                ]);
            }
        } catch (err: any) {
            toast.error(err.message || 'Gagal menukar tim');
            await fetchBracket(); // Revert on error
        }
    };

    // Compute bracket layout positions for the tree
    const bracketLayout = useMemo(() => {
        if (roundKeys.length === 0) return { roundPositions: [], totalHeight: 0, totalWidth: 0 };

        const roundPositions: { round: number; matches: BracketMatch[]; matchYPositions: number[] }[] = [];

        for (let ri = 0; ri < roundKeys.length; ri++) {
            const round = roundKeys[ri];
            const roundMatches = (bracketRounds[round] || []) as BracketMatch[];
            const matchYPositions: number[] = [];

            if (ri === 0) {
                for (let mi = 0; mi < roundMatches.length; mi++) {
                    matchYPositions.push(mi * (MATCH_CARD_H + MATCH_GAP));
                }
            } else {
                const prev = roundPositions[ri - 1];
                for (let mi = 0; mi < roundMatches.length; mi++) {
                    const feedTop = mi * 2;
                    const feedBot = mi * 2 + 1;
                    if (feedBot < prev.matchYPositions.length) {
                        const y1 = prev.matchYPositions[feedTop];
                        const y2 = prev.matchYPositions[feedBot];
                        matchYPositions.push((y1 + y2) / 2);
                    } else if (feedTop < prev.matchYPositions.length) {
                        matchYPositions.push(prev.matchYPositions[feedTop]);
                    } else {
                        matchYPositions.push(mi * (MATCH_CARD_H + MATCH_GAP));
                    }
                }
            }

            roundPositions.push({ round, matches: roundMatches, matchYPositions });
        }

        const allY = roundPositions.flatMap(r => r.matchYPositions.map(y => y + MATCH_CARD_H));
        const totalHeight = Math.max(...allY, 200);
        const totalWidth = roundKeys.length * (CARD_W + ROUND_GAP);

        return { roundPositions, totalHeight, totalWidth };
    }, [bracketRounds, roundKeys]);

    // Running match number counter
    let matchCounter = 0;

    const BracketTab = (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        Bracket Knockout
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                        {roundKeys.length === 0
                            ? 'Bracket belum di-generate'
                            : bracketEditMode
                                ? 'Mode edit aktif — seret tim dari pool atau antar slot untuk mengatur matchup'
                                : `${roundKeys.length} babak • Klik match untuk edit jadwal`}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {roundKeys.length > 0 && bracketDragEnabled && (
                        <button
                            onClick={() => setBracketEditMode(!bracketEditMode)}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2
                                ${bracketEditMode
                                    ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-lg shadow-amber-500/10'
                                    : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:border-white/20'}`}
                        >
                            {bracketEditMode ? (
                                <><span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" /> Edit Bracket</>
                            ) : (
                                'Edit Bracket'
                            )}
                        </button>
                    )}
                    {roundKeys.length === 0 ? (
                        <button
                            onClick={handleGenerateBracket}
                            disabled={saving || !knockoutStage}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                        >
                            {saving
                                ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating...</>
                                : 'Generate Bracket'}
                        </button>
                    ) : (
                        <>
                            {bracketEditMode && (
                                <button
                                    onClick={handleGenerateBracket}
                                    disabled={saving}
                                    className="px-4 py-2 rounded-xl bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/30 disabled:opacity-40 text-blue-400 text-sm font-semibold transition-all flex items-center gap-2"
                                >
                                    {saving
                                        ? <><span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> Seeding...</>
                                        : 'Auto Seed'}
                                </button>
                            )}
                            <button
                                onClick={handleRegenerateBracket}
                                disabled={saving}
                                className="px-4 py-2 rounded-xl bg-red-600/20 border border-red-500/30 hover:bg-red-600/30 disabled:opacity-40 text-red-400 text-sm font-semibold transition-all flex items-center gap-2"
                            >
                                {saving
                                    ? <><span className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" /> Mereset...</>
                                    : 'Regenerate'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Bracket tree */}
            {roundKeys.length > 0 ? (
                <DndContext sensors={sensors} onDragEnd={handleBracketDragEnd}>
                    {/* ── Team Pool (visible in edit mode) ── */}
                    {bracketEditMode && bracketDragEnabled && (
                        <div className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-amber-400 uppercase tracking-[0.15em]">Tim Tersedia</span>
                                    <span className="text-[10px] text-amber-500/50 font-medium">{poolTeams.length} tim</span>
                                </div>
                                <p className="text-[10px] text-slate-500">Seret tim ke slot bracket mana saja</p>
                            </div>
                            {poolTeams.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {poolTeams.map(team => (
                                        <PoolTeamChip key={team.id} team={team} />
                                    ))}
                                </div>
                            ) : (
                                <p className="text-[11px] text-slate-600 italic">Semua tim sudah ditempatkan di bracket</p>
                            )}
                        </div>
                    )}

                    <div className="overflow-x-auto pb-6 -mx-2 px-2">
                        <div
                            className="relative"
                            style={{
                                width: bracketLayout.totalWidth,
                                height: bracketLayout.totalHeight + 60,
                                minWidth: bracketLayout.totalWidth,
                            }}
                        >
                            {/* Round labels row */}
                            <div className="flex" style={{ gap: ROUND_GAP }}>
                                {bracketLayout.roundPositions.map(({ round, matches: rm }) => (
                                    <div key={`label-${round}`} className="text-center" style={{ width: CARD_W }}>
                                        <div className="inline-flex items-center gap-1.5 mb-1">
                                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.15em]">
                                                {getRoundLabel(round, roundKeys.length)}
                                            </span>
                                        </div>
                                        <p className="text-[9px] text-slate-600 font-medium">{rm.length} match</p>
                                    </div>
                                ))}
                            </div>

                            {/* Matches + connectors */}
                            <div className="relative" style={{ marginTop: 12 }}>
                                {bracketLayout.roundPositions.map(({ round, matches: roundMatches, matchYPositions }, ri) => {
                                    const colX = ri * (CARD_W + ROUND_GAP);

                                    return (
                                        <React.Fragment key={round}>
                                            {/* Connector lines to next round */}
                                            {ri < bracketLayout.roundPositions.length - 1 && (() => {
                                                const next = bracketLayout.roundPositions[ri + 1];
                                                const svgH = bracketLayout.totalHeight + 20;
                                                const paths: string[] = [];

                                                for (let ni = 0; ni < next.matches.length; ni++) {
                                                    const feedTop = ni * 2;
                                                    const feedBot = ni * 2 + 1;
                                                    const toY = next.matchYPositions[ni] + MATCH_CARD_H / 2;

                                                    if (feedBot < matchYPositions.length) {
                                                        const fromY1 = matchYPositions[feedTop] + MATCH_CARD_H / 2;
                                                        const fromY2 = matchYPositions[feedBot] + MATCH_CARD_H / 2;
                                                        const midX = ROUND_GAP / 2;
                                                        paths.push(`M 0 ${fromY1} H ${midX}`);
                                                        paths.push(`M 0 ${fromY2} H ${midX}`);
                                                        paths.push(`M ${midX} ${fromY1} V ${fromY2}`);
                                                        const mergeY = (fromY1 + fromY2) / 2;
                                                        paths.push(`M ${midX} ${mergeY} H ${ROUND_GAP}`);
                                                    } else if (feedTop < matchYPositions.length) {
                                                        const fromY = matchYPositions[feedTop] + MATCH_CARD_H / 2;
                                                        const midX = ROUND_GAP / 2;
                                                        paths.push(`M 0 ${fromY} H ${midX} V ${toY} H ${ROUND_GAP}`);
                                                    }
                                                }

                                                return (
                                                    <svg
                                                        key={`conn-${round}`}
                                                        className="absolute pointer-events-none"
                                                        style={{ left: colX + CARD_W, top: 0, width: ROUND_GAP, height: svgH }}
                                                    >
                                                        {paths.map((d, i) => (
                                                            <path key={i} d={d} fill="none" stroke="rgba(16,185,129,0.18)" strokeWidth="1.5" />
                                                        ))}
                                                    </svg>
                                                );
                                            })()}

                                            {/* Match cards */}
                                            {roundMatches.map((match, mi) => {
                                                matchCounter++;
                                                const mNum = matchCounter;
                                                const canDragSlots = bracketEditMode && bracketDragEnabled;
                                                const canDropSlots = bracketEditMode && bracketDragEnabled;
                                                return (
                                                    <div
                                                        key={match.id}
                                                        className="absolute"
                                                        style={{
                                                            left: colX,
                                                            top: matchYPositions[mi],
                                                            width: CARD_W,
                                                        }}
                                                    >
                                                        <BracketMatchCard
                                                            match={match}
                                                            canDrag={canDragSlots}
                                                            canDrop={canDropSlots}
                                                            onClick={() => setBracketEditMatch(match)}
                                                            matchNumber={mNum}
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </DndContext>
            ) : (
                <div className="text-center py-24">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 flex items-center justify-center">
                        <span className="text-3xl">🏆</span>
                    </div>
                    <p className="text-lg font-bold text-slate-300 mb-2">Bracket Belum Tersedia</p>
                    {knockoutStage ? (
                        <p className="text-sm text-slate-500 max-w-sm mx-auto">
                            Klik <span className="text-emerald-400 font-semibold">Generate Bracket</span> untuk membuat bracket turnamen otomatis dari urutan seed tim.
                        </p>
                    ) : (
                        <p className="text-sm text-slate-600 max-w-sm mx-auto">
                            Tambahkan stage Knockout ke kategori ini terlebih dahulu.
                        </p>
                    )}
                </div>
            )}

            {/* Match edit modal */}
            {bracketEditMatch && (
                <MatchEditModal
                    match={bracketEditMatch}
                    onClose={() => setBracketEditMatch(null)}
                    onSave={handleBracketMatchSave}
                    saving={saving}
                />
            )}
        </div>
    );

    /* ────────────────────────────────────────
       TAB 5: MATCH SCHEDULER
       ──────────────────────────────────────── */

    const [editingMatch, setEditingMatch] = useState<string | null>(null);
    const [scheduleForm, setScheduleForm] = useState({ scheduledAt: '', venue: '' });
    const [scoreForm, setScoreForm] = useState({ homeScore: '', awayScore: '' });
    const [editingMatchStatus, setEditingMatchStatus] = useState<string>('');
    const [bulkForm, setBulkForm] = useState({ startTime: '', intervalMinutes: 60, fieldCount: 1 });
    const [scheduleFilter, setScheduleFilter] = useState<string>('all');

    const handleEditMatch = (match: BracketMatch) => {
        setEditingMatch(match.id);
        setEditingMatchStatus(match.status);
        setScheduleForm({
            scheduledAt: match.scheduledAt ? new Date(match.scheduledAt).toISOString().slice(0, 16) : '',
            venue: match.venue || '',
        });
        setScoreForm({
            homeScore: match.matchScore?.homeScore?.toString() ?? '',
            awayScore: match.matchScore?.awayScore?.toString() ?? '',
        });
    };

    const handleSaveMatch = async (matchId: string) => {
        try {
            setSaving(true);

            // Save schedule info
            await apiPatch(`/matches/${matchId}`, {
                ...(scheduleForm.scheduledAt ? { scheduledAt: new Date(scheduleForm.scheduledAt).toISOString() } : {}),
                venue: scheduleForm.venue || null,
            });

            // If COMPLETED and score fields are filled, save the score too
            if (
                editingMatchStatus === 'COMPLETED' &&
                scoreForm.homeScore !== '' &&
                scoreForm.awayScore !== ''
            ) {
                const homeScore = parseInt(scoreForm.homeScore, 10);
                const awayScore = parseInt(scoreForm.awayScore, 10);
                if (!isNaN(homeScore) && !isNaN(awayScore)) {
                    await apiPatch(`/matches/${matchId}/score`, { homeScore, awayScore });
                }
            }

            toast.success('Disimpan');
            setEditingMatch(null);
            fetchData();
            // Also refresh standings
            apiGet<any>(`/event-categories/${categoryId}/standings`)
                .then(setStandings)
                .catch(() => {});
        } catch (err: any) {
            toast.error(err.message || 'Gagal menyimpan');
        } finally {
            setSaving(false);
        }
    };

    const handleBulkSchedule = async () => {
        if (!bulkForm.startTime) { toast.error('Masukkan waktu mulai'); return; }
        try {
            setSaving(true);
            const startDate = new Date(bulkForm.startTime);
            const updates = filteredScheduleMatches.map((m, i) => {
                const fieldIndex = i % bulkForm.fieldCount;
                const roundIndex = Math.floor(i / bulkForm.fieldCount);
                const time = new Date(startDate.getTime() + roundIndex * bulkForm.intervalMinutes * 60000);
                return {
                    matchId: m.id,
                    scheduledAt: time.toISOString(),
                    venue: bulkForm.fieldCount > 1 ? `Lapangan ${fieldIndex + 1}` : undefined,
                };
            });
            await apiPatch(`/event-categories/${categoryId}/matches/bulk-schedule`, { updates });
            toast.success(`${updates.length} pertandingan dijadwalkan`);
            fetchData();
        } catch (err: any) {
            toast.error(err.message || 'Gagal auto-schedule');
        } finally {
            setSaving(false);
        }
    };

    // Get unique group names for filter dropdown
    const groupFilterOptions = useMemo(() => {
        const names = new Set<string>();
        matches.forEach(m => {
            if (m.groupName) names.add(m.groupName);
        });
        return Array.from(names).sort();
    }, [matches]);

    const filteredScheduleMatches = useMemo(() => {
        if (scheduleFilter === 'all') return stageFilteredMatches;
        if (scheduleFilter === 'knockout') return stageFilteredMatches.filter(m => m.round != null && !m.groupId);
        return stageFilteredMatches.filter(m => m.groupName === scheduleFilter);
    }, [stageFilteredMatches, scheduleFilter]);

    const matchStatusConfig: Record<string, { bg: string; text: string; label: string }> = {
        COMPLETED: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Selesai' },
        LIVE: { bg: 'bg-red-500/15', text: 'text-red-400', label: 'Live' },
        ONGOING: { bg: 'bg-red-500/15', text: 'text-red-400', label: 'Berlangsung' },
        PUBLISHED: { bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'Published' },
        SCHEDULED: { bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'Dijadwalkan' },
        DRAFT: { bg: 'bg-slate-500/15', text: 'text-slate-400', label: 'Draft' },
    };

    const SchedulerTab = (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-bold text-white">Jadwal Pertandingan</h2>
                    <p className="text-slate-500 text-xs mt-1">{filteredScheduleMatches.length} pertandingan</p>
                </div>
                <select
                    value={scheduleFilter}
                    onChange={(e) => setScheduleFilter(e.target.value)}
                    className="w-full sm:w-auto px-3 py-2.5 sm:py-1.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:border-emerald-500 focus:outline-none"
                >
                    <option value="all">Semua</option>
                    {groupFilterOptions.map(name => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                    {hasKnockout && <option value="knockout">Knockout</option>}
                </select>
            </div>

            {/* Bulk Auto Schedule — collapsible on mobile */}
            <details className="group rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
                <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-white/[0.02] transition-colors">
                    <span className="text-sm font-semibold text-white">Auto Schedule</span>
                    <svg className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </summary>
                <div className="px-4 pb-4 pt-1">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <label className="block text-xs text-slate-400 mb-1">Waktu Mulai</label>
                            <input
                                type="datetime-local"
                                value={bulkForm.startTime}
                                onChange={(e) => setBulkForm(f => ({ ...f, startTime: e.target.value }))}
                                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:border-emerald-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Interval (mnt)</label>
                            <input
                                type="number"
                                min={15}
                                value={bulkForm.intervalMinutes}
                                onChange={(e) => setBulkForm(f => ({ ...f, intervalMinutes: Number(e.target.value) }))}
                                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:border-emerald-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Lapangan</label>
                            <input
                                type="number"
                                min={1}
                                max={10}
                                value={bulkForm.fieldCount}
                                onChange={(e) => setBulkForm(f => ({ ...f, fieldCount: Number(e.target.value) }))}
                                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:border-emerald-500 focus:outline-none"
                            />
                        </div>
                        <div className="col-span-2">
                            <button
                                onClick={handleBulkSchedule}
                                disabled={saving}
                                className="w-full px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
                            >
                                {saving ? 'Menjadwalkan...' : 'Terapkan Auto Schedule'}
                            </button>
                        </div>
                    </div>
                </div>
            </details>

            {/* Match cards */}
            {filteredScheduleMatches.length === 0 ? (
                <div className="text-center py-16 rounded-xl border border-white/5 bg-white/[0.01]">
                    <p className="text-3xl mb-3 opacity-40">&#9917;</p>
                    <p className="text-sm text-slate-500">Belum ada pertandingan.</p>
                    <p className="text-xs text-slate-600 mt-1">Generate fixture terlebih dahulu.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filteredScheduleMatches.map((match, i) => {
                        const isEditing = editingMatch === match.id;
                        const st = matchStatusConfig[match.status] || matchStatusConfig.DRAFT;
                        const isCompleted = match.status === 'COMPLETED';

                        return (
                            <div
                                key={match.id}
                                className={`rounded-xl border transition-all duration-200 ${
                                    isEditing
                                        ? 'border-emerald-500/40 bg-emerald-500/[0.03] shadow-lg shadow-emerald-500/5'
                                        : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] active:bg-white/[0.05]'
                                }`}
                            >
                                {/* Match card — always visible */}
                                <div
                                    className={`px-4 py-3 ${!isEditing ? 'cursor-pointer' : ''}`}
                                    onClick={() => { if (!isEditing) handleEditMatch(match); }}
                                >
                                    {/* Top row: match number + group/round + status */}
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-slate-600">#{i + 1}</span>
                                            <span className="text-[10px] text-slate-500">
                                                {match.groupName || (match.round ? `Round ${match.round}` : '')}
                                            </span>
                                        </div>
                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>
                                            {st.label}
                                        </span>
                                    </div>

                                    {/* Score row — FotMob style */}
                                    <div className="flex items-center gap-2 sm:gap-3">
                                        {/* Home team */}
                                        <div className="flex-1 min-w-0 flex items-center justify-end gap-2">
                                            <span className="text-sm font-medium text-slate-100 truncate">
                                                {match.homeTeam?.shortName || match.homeTeam?.name || 'TBD'}
                                            </span>
                                            {match.homeTeam?.logoUrl ? (
                                                <img src={match.homeTeam.logoUrl} alt="" className="w-7 h-7 rounded-lg object-cover ring-1 ring-white/10 flex-shrink-0" />
                                            ) : (
                                                <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                                                    <span className="text-[10px] font-bold text-slate-500">{(match.homeTeam?.name || 'T')[0]}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Score / vs */}
                                        <div className="flex-shrink-0 w-14 sm:w-16 text-center">
                                            {match.matchScore ? (
                                                <div className={`text-lg font-bold tracking-wide ${isCompleted ? 'text-white' : 'text-slate-300'}`}>
                                                    {match.matchScore.homeScore}
                                                    <span className="text-slate-600 mx-0.5">:</span>
                                                    {match.matchScore.awayScore}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-600 font-medium">vs</span>
                                            )}
                                        </div>

                                        {/* Away team */}
                                        <div className="flex-1 min-w-0 flex items-center gap-2">
                                            {match.awayTeam?.logoUrl ? (
                                                <img src={match.awayTeam.logoUrl} alt="" className="w-7 h-7 rounded-lg object-cover ring-1 ring-white/10 flex-shrink-0" />
                                            ) : (
                                                <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                                                    <span className="text-[10px] font-bold text-slate-500">{(match.awayTeam?.name || 'T')[0]}</span>
                                                </div>
                                            )}
                                            <span className="text-sm font-medium text-slate-100 truncate">
                                                {match.awayTeam?.shortName || match.awayTeam?.name || 'TBD'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Bottom row: schedule + venue */}
                                    <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500">
                                        <span>
                                            {match.scheduledAt
                                                ? new Date(match.scheduledAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                                                : 'Belum dijadwalkan'}
                                        </span>
                                        <span className="truncate ml-2 max-w-[120px]">{match.venue || ''}</span>
                                    </div>
                                </div>

                                {/* Edit panel — slides open */}
                                {isEditing && (
                                    <div className="border-t border-white/[0.06] px-4 py-3 space-y-3">
                                        {/* Score edit (only for completed) */}
                                        {isCompleted && (
                                            <div>
                                                <label className="block text-xs text-slate-400 mb-1.5">Skor Akhir</label>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1">
                                                        <div className="text-[10px] text-slate-500 mb-0.5 text-center truncate">{match.homeTeam?.shortName || match.homeTeam?.name || 'Home'}</div>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={scoreForm.homeScore}
                                                            onChange={(e) => setScoreForm(f => ({ ...f, homeScore: e.target.value }))}
                                                            className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-center text-lg font-bold focus:border-emerald-500 focus:outline-none"
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                    <span className="text-slate-600 font-bold text-lg mt-4">:</span>
                                                    <div className="flex-1">
                                                        <div className="text-[10px] text-slate-500 mb-0.5 text-center truncate">{match.awayTeam?.shortName || match.awayTeam?.name || 'Away'}</div>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={scoreForm.awayScore}
                                                            onChange={(e) => setScoreForm(f => ({ ...f, awayScore: e.target.value }))}
                                                            className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-center text-lg font-bold focus:border-emerald-500 focus:outline-none"
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Schedule */}
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1.5">Tanggal & Waktu</label>
                                            <input
                                                type="datetime-local"
                                                value={scheduleForm.scheduledAt}
                                                onChange={(e) => setScheduleForm(f => ({ ...f, scheduledAt: e.target.value }))}
                                                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:border-emerald-500 focus:outline-none"
                                            />
                                        </div>

                                        {/* Venue */}
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1.5">Venue</label>
                                            <input
                                                type="text"
                                                placeholder="cth. Lapangan 1"
                                                value={scheduleForm.venue}
                                                onChange={(e) => setScheduleForm(f => ({ ...f, venue: e.target.value }))}
                                                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:border-emerald-500 focus:outline-none"
                                            />
                                        </div>

                                        {/* Action buttons */}
                                        <div className="flex gap-2 pt-1">
                                            <button
                                                onClick={() => handleSaveMatch(match.id)}
                                                disabled={saving}
                                                className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
                                            >
                                                {saving ? 'Menyimpan...' : 'Simpan'}
                                            </button>
                                            <button
                                                onClick={() => setEditingMatch(null)}
                                                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 text-slate-300 text-sm font-medium transition-colors"
                                            >
                                                Batal
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );

    /* ────────────────────────────────────────
       TABS
       ──────────────────────────────────────── */

    const tabItems = useMemo(() => {
        const items = [
            { key: 'seeding', label: '👥 Tim & Seed', content: SeedingTab },
        ];
        if (hasGroupStage) {
            items.push({ key: 'groups', label: '📊 Grup', content: GroupsTab });
            items.push({ key: 'standings', label: '🏆 Klasemen', content: StandingsTab });
        }
        if (hasKnockout) {
            items.push({ key: 'bracket', label: '🏅 Bracket', content: BracketTab });
        }
        items.push({ key: 'scheduler', label: '📅 Jadwal', content: SchedulerTab });
        return items;
    }, [teams, groups, stages, bracket, matches, standings, editingMatch, scheduleForm, scoreForm, bulkForm, saving, recalculating, hasGroupStage, hasKnockout, standingsByGroup, scheduleFilter, filteredScheduleMatches, stageFilteredMatches, activeStage, knockoutStage, bracketRounds, roundKeys, bracketDragEnabled, bracketEditMatch, bracketLayout, bracketEditMode, poolTeams]);

    /* ────────────────────────────────────────
       RENDER
       ──────────────────────────────────────── */

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0e17] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-slate-500">Memuat data kategori...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0e17]">
            {/* Header */}
            <div className="border-b border-white/10 bg-white/[0.02]">
                <div className="max-w-7xl mx-auto px-6 py-6">
                    <button
                        onClick={() => router.back()}
                        className="text-sm text-slate-500 hover:text-white transition-colors mb-3 flex items-center gap-1"
                    >
                        ← Kembali
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-xl">
                            ⚽
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">
                                {category?.name || 'Kategori'}
                            </h1>
                            <p className="text-sm text-slate-500 mt-0.5">
                                {category?.sportType} • {category?.gender} • {teams.length} Tim
                                {matches.length > 0 && ` • ${matches.length} Match`}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stage Stepper */}
            <StageStepper
                stages={stages}
                activeStage={activeStage}
                onStageClick={setActiveStage}
            />

            {/* Tabs */}
            <div className="max-w-7xl mx-auto px-6 py-2">
                <Tabs tabs={tabItems} defaultTab="seeding" />
            </div>
        </div>
    );
}
