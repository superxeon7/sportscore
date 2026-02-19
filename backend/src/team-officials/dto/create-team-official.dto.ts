import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsEnum,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { OfficialRole } from '@prisma/client';

export class CreateTeamOfficialDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName: string;

  @IsDateString()
  dateOfBirth: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  placeOfBirth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nationality?: string;

  @IsEnum(OfficialRole)
  role: OfficialRole;

  @IsString()
  @IsNotEmpty()
  photoUrl: string;
}
