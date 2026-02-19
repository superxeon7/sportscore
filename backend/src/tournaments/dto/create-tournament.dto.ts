import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { TournamentType } from '@prisma/client';

export class CreateTournamentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsEnum(TournamentType)
  @IsNotEmpty()
  type: TournamentType;

  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;

  @IsUUID()
  @IsOptional()
  eventCategoryId?: string;
}
