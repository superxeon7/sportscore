import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { SportType, Gender } from '@prisma/client';

export class UpdateEventCategoryDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsEnum(SportType)
  @IsOptional()
  sportType?: SportType;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsDateString()
  @IsOptional()
  maxDateOfBirth?: string;

  @IsDateString()
  @IsOptional()
  minDateOfBirth?: string | null;

  @IsInt()
  @Min(1)
  @IsOptional()
  matchDurationMinutes?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  halfCount?: number;

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
    stageType: 'GROUP' | 'KNOCKOUT' | 'LEAGUE' | 'DOUBLE_ELIMINATION' | 'SWISS';
    groupCount?: number;
    qualifyPerGroup?: number;
    settingsJson?: Record<string, unknown>;
  }[];
}
