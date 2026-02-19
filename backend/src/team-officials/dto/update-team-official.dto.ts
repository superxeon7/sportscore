import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsEnum,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { OfficialRole } from '@prisma/client';

export class UpdateTeamOfficialDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  placeOfBirth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nationality?: string;

  @IsOptional()
  @IsEnum(OfficialRole)
  role?: OfficialRole;

  @IsOptional()
  @IsString()
  photoUrl?: string;
}
