import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { MatchEventType } from '@prisma/client';

export class CreateMatchEventDto {
  @IsEnum(MatchEventType)
  type: MatchEventType;

  @IsInt()
  @Min(0)
  @IsOptional()
  minute?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  period?: number;

  @IsUUID()
  @IsOptional()
  playerId?: string;

  @IsUUID()
  @IsOptional()
  teamId?: string;

  @IsObject()
  @IsOptional()
  data?: Record<string, unknown>;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  description?: string;
}
