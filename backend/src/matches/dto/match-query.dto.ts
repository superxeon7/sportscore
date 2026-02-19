import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { MatchStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class MatchQueryDto extends PaginationDto {
  @IsUUID()
  @IsOptional()
  tournamentId?: string;

  @IsEnum(MatchStatus)
  @IsOptional()
  status?: MatchStatus;

  @IsUUID()
  @IsOptional()
  eventCategoryId?: string;

  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @IsUUID()
  @IsOptional()
  teamId?: string;
}
