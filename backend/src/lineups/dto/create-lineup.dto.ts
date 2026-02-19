import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateLineupDto {
  @IsUUID()
  @IsNotEmpty()
  teamId: string;

  @IsObject()
  @IsNotEmpty()
  players: Record<string, unknown>;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  formation?: string;
}
