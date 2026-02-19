import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class EventMatchesQueryDto {
  @IsUUID()
  @IsOptional()
  eventCategoryId?: string;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeCompleted?: boolean;
}
