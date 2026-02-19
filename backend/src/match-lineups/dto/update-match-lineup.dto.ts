import {
    IsArray,
    ArrayMaxSize,
    ArrayMinSize,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LineupPlayerDto } from './create-match-lineup.dto';

export class UpdateMatchLineupDto {
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(14)
    @ValidateNested({ each: true })
    @Type(() => LineupPlayerDto)
    players: LineupPlayerDto[];
}
