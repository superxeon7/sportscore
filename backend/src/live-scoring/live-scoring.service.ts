import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MatchEventType, MatchStatus } from '@prisma/client';
import { ScoringEngineFactory } from './scoring/scoring-engine.factory';
import { MatchesService } from '../matches/matches.service';
import { BracketAdvancementService } from '../tournaments/bracket-advancement.service';
import { SwissSystemService } from '../tournaments/swiss-system.service';
import { StandingsService } from '../standings/standings.service';
import {
  MatchEventRecord,
  MatchState,
  ScoreState,
  ScoringResult,
  SportConfig,
  TimerState,
} from './scoring/scoring-engine.interface';
import { CreateMatchEventDto } from './dto/create-match-event.dto';

/** Event types that require a playerId. */
const PLAYER_REQUIRED_EVENTS: MatchEventType[] = [
  MatchEventType.GOAL,
  MatchEventType.YELLOW_CARD,
  MatchEventType.RED_CARD,
  MatchEventType.GREEN_CARD,
  MatchEventType.FOUL,
];

/** Redis key prefix for cached match state. */
const CACHE_PREFIX = 'live:match:';
/** Default cache TTL in seconds (2 hours). */
const CACHE_TTL = 7200;

@Injectable()
export class LiveScoringService {
  private readonly logger = new Logger(LiveScoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly engineFactory: ScoringEngineFactory,
    private readonly matchesService: MatchesService,
    private readonly bracketAdvancement: BracketAdvancementService,
    private readonly swissSystemService: SwissSystemService,
    private readonly standingsService: StandingsService,
  ) { }

  // -------------------------------------------------------------------
  // Match state
  // -------------------------------------------------------------------

  /**
   * Load the full match state.  Tries Redis first; falls back to the DB.
   */
  async getMatchState(matchId: string): Promise<MatchState> {
    // Try Redis cache.
    const cached = await this.redis.get<MatchState>(
      `${CACHE_PREFIX}${matchId}`,
    );
    if (cached) {
      return cached;
    }

    // Load from database.
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        matchScore: true,
        matchEvents: {
          include: {
            player: {
              select: {
                id: true,
                fullName: true,
                jerseyNumber: true,
              },
            },
          },
          orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }],
        },
        tournament: {
          include: {
            event: {
              include: { sport: true },
            },
          },
        },
      },
    });

    if (!match) {
      throw new NotFoundException(`Match ${matchId} not found`);
    }

    const events: MatchEventRecord[] = match.matchEvents.map((e: any) => ({
      id: e.id,
      type: e.type,
      minute: e.minute,
      period: e.period,
      playerId: e.playerId,
      playerName: e.player?.fullName ?? null,
      jerseyNumber: e.player?.jerseyNumber ?? null,
      teamId: e.teamId,
      description: e.description,
      data: (e.data as Record<string, unknown>) ?? {},
      timestamp: e.timestamp,
      homeScoreSnapshot: e.homeScoreSnapshot,
      awayScoreSnapshot: e.awayScoreSnapshot,
    }));

    const periodScores = (match.matchScore?.periodScores as any) ?? {};
    const extraScores = (match.matchScore?.extraScores as any) ?? {};
    const penaltyScores = (match.matchScore?.penaltyScores as any) ?? {};

    const score: ScoreState = {
      homeScore: match.matchScore?.homeScore ?? 0,
      awayScore: match.matchScore?.awayScore ?? 0,
      periodScores: Array.isArray(periodScores) ? periodScores : [],
      extraScores: Array.isArray(extraScores) ? extraScores : [],
      penaltyScores: {
        home: penaltyScores.home ?? 0,
        away: penaltyScores.away ?? 0,
      },
    };

    const sport = match.tournament.event.sport;

    const state: MatchState = {
      matchId: match.id,
      status: match.status,
      currentPeriod: match.currentPeriod,
      score,
      events,
      homeTeamId: match.homeTeamId ?? '',
      awayTeamId: match.awayTeamId ?? '',
      startedAt: match.startedAt,
      timerState: null,
      sportSlug: sport.slug,
    };

    // Warm the cache.
    await this.cacheMatchState(matchId, state);

    return state;
  }

  /**
   * Get the SportConfig for a match by traversing tournament → event → sport.
   */
  async getSportConfig(matchId: string): Promise<{ sportSlug: string; config: SportConfig }> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        tournament: {
          include: {
            event: {
              include: { sport: true },
            },
          },
        },
      },
    });

    if (!match) {
      throw new NotFoundException(`Match ${matchId} not found`);
    }

    const sport = match.tournament.event.sport;
    const scoringSystem = (sport.scoringSystem as Record<string, unknown>) ?? {};

    const config: SportConfig = {
      slug: sport.slug,
      scoringEvents: (scoringSystem.scoringEvents as any) ?? [],
      periods: (scoringSystem.periods as any) ?? [],
      hasExtraTime: (scoringSystem.hasExtraTime as boolean) ?? false,
      hasPenaltyShootout: (scoringSystem.hasPenaltyShootout as boolean) ?? false,
      setBased: (scoringSystem.setBased as any) ?? undefined,
    };

    return { sportSlug: sport.slug, config };
  }

  // -------------------------------------------------------------------
  // Match lifecycle
  // -------------------------------------------------------------------

  /**
   * Start a match – set status to LIVE and create a MatchScore record.
   */
  async startMatch(matchId: string): Promise<MatchState> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { matchScore: true },
    });

    if (!match) {
      throw new NotFoundException(`Match ${matchId} not found`);
    }

    if (
      match.status !== MatchStatus.PUBLISHED &&
      match.status !== MatchStatus.SCHEDULED &&
      match.status !== MatchStatus.WARMUP
    ) {
      throw new BadRequestException(
        `Cannot start match in status "${match.status}"`,
      );
    }

    // ── Lineup gate: both teams must have submitted lineups ──
    const lineups = await this.prisma.matchLineup.findMany({
      where: { matchId },
      select: {
        id: true,
        teamId: true,
        players: {
          select: { isStarter: true },
        },
      },
    });

    const homeLineup = lineups.find((l) => l.teamId === match.homeTeamId);
    const awayLineup = lineups.find((l) => l.teamId === match.awayTeamId);

    if (!homeLineup || !awayLineup) {
      throw new BadRequestException(
        'Both teams must submit lineup before match can start.',
      );
    }

    // Each lineup must have at least 1 starter
    const homeStarters = homeLineup.players.filter((p) => p.isStarter).length;
    const awayStarters = awayLineup.players.filter((p) => p.isStarter).length;

    if (homeStarters < 1 || awayStarters < 1) {
      throw new BadRequestException(
        'Each lineup must have at least 1 starter before the match can start.',
      );
    }

    // Auto-lock all lineups so they can't be changed during the match
    await this.prisma.matchLineup.updateMany({
      where: { matchId },
      data: { isLocked: true },
    });

    // Set status to LIVE and record start time.
    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.LIVE,
        startedAt: new Date(),
        currentPeriod: 1,
      },
    });

    // Create MatchScore if it doesn't exist yet.
    if (!match.matchScore) {
      await this.prisma.matchScore.create({
        data: {
          matchId,
          homeScore: 0,
          awayScore: 0,
          periodScores: [],
          extraScores: {},
          penaltyScores: {},
        },
      });
    }

    // Invalidate cache, load fresh state, then attach initial timer.
    await this.redis.del(`${CACHE_PREFIX}${matchId}`);
    const state = await this.getMatchState(matchId);

    try {
      const timeConfig = await this.getResolvedTimeConfig(matchId);
      const periodDurationSeconds = (timeConfig.matchDurationMinutes / timeConfig.halfCount) * 60;
      state.timerState = this.createInitialTimerState(periodDurationSeconds);
    } catch {
      try {
        const { config } = await this.getSportConfig(matchId);
        const periodDuration =
          config.periods?.length > 0 ? config.periods[0].duration * 60 : 2700;
        state.timerState = this.createInitialTimerState(periodDuration);
      } catch {
        state.timerState = this.createInitialTimerState(2700);
      }
    }

    await this.cacheMatchState(matchId, state);
    return state;
  }

  /**
   * End a match – set status to COMPLETED.
   */
  async endMatch(matchId: string): Promise<MatchState> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundException(`Match ${matchId} not found`);
    }

    if (
      match.status !== MatchStatus.LIVE &&
      match.status !== MatchStatus.HALF_TIME &&
      match.status !== MatchStatus.PAUSED
    ) {
      throw new BadRequestException(
        `Cannot end match in status "${match.status}"`,
      );
    }

    // Fetch the current score to determine winner
    const scoreRecord = await this.prisma.matchScore.findUnique({
      where: { matchId },
    });

    // Compute winnerTeamId from regular-time score
    let winnerTeamId: string | null = null;
    if (scoreRecord) {
      if (scoreRecord.homeScore > scoreRecord.awayScore) {
        winnerTeamId = match.homeTeamId;
      } else if (scoreRecord.awayScore > scoreRecord.homeScore) {
        winnerTeamId = match.awayTeamId;
      }
      // null = draw in regular time
    }

    // Compute penaltyWinnerTeamId from penalty shootout scores
    let penaltyWinnerTeamId: string | null = null;
    if (match.isPenaltyUsed) {
      const hPen = match.homePenaltyScore ?? 0;
      const aPen = match.awayPenaltyScore ?? 0;
      if (hPen > aPen) penaltyWinnerTeamId = match.homeTeamId;
      else if (aPen > hPen) penaltyWinnerTeamId = match.awayTeamId;
    }

    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.COMPLETED,
        endedAt: new Date(),
        winnerTeamId,
        penaltyWinnerTeamId,
      },
    });

    await this.redis.del(`${CACHE_PREFIX}${matchId}`);
    const state = await this.getMatchState(matchId);
    state.timerState = null;
    await this.cacheMatchState(matchId, state);

    // Auto-generate POTM (non-blocking; draw → skipped inside the method)
    this.matchesService.autoGeneratePotm(matchId).catch((err) =>
      this.logger.error(`POTM auto-generate failed for match ${matchId}: ${err?.message}`),
    );

    // Auto-advance bracket (non-blocking)
    this.bracketAdvancement.advanceFromMatch(matchId).catch((err) =>
      this.logger.error(`Bracket advancement failed for match ${matchId}: ${err?.message}`),
    );

    // Auto-complete Swiss round (non-blocking)
    this.swissSystemService.checkRoundCompletion(matchId).catch((err) =>
      this.logger.error(`Swiss round completion check failed for match ${matchId}: ${err?.message}`),
    );

    // Auto-update standings (non-blocking) – full recalculate for accuracy
    this.standingsService.recalculateForMatch(matchId).catch((err) =>
      this.logger.error(`Standings update failed for match ${matchId}: ${err?.message}`),
    );

    return state;
  }

  // -------------------------------------------------------------------
  // Period management
  // -------------------------------------------------------------------

  /**
   * Start or end a period.
   */
  async updatePeriod(
    matchId: string,
    period: number,
    action: 'start' | 'end',
  ): Promise<MatchState> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundException(`Match ${matchId} not found`);
    }

    if (action === 'start') {
      // Starting a new period.
      await this.prisma.match.update({
        where: { id: matchId },
        data: {
          currentPeriod: period,
          status: MatchStatus.LIVE,
        },
      });

      // Persist a PERIOD_START event.
      await this.prisma.matchEvent.create({
        data: {
          matchId,
          type: MatchEventType.PERIOD_START,
          period,
          description: `Period ${period} started`,
          data: {},
        },
      });

      // Create a fresh timer for the new period.
      await this.redis.del(`${CACHE_PREFIX}${matchId}`);
      const state = await this.getMatchState(matchId);

      try {
        const timeConfig = await this.getResolvedTimeConfig(matchId);
        const periodDurationSeconds = (timeConfig.matchDurationMinutes / timeConfig.halfCount) * 60;
        state.timerState = this.createInitialTimerState(periodDurationSeconds);
      } catch {
        try {
          const { config } = await this.getSportConfig(matchId);
          const periodIndex = Math.min(period - 1, (config.periods?.length ?? 1) - 1);
          const periodDuration =
            config.periods?.length > 0
              ? config.periods[periodIndex].duration * 60
              : 2700;
          state.timerState = this.createInitialTimerState(periodDuration);
        } catch {
          state.timerState = this.createInitialTimerState(2700);
        }
      }

      await this.cacheMatchState(matchId, state);
      return state;
    } else {
      // Ending the current period.
      const { config } = await this.getSportConfig(matchId);
      const regularPeriods = config.periods?.length ?? 2;

      // Determine the next status.
      let nextStatus: MatchStatus = MatchStatus.PAUSED;
      if (period === 1 && regularPeriods === 2) {
        nextStatus = MatchStatus.HALF_TIME;
      }

      await this.prisma.match.update({
        where: { id: matchId },
        data: { status: nextStatus },
      });

      await this.prisma.matchEvent.create({
        data: {
          matchId,
          type: MatchEventType.PERIOD_END,
          period,
          description: `Period ${period} ended`,
          data: {},
        },
      });

      // Freeze the timer.
      await this.redis.del(`${CACHE_PREFIX}${matchId}`);
      const state = await this.getMatchState(matchId);

      if (state.timerState) {
        // Compute final elapsed if still running.
        if (state.timerState.running && state.timerState.startedTimestamp) {
          const now = Date.now();
          const started = new Date(state.timerState.startedTimestamp).getTime();
          state.timerState.elapsedAtPause += (now - started) / 1000;
          state.timerState.startedTimestamp = null;
        }
        state.timerState.running = false;
      }

      await this.cacheMatchState(matchId, state);
      return state;
    }
  }

  // -------------------------------------------------------------------
  // Event processing
  // -------------------------------------------------------------------

  /**
   * Process a new match event through the appropriate scoring engine.
   */
  async processMatchEvent(
    matchId: string,
    dto: CreateMatchEventDto,
  ): Promise<{ state: MatchState; result: ScoringResult; playerInfo?: any }> {
    const state = await this.getMatchState(matchId);

    if (
      state.status !== MatchStatus.LIVE &&
      state.status !== MatchStatus.HALF_TIME
    ) {
      throw new BadRequestException(
        `Cannot add events to match in status "${state.status}"`,
      );
    }

    // Auto-compute minute from timer state if not provided.
    if (dto.minute == null && state.timerState) {
      let elapsed = state.timerState.elapsedAtPause;
      if (state.timerState.running && state.timerState.startedTimestamp) {
        const now = Date.now();
        const started = new Date(state.timerState.startedTimestamp).getTime();
        elapsed += (now - started) / 1000;
      }
      dto.minute = Math.floor(elapsed / 60) + 1;
    }

    // Enforce playerId for events that require it
    if (PLAYER_REQUIRED_EVENTS.includes(dto.type as MatchEventType) && !dto.playerId) {
      throw new BadRequestException(
        `playerId is required for ${dto.type} events`,
      );
    }

    // Validate player belongs to the correct team in the match
    let playerInfo: any = null;
    if (dto.playerId) {
      const player = await this.prisma.player.findUnique({
        where: { id: dto.playerId },
        select: {
          id: true,
          fullName: true,
          jerseyNumber: true,
          teamId: true,
        },
      });

      if (!player) {
        throw new BadRequestException(`Player with id ${dto.playerId} not found`);
      }

      if (player.teamId !== state.homeTeamId && player.teamId !== state.awayTeamId) {
        throw new BadRequestException(
          `Player ${player.fullName} does not belong to either team in this match`,
        );
      }

      // Auto-set teamId from player if not provided
      if (!dto.teamId) {
        dto.teamId = player.teamId;
      } else if (dto.teamId !== player.teamId) {
        throw new BadRequestException(
          `Player ${player.fullName} does not belong to the specified team`,
        );
      }

      playerInfo = player;
    }

    const { sportSlug, config } = await this.getSportConfig(matchId);
    const engine = this.engineFactory.getEngine(sportSlug);

    // Process the event through the engine.
    const result = engine.processEvent(
      state,
      {
        type: dto.type,
        minute: dto.minute,
        period: dto.period,
        playerId: dto.playerId,
        teamId: dto.teamId,
        description: dto.description,
        data: dto.data,
      },
      config,
    );

    // Persist the event.
    await this.prisma.matchEvent.create({
      data: {
        id: result.matchEvent.id,
        matchId,
        type: dto.type,
        minute: dto.minute,
        period: dto.period ?? state.currentPeriod,
        playerId: dto.playerId,
        teamId: dto.teamId,
        description: dto.description,
        data: (dto.data as any) ?? {},
        homeScoreSnapshot: result.newScore.homeScore,
        awayScoreSnapshot: result.newScore.awayScore,
      },
    });

    // Update the MatchScore if the score changed.
    if (result.scoreChanged) {
      await this.prisma.matchScore.upsert({
        where: { matchId },
        update: {
          homeScore: result.newScore.homeScore,
          awayScore: result.newScore.awayScore,
          periodScores: result.newScore.periodScores as any,
          extraScores: result.newScore.extraScores as any,
          penaltyScores: result.newScore.penaltyScores as any,
        },
        create: {
          matchId,
          homeScore: result.newScore.homeScore,
          awayScore: result.newScore.awayScore,
          periodScores: result.newScore.periodScores as any,
          extraScores: result.newScore.extraScores as any,
          penaltyScores: result.newScore.penaltyScores as any,
        },
      });
    }

    // Enrich the event record with player info for caching & broadcasting.
    if (playerInfo) {
      result.matchEvent.playerName = playerInfo.fullName ?? null;
      result.matchEvent.jerseyNumber = playerInfo.jerseyNumber ?? null;
    }

    // Rebuild and cache the new state (preserve timerState from cache).
    const newState: MatchState = {
      ...state,
      score: result.newScore,
      events: [...state.events, result.matchEvent],
      timerState: state.timerState ?? null,
    };

    await this.cacheMatchState(matchId, newState);

    return { state: newState, result, playerInfo };
  }

  /**
   * Undo the last event – delete it and recalculate the score.
   */
  async undoLastEvent(
    matchId: string,
  ): Promise<{ state: MatchState; removedEvent: MatchEventRecord }> {
    const state = await this.getMatchState(matchId);

    if (state.events.length === 0) {
      throw new BadRequestException('No events to undo');
    }

    // Remove the last event.
    const removedEvent = state.events[state.events.length - 1];

    await this.prisma.matchEvent.delete({
      where: { id: removedEvent.id },
    });

    // Recalculate from remaining events.
    const remainingEvents = state.events.slice(0, -1);
    const { sportSlug, config } = await this.getSportConfig(matchId);
    const engine = this.engineFactory.getEngine(sportSlug);

    const newScore = engine.recalculateScore(
      remainingEvents,
      config,
      state.homeTeamId,
      state.awayTeamId,
    );

    // Persist updated score.
    await this.prisma.matchScore.upsert({
      where: { matchId },
      update: {
        homeScore: newScore.homeScore,
        awayScore: newScore.awayScore,
        periodScores: newScore.periodScores as any,
        extraScores: newScore.extraScores as any,
        penaltyScores: newScore.penaltyScores as any,
      },
      create: {
        matchId,
        homeScore: newScore.homeScore,
        awayScore: newScore.awayScore,
        periodScores: newScore.periodScores as any,
        extraScores: newScore.extraScores as any,
        penaltyScores: newScore.penaltyScores as any,
      },
    });

    const newState: MatchState = {
      ...state,
      score: newScore,
      events: remainingEvents,
      timerState: state.timerState ?? null,
    };

    await this.cacheMatchState(matchId, newState);

    return { state: newState, removedEvent };
  }

  // -------------------------------------------------------------------
  // Timer management
  // -------------------------------------------------------------------

  /**
   * Create a fresh TimerState for a period.
   */
  createInitialTimerState(
    periodDuration: number,
    direction: 'up' | 'down' = 'up',
  ): TimerState {
    return {
      running: false,
      direction,
      periodDuration,
      elapsedAtPause: 0,
      startedTimestamp: null,
      addedTime: 0,
    };
  }

  /**
   * Start the timer – set running=true, record startedTimestamp.
   */
  async startTimer(matchId: string): Promise<TimerState> {
    const state = await this.getMatchState(matchId);
    if (!state.timerState) {
      throw new BadRequestException('No timer state – match may not be live');
    }

    state.timerState.running = true;
    state.timerState.startedTimestamp = new Date().toISOString();

    await this.cacheMatchState(matchId, state);
    return state.timerState;
  }

  /**
   * Pause the timer – compute elapsed, set running=false.
   */
  async pauseTimer(matchId: string): Promise<TimerState> {
    const state = await this.getMatchState(matchId);
    if (!state.timerState) {
      throw new BadRequestException('No timer state – match may not be live');
    }

    if (state.timerState.running && state.timerState.startedTimestamp) {
      const now = Date.now();
      const started = new Date(state.timerState.startedTimestamp).getTime();
      state.timerState.elapsedAtPause += (now - started) / 1000;
    }

    state.timerState.running = false;
    state.timerState.startedTimestamp = null;

    await this.cacheMatchState(matchId, state);
    return state.timerState;
  }

  /**
   * Set the added / injury time.
   */
  async setAddedTime(matchId: string, seconds: number): Promise<TimerState> {
    const state = await this.getMatchState(matchId);
    if (!state.timerState) {
      throw new BadRequestException('No timer state – match may not be live');
    }

    state.timerState.addedTime = seconds;

    await this.cacheMatchState(matchId, state);
    return state.timerState;
  }

  /**
   * Change the timer direction (count up / count down).
   */
  async setTimerDirection(
    matchId: string,
    direction: 'up' | 'down',
  ): Promise<TimerState> {
    const state = await this.getMatchState(matchId);
    if (!state.timerState) {
      throw new BadRequestException('No timer state – match may not be live');
    }

    state.timerState.direction = direction;

    await this.cacheMatchState(matchId, state);
    return state.timerState;
  }

  /**
   * Manually set elapsed seconds (e.g. to correct the clock).
   */
  async adjustTimer(
    matchId: string,
    elapsedSeconds: number,
  ): Promise<TimerState> {
    const state = await this.getMatchState(matchId);
    if (!state.timerState) {
      throw new BadRequestException('No timer state – match may not be live');
    }

    state.timerState.elapsedAtPause = elapsedSeconds;
    // Reset the running reference point so the new value takes effect.
    if (state.timerState.running) {
      state.timerState.startedTimestamp = new Date().toISOString();
    }

    await this.cacheMatchState(matchId, state);
    return state.timerState;
  }

  // -------------------------------------------------------------------
  // Time config resolution
  // -------------------------------------------------------------------

  /**
   * Resolve match time configuration: match override > EventCategory > defaults.
   */
  async getResolvedTimeConfig(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { eventCategory: true },
    });

    if (!match) {
      throw new NotFoundException(`Match ${matchId} not found`);
    }

    const category = match.eventCategory;

    return {
      matchDurationMinutes: match.matchDurationMinutes ?? category?.matchDurationMinutes ?? 90,
      halfCount: match.halfCount ?? category?.halfCount ?? 2,
      breakDurationMinutes: match.breakDurationMinutes ?? category?.breakDurationMinutes ?? 15,
      injuryTimeMinutes: match.injuryTimeMinutes ?? category?.injuryTimeMinutes ?? 0,
    };
  }

  // -------------------------------------------------------------------
  // Cache
  // -------------------------------------------------------------------

  async cacheMatchState(matchId: string, state: MatchState): Promise<void> {
    await this.redis.set(`${CACHE_PREFIX}${matchId}`, state, CACHE_TTL);
  }

  // -------------------------------------------------------------------
  // Penalty shootout
  // -------------------------------------------------------------------

  /**
   * Set penalty shootout scores for a match.
   * Updates the Match record and marks isPenaltyUsed = true.
   */
  async setPenaltyScore(
    matchId: string,
    homePenaltyScore: number,
    awayPenaltyScore: number,
  ): Promise<{ homePenaltyScore: number; awayPenaltyScore: number; isPenaltyUsed: boolean }> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundException(`Match ${matchId} not found`);
    }

    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        homePenaltyScore,
        awayPenaltyScore,
        isPenaltyUsed: true,
      },
    });

    // Invalidate cache so next state load picks up penalty data
    await this.redis.del(`${CACHE_PREFIX}${matchId}`);

    return { homePenaltyScore, awayPenaltyScore, isPenaltyUsed: true };
  }
}
