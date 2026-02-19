import { PartialType } from '@nestjs/swagger';
import { IsInt, IsOptional, Min, ValidateIf } from 'class-validator';
import { CreateMatchDto } from './create-match.dto';

export class UpdateMatchDto extends PartialType(CreateMatchDto) {
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
