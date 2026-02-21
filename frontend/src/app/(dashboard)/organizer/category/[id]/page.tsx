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
    homeTeam?: Team;
    awayTeam?: Team;
    homeTeamId: string;
    awayTeamId: string;
    matchScore?: { homeScore: number; awayScore: number } | null;
    homeScore: number;
    awayScore: number;
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
    const [standings, setStandings] = useState<{ penaltyEnabled: boolean; data: StandingEntry[] } | null>(null);
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
            } catch { setBracket(null); }

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
        if (standings?.data) {
            for (const s of standings.data) {
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
                        Klasemen otomatis berdasarkan hasil pertandingan
                        {standings?.penaltyEnabled && (
                            <span className="ml-2 text-yellow-500 text-xs">• Mode penalti aktif</span>
                        )}
                    </p>
                </div>
                <button
                    onClick={handleGenerateFixtures}
                    disabled={saving || unassignedTeams.length > 0}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center gap-2"
                >
                    <span>⚽</span> Generate Fixture
                </button>
            </div>

            {standingsByGroup.length > 0 ? (
                <div className="space-y-6">
                    {standingsByGroup.map(sg => (
                        <div key={sg.groupId} className="rounded-xl border border-white/10 overflow-hidden">
                            <div className="bg-white/5 px-4 py-2.5 border-b border-white/5">
                                <h3 className="text-sm font-bold text-emerald-400">{sg.groupName}</h3>
                            </div>
                            <table className="w-full">
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
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 text-slate-500">
                    <p className="text-4xl mb-3">👥</p>
                    <p>Tambahkan tim ke kategori untuk melihat klasemen.</p>
                </div>
            )}
        </div>
    );

    /* ────────────────────────────────────────
       TAB 4: BRACKET
       ──────────────────────────────────────── */

    const bracketRounds = useMemo(() => {
        if (!bracket) return {};
        if (bracket.type === 'STANDARD') return bracket.data || {};
        if (bracket.type === 'DOUBLE_ELIMINATION') return bracket.data?.upper || {};
        return {};
    }, [bracket]);

    const roundKeys = Object.keys(bracketRounds).map(Number).sort((a, b) => a - b);

    const getRoundLabel = (round: number, totalRounds: number) => {
        const diff = totalRounds - round;
        if (diff === 0) return 'Final';
        if (diff === 1) return 'Semi Final';
        if (diff === 2) return 'Quarter Final';
        return `Babak ${round}`;
    };

    const handleRegenerateBracket = async () => {
        if (!confirm('Yakin regenerate bracket? Semua data bracket akan direset.')) return;
        const tournament = category?.tournaments?.[0];
        if (!tournament) { toast.error('Tournament tidak ditemukan'); return; }
        try {
            setSaving(true);
            await apiPost(`/tournaments/${tournament.id}/reset-bracket`);
            await apiPost(`/tournaments/${tournament.id}/generate-fixtures`);
            toast.success('Bracket berhasil di-regenerate');
            fetchData();
        } catch (err: any) {
            toast.error(err.message || 'Gagal regenerate');
        } finally {
            setSaving(false);
        }
    };

    const BracketTab = (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-lg font-bold text-white">Bracket Manager</h2>
                    <p className="text-slate-500 text-sm mt-1">Visualisasi dan kelola bracket knockout</p>
                </div>
                <button
                    onClick={handleRegenerateBracket}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-red-600/80 hover:bg-red-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
                >
                    🔄 Regenerate
                </button>
            </div>

            {roundKeys.length > 0 ? (
                <div className="flex gap-6 overflow-x-auto pb-4 items-start">
                    {roundKeys.map((round, ri) => (
                        <div key={round} className="flex-shrink-0 w-64">
                            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 text-center">
                                {getRoundLabel(round, roundKeys.length)}
                            </h4>
                            <div className="space-y-3" style={{ marginTop: `${ri * 40}px` }}>
                                {(bracketRounds[round] || []).map((match: BracketMatch) => (
                                    <div key={match.id} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden hover:border-emerald-500/30 transition-colors">
                                        <div className="flex items-center gap-2 p-3 border-b border-white/5">
                                            {match.homeTeam?.logoUrl ? (
                                                <img src={match.homeTeam.logoUrl} alt="" className="w-6 h-6 rounded object-cover" />
                                            ) : (
                                                <div className="w-6 h-6 rounded bg-white/10" />
                                            )}
                                            <span className="text-sm text-white flex-1 truncate">{match.homeTeam?.name || 'TBD'}</span>
                                            <span className="text-sm font-bold text-emerald-400">{match.matchScore?.homeScore ?? '-'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 p-3">
                                            {match.awayTeam?.logoUrl ? (
                                                <img src={match.awayTeam.logoUrl} alt="" className="w-6 h-6 rounded object-cover" />
                                            ) : (
                                                <div className="w-6 h-6 rounded bg-white/10" />
                                            )}
                                            <span className="text-sm text-white flex-1 truncate">{match.awayTeam?.name || 'TBD'}</span>
                                            <span className="text-sm font-bold text-emerald-400">{match.matchScore?.awayScore ?? '-'}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 text-slate-500">
                    <p className="text-4xl mb-3">🏆</p>
                    <p>Belum ada bracket. Bracket akan dibuat setelah fase grup selesai atau fixture di-generate.</p>
                </div>
            )}
        </div>
    );

    /* ────────────────────────────────────────
       TAB 5: MATCH SCHEDULER
       ──────────────────────────────────────── */

    const [editingMatch, setEditingMatch] = useState<string | null>(null);
    const [scheduleForm, setScheduleForm] = useState({ scheduledAt: '', venue: '' });
    const [bulkForm, setBulkForm] = useState({ startTime: '', intervalMinutes: 60, fieldCount: 1 });
    const [scheduleFilter, setScheduleFilter] = useState<string>('all');

    const handleEditMatch = (match: BracketMatch) => {
        setEditingMatch(match.id);
        setScheduleForm({
            scheduledAt: match.scheduledAt ? new Date(match.scheduledAt).toISOString().slice(0, 16) : '',
            venue: match.venue || '',
        });
    };

    const handleSaveMatch = async (matchId: string) => {
        try {
            setSaving(true);
            await apiPatch(`/matches/${matchId}`, {
                ...(scheduleForm.scheduledAt ? { scheduledAt: new Date(scheduleForm.scheduledAt).toISOString() } : {}),
                venue: scheduleForm.venue || null,
            });
            toast.success('Jadwal disimpan');
            setEditingMatch(null);
            fetchData();
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

    const SchedulerTab = (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-lg font-bold text-white">Jadwal Pertandingan</h2>
                    <p className="text-slate-500 text-sm mt-1">Atur jadwal dan venue per match • {filteredScheduleMatches.length} pertandingan</p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={scheduleFilter}
                        onChange={(e) => setScheduleFilter(e.target.value)}
                        className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:border-emerald-500 focus:outline-none"
                    >
                        <option value="all">Semua</option>
                        {groupFilterOptions.map(name => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                        {hasKnockout && <option value="knockout">Knockout</option>}
                    </select>
                </div>
            </div>

            {/* Bulk Auto Schedule */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-6">
                <h3 className="text-sm font-bold text-white mb-3">⚡ Auto Schedule</h3>
                <div className="flex flex-wrap gap-3 items-end">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Waktu Mulai</label>
                        <input
                            type="datetime-local"
                            value={bulkForm.startTime}
                            onChange={(e) => setBulkForm(f => ({ ...f, startTime: e.target.value }))}
                            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-emerald-500 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Interval (menit)</label>
                        <input
                            type="number"
                            min={15}
                            value={bulkForm.intervalMinutes}
                            onChange={(e) => setBulkForm(f => ({ ...f, intervalMinutes: Number(e.target.value) }))}
                            className="w-24 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-emerald-500 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Jumlah Lapangan</label>
                        <input
                            type="number"
                            min={1}
                            max={10}
                            value={bulkForm.fieldCount}
                            onChange={(e) => setBulkForm(f => ({ ...f, fieldCount: Number(e.target.value) }))}
                            className="w-24 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-emerald-500 focus:outline-none"
                        />
                    </div>
                    <button
                        onClick={handleBulkSchedule}
                        disabled={saving}
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
                    >
                        Terapkan
                    </button>
                </div>
            </div>

            {/* Match table */}
            <div className="rounded-xl border border-white/10 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-white/5">
                            <th className="text-left text-xs font-semibold text-slate-400 px-4 py-3">#</th>
                            <th className="text-left text-xs font-semibold text-slate-400 px-4 py-3">Pertandingan</th>
                            <th className="text-left text-xs font-semibold text-slate-400 px-4 py-3">Skor</th>
                            <th className="text-left text-xs font-semibold text-slate-400 px-4 py-3">Grup/Babak</th>
                            <th className="text-left text-xs font-semibold text-slate-400 px-4 py-3">Tanggal & Waktu</th>
                            <th className="text-left text-xs font-semibold text-slate-400 px-4 py-3">Venue</th>
                            <th className="text-left text-xs font-semibold text-slate-400 px-4 py-3">Status</th>
                            <th className="text-right text-xs font-semibold text-slate-400 px-4 py-3">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filteredScheduleMatches.map((match, i) => (
                            <tr key={match.id} className="hover:bg-white/[0.02] transition-colors">
                                <td className="px-4 py-3 text-slate-500 text-sm">{i + 1}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2 text-sm text-white">
                                        <span className="truncate max-w-[120px]">{match.homeTeam?.name || 'TBD'}</span>
                                        <span className="text-slate-500 text-xs">vs</span>
                                        <span className="truncate max-w-[120px]">{match.awayTeam?.name || 'TBD'}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    {match.matchScore ? (
                                        <span className="text-sm font-bold text-emerald-400">
                                            {match.matchScore.homeScore} - {match.matchScore.awayScore}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-slate-600">—</span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-400">
                                    {match.groupName || (match.round ? `R${match.round}` : '-')}
                                </td>
                                <td className="px-4 py-3">
                                    {editingMatch === match.id ? (
                                        <input
                                            type="datetime-local"
                                            value={scheduleForm.scheduledAt}
                                            onChange={(e) => setScheduleForm(f => ({ ...f, scheduledAt: e.target.value }))}
                                            className="px-2 py-1 rounded bg-white/5 border border-emerald-500/50 text-white text-xs focus:outline-none"
                                        />
                                    ) : (
                                        <span className="text-sm text-slate-300">
                                            {match.scheduledAt ? new Date(match.scheduledAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    {editingMatch === match.id ? (
                                        <input
                                            type="text"
                                            placeholder="Venue"
                                            value={scheduleForm.venue}
                                            onChange={(e) => setScheduleForm(f => ({ ...f, venue: e.target.value }))}
                                            className="px-2 py-1 rounded bg-white/5 border border-emerald-500/50 text-white text-xs w-28 focus:outline-none"
                                        />
                                    ) : (
                                        <span className="text-sm text-slate-400">{match.venue || '-'}</span>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${match.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' :
                                        match.status === 'LIVE' || match.status === 'ONGOING' ? 'bg-red-500/20 text-red-400' :
                                            match.status === 'PUBLISHED' ? 'bg-blue-500/20 text-blue-400' :
                                                'bg-slate-500/20 text-slate-400'
                                        }`}>
                                        {match.status}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {editingMatch === match.id ? (
                                        <div className="flex gap-1 justify-end">
                                            <button onClick={() => handleSaveMatch(match.id)} className="px-2 py-1 rounded bg-emerald-600 text-white text-xs hover:bg-emerald-500">Simpan</button>
                                            <button onClick={() => setEditingMatch(null)} className="px-2 py-1 rounded bg-white/10 text-slate-300 text-xs hover:bg-white/20">Batal</button>
                                        </div>
                                    ) : (
                                        <button onClick={() => handleEditMatch(match)} className="text-xs text-blue-400 hover:text-blue-300">
                                            ✏️ Edit
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredScheduleMatches.length === 0 && (
                    <div className="text-center py-16 text-slate-500">
                        <p className="text-4xl mb-3">📅</p>
                        <p>Belum ada pertandingan. Generate fixture terlebih dahulu.</p>
                    </div>
                )}
            </div>
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
    }, [teams, groups, stages, bracket, matches, standings, editingMatch, scheduleForm, bulkForm, saving, hasGroupStage, hasKnockout, standingsByGroup, scheduleFilter, filteredScheduleMatches, stageFilteredMatches, activeStage]);

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
