import {
    IsArray,
    IsBoolean,
    IsInt,
    IsOptional,
    IsUUID,
    Min,
    Max,
    ValidateNested,
    ArrayMaxSize,
    ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LineupPlayerDto {
    @IsUUID()
    playerId: string;

    @IsInt()
    @Min(0)
    @Max(999)
    jerseyNumber: number;

    @IsBoolean()
    @IsOptional()
    isStarter?: boolean = true;

    @IsBoolean()
    @IsOptional()
    isCaptain?: boolean = false;
}

export class CreateMatchLineupDto {
    @IsUUID()
    teamId: string;

    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(14)
    @ValidateNested({ each: true })
    @Type(() => LineupPlayerDto)
    players: LineupPlayerDto[];
}
