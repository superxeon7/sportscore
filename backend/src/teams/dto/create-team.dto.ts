import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsInt,
  IsEnum,
  MaxLength,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SportType, AgeGroup, Gender } from '@prisma/client';

export class CreateTeamDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  shortName?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be a valid URL-friendly slug (lowercase alphanumeric with hyphens)',
  })
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1800)
  @Max(2100)
  foundedYear?: number;

  @IsEnum(SportType)
  @IsOptional()
  sportType?: SportType;

  @IsEnum(AgeGroup)
  @IsOptional()
  ageGroup?: AgeGroup;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;
}
