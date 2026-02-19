import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateMatchDto {
  @IsUUID()
  @IsNotEmpty()
  tournamentId: string;

  @IsUUID()
  @IsNotEmpty()
  homeTeamId: string;

  @IsUUID()
  @IsNotEmpty()
  awayTeamId: string;

  @IsUUID()
  @IsOptional()
  eventCategoryId?: string;

  @IsDateString()
  @IsNotEmpty()
  scheduledAt: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  venue?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  round?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  leg?: number;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  group?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  matchDay?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  matchDurationMinutes?: number | null;

  @IsInt()
  @Min(1)
  @IsOptional()
  halfCount?: number | null;

  @IsInt()
  @Min(0)
  @IsOptional()
  breakDurationMinutes?: number | null;

  @IsInt()
  @Min(0)
  @IsOptional()
  injuryTimeMinutes?: number | null;
}
