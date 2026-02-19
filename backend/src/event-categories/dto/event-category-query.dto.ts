import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { SportType, Gender } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class EventCategoryQueryDto extends PaginationDto {
  @IsUUID()
  @IsOptional()
  eventId?: string;

  @IsEnum(SportType)
  @IsOptional()
  sportType?: SportType;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;
}
