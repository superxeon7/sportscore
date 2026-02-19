import { Injectable } from '@nestjs/common';
import { IScoringEngine } from './scoring-engine.interface';
import { GenericScoringEngine } from './generic-scoring.engine';
import { FootballScoringEngine } from './football-scoring.engine';
import { BasketballScoringEngine } from './basketball-scoring.engine';
import { VolleyballScoringEngine } from './volleyball-scoring.engine';

/**
 * Factory that maps a sport slug to the appropriate scoring engine.
 *
 * If no sport-specific engine exists the generic (configuration-driven)
 * engine is used as a fallback – it derives all behaviour from the
 * sport's `scoringSystem` JSON.
 */
@Injectable()
export class ScoringEngineFactory {
  private readonly engines: Map<string, IScoringEngine>;

  constructor(
    private readonly genericEngine: GenericScoringEngine,
    private readonly footballEngine: FootballScoringEngine,
    private readonly basketballEngine: BasketballScoringEngine,
    private readonly volleyballEngine: VolleyballScoringEngine,
  ) {
    this.engines = new Map<string, IScoringEngine>([
      ['football', this.footballEngine],
      ['soccer', this.footballEngine],
      ['futsal', this.footballEngine],
      ['basketball', this.basketballEngine],
      ['volleyball', this.volleyballEngine],
      ['beach-volleyball', this.volleyballEngine],
    ]);
  }

  /**
   * Return the scoring engine for the given sport slug.
   * Falls back to the generic engine if no specialised one is registered.
   */
  getEngine(sportSlug: string): IScoringEngine {
    return this.engines.get(sportSlug) ?? this.genericEngine;
  }

  /**
   * Register a custom engine at runtime (useful for plugins / testing).
   */
  registerEngine(sportSlug: string, engine: IScoringEngine): void {
    this.engines.set(sportSlug, engine);
  }
}
