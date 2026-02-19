import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class MatchOfficialEntry {
  @IsUUID()
  officialId: string;

  @IsOptional()
  @IsBoolean()
  isHeadCoach?: boolean;
}

export class SetMatchOfficialsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MatchOfficialEntry)
  officials: MatchOfficialEntry[];
}
