import {
  IsString,
  IsOptional,
  IsObject,
  IsNotEmpty,
  IsArray,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateSportDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be a valid URL-friendly slug (lowercase alphanumeric with hyphens)',
  })
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  icon?: string;

  @IsOptional()
  @IsObject()
  rules?: Record<string, any>;

  @IsOptional()
  @IsObject()
  scoringSystem?: Record<string, any>;

  @IsOptional()
  @IsArray()
  eventTypes?: any[];

  @IsOptional()
  @IsObject()
  displayConfig?: Record<string, any>;
}
