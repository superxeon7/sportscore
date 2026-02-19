import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { EventStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class EventQueryDto extends PaginationDto {
  @IsUUID()
  @IsOptional()
  sportId?: string;

  @IsEnum(EventStatus)
  @IsOptional()
  status?: EventStatus;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}
