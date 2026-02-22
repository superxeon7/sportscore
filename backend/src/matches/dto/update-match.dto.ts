import { PartialType } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Min, ValidateIf } from 'class-validator';
import { CreateMatchDto } from './create-match.dto';

export class UpdateMatchDto extends PartialType(CreateMatchDto) {
  // Override team IDs to allow null (clearing a bracket slot)
  @ValidateIf((o) => o.homeTeamId !== null)
  @IsUUID()
  @IsOptional()
  // @ts-expect-error: widen to allow null for bracket slot clearing
  declare homeTeamId?: string | null;

  @ValidateIf((o) => o.awayTeamId !== null)
  @IsUUID()
  @IsOptional()
  // @ts-expect-error: widen to allow null for bracket slot clearing
  declare awayTeamId?: string | null;

  @ValidateIf((o) => o.matchDurationMinutes !== null)
  @IsInt()
  @Min(0)
  @IsOptional()
  declare matchDurationMinutes?: number | null;

  @ValidateIf((o) => o.halfCount !== null)
  @IsInt()
  @Min(1)
  @IsOptional()
  declare halfCount?: number | null;

  @ValidateIf((o) => o.breakDurationMinutes !== null)
  @IsInt()
  @Min(0)
  @IsOptional()
  declare breakDurationMinutes?: number | null;

  @ValidateIf((o) => o.injuryTimeMinutes !== null)
  @IsInt()
  @Min(0)
  @IsOptional()
  declare injuryTimeMinutes?: number | null;
}
