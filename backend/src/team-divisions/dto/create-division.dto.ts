import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { SportType, AgeGroup, Gender } from '@prisma/client';

export class CreateDivisionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

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
