import { IsIn, IsInt, IsString, IsUUID, Min } from 'class-validator';

export class TimerStartDto {
  @IsUUID()
  matchId: string;
}

export class TimerPauseDto {
  @IsUUID()
  matchId: string;
}

export class TimerSetAddedTimeDto {
  @IsUUID()
  matchId: string;

  @IsInt()
  @Min(0)
  seconds: number;
}

export class TimerSetDirectionDto {
  @IsUUID()
  matchId: string;

  @IsString()
  @IsIn(['up', 'down'])
  direction: 'up' | 'down';
}

export class TimerAdjustDto {
  @IsUUID()
  matchId: string;

  @IsInt()
  @Min(0)
  elapsedSeconds: number;
}
