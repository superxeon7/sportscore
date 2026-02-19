import { IsNotEmpty, IsUUID } from 'class-validator';

export class AddDivisionPlayerDto {
  @IsUUID()
  @IsNotEmpty()
  playerId: string;
}
