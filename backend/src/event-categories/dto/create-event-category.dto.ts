import {
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { SportType, Gender } from '@prisma/client';

export class CreateEventCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsEnum(SportType)
  @IsNotEmpty()
  sportType: SportType;

  @IsEnum(Gender)
  @IsNotEmpty()
  gender: Gender;

  @IsDateString()
  @IsNotEmpty()
  maxDateOfBirth: string;

  @IsDateString()
  @IsOptional()
  minDateOfBirth?: string;

  @IsInt()
  @Min(1)
  @IsNotEmpty()
  matchDurationMinutes: number;

  @IsInt()
  @Min(1)
  @IsNotEmpty()
  halfCount: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  breakDurationMinutes?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  injuryTimeMinutes?: number;

  @IsArray()
  @IsOptional()
  stages?: {
    stageOrder: number;
    stageType: 'GROUP' | 'SPECIAL_GROUP' | 'GROUP_NEIGHBOR' | 'KNOCKOUT' | 'LEAGUE' | 'DOUBLE_ELIMINATION' | 'SWISS';
    groupCount?: number;
    qualifyPerGroup?: number;
    matchPerTeam?: number;
    penaltyEnabled?: boolean;
    settingsJson?: Record<string, unknown>;
  }[];

  // Legacy fields kept for backwards compat
  @IsIn(['KNOCKOUT', 'GROUP_KNOCKOUT'])
  @IsOptional()
  formatType?: 'KNOCKOUT' | 'GROUP_KNOCKOUT';

  @IsInt()
  @Min(1)
  @IsOptional()
  groupCount?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  qualifyPerGroup?: number;
}
