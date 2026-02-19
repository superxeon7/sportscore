import { PartialType } from '@nestjs/mapped-types';
import { CreateDivisionDto } from './create-division.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateDivisionDto extends PartialType(CreateDivisionDto) {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
