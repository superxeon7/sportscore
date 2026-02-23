// Enums
export enum UserRole {
  ADMIN = 'ADMIN',
  ORGANIZER = 'ORGANIZER',
  TEAM_MANAGER = 'TEAM_MANAGER',
}

export enum EventStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum TournamentType {
  LEAGUE = 'LEAGUE',
  KNOCKOUT = 'KNOCKOUT',
  GROUP_KNOCKOUT = 'GROUP_KNOCKOUT',
  DOUBLE_ELIMINATION = 'DOUBLE_ELIMINATION',
  SWISS = 'SWISS',
  CUSTOM = 'CUSTOM',
}

export enum TournamentStatus {
  SETUP = 'SETUP',
  REGISTRATION = 'REGISTRATION',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export enum MatchStatus {
  SCHEDULED = 'SCHEDULED',
  WARMUP = 'WARMUP',
  LIVE = 'LIVE',
  HALF_TIME = 'HALF_TIME',
  PAUSED = 'PAUSED',
  PENALTY_SHOOTOUT = 'PENALTY_SHOOTOUT',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  POSTPONED = 'POSTPONED',
}

export enum MatchEventType {
  GOAL = 'GOAL',
  ASSIST = 'ASSIST',
  FOUL = 'FOUL',
  YELLOW_CARD = 'YELLOW_CARD',
  RED_CARD = 'RED_CARD',
  SUBSTITUTION = 'SUBSTITUTION',
  TIMEOUT = 'TIMEOUT',
  PERIOD_START = 'PERIOD_START',
  PERIOD_END = 'PERIOD_END',
  PENALTY = 'PENALTY',
  OWN_GOAL = 'OWN_GOAL',
  POINT = 'POINT',
  CUSTOM = 'CUSTOM',
}

// Model interfaces
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatarUrl?: string;
  phone?: string;
  bio?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Sport {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  rules: any;
  scoringSystem: any;
  eventTypes: any;
  displayConfig: any;
}

export interface Event {
  id: string;
  name: string;
  slug: string;
  description?: string;
  location?: string;
  venue?: string;
  startDate: string;
  endDate: string;
  status: EventStatus;
  bannerUrl?: string;
  maxTeams?: number;
  isPublic: boolean;
  sport?: Sport;
  organizer?: User;
  tournaments?: Tournament[];
  categories?: EventCategory[];
}

export interface Tournament {
  id: string;
  name: string;
  type: TournamentType;
  status: TournamentStatus;
  config: any;
  eventId: string;
  matches?: Match[];
  standings?: Standing[];
}

export interface Team {
  id: string;
  name: string;
  shortName?: string;
  slug: string;
  logoUrl?: string;
  description?: string;
  city?: string;
  country?: string;
  foundedYear?: number;
  players?: Player[];
  manager?: User;
}

export interface Player {
  id: string;
  fullName: string;
  jerseyNumber?: number;
  position?: string;
  dateOfBirth: string;
  placeOfBirth?: string;
  nationality?: string;
  photoUrl?: string;
  team?: Team;
  stats: any;
}

export interface Match {
  id: string;
  status: MatchStatus;
  scheduledAt: string;
  startedAt?: string;
  endedAt?: string;
  venue?: string;
  round?: number;
  matchDay?: number;
  stageType?: string | null;
  groupId?: string | null;
  groupName?: string | null;
  currentPeriod: number;
  homeTeam?: Team;
  awayTeam?: Team;
  matchScore?: MatchScore;
  matchEvents?: MatchEvent[];
  tournament?: Tournament;
}

export interface PenaltyShot {
  round: number;
  team: 'home' | 'away';
  result: 'GOAL' | 'MISS';
}

export interface MatchScore {
  id: string;
  homeScore: number;
  awayScore: number;
  periodScores: any;
  extraScores: any;
  penaltyScores: any;
}

export interface MatchEvent {
  id: string;
  type: MatchEventType;
  minute?: number;
  period?: number;
  description?: string;
  data: any;
  timestamp: string;
  homeScoreSnapshot?: number;
  awayScoreSnapshot?: number;
  player?: Player;
  teamId?: string;
}

export interface Standing {
  id: string;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  group?: string;
  form?: string;
  team?: Team;
}

export interface EventCategoryTeam {
  id: string;
  eventCategoryId: string;
  teamId: string;
  seed?: number;
  group?: string;
  registeredAt?: string;
  team?: Team;
}

export interface EventCategory {
  id: string;
  name: string;
  eventId: string;
  sportType: string;
  gender: string;
  maxDateOfBirth: string;
  minDateOfBirth?: string | null;
  matchDurationMinutes: number;
  halfCount: number;
  breakDurationMinutes: number;
  injuryTimeMinutes: number;
  categoryTeams?: EventCategoryTeam[];
  _count?: { categoryTeams?: number; matches?: number };
}

export interface TeamDivision {
  id: string;
  name: string;
  description?: string;
  sportType?: string;
  ageGroup?: string;
  gender?: string;
  isActive: boolean;
  teamId: string;
  createdAt: string;
  updatedAt: string;
  players?: Player[];
  _count?: { players: number };
}

export enum OfficialRole {
  COACH = 'COACH',
  ASSISTANT_COACH = 'ASSISTANT_COACH',
  MANAGER = 'MANAGER',
  PHYSIO = 'PHYSIO',
  OTHER = 'OTHER',
}

export interface TeamOfficial {
  id: string;
  teamId: string;
  fullName: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  nationality?: string;
  role: OfficialRole;
  photoUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MatchOfficial {
  id: string;
  matchId: string;
  teamId: string;
  officialId: string;
  isHeadCoach: boolean;
  official?: TeamOfficial;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: PaginationMeta;
}

// Auth types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// Toast type
export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}
