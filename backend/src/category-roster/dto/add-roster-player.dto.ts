import { IsNotEmpty, IsUUID } from 'class-validator';

export class AddRosterPlayerDto {
    @IsUUID()
    @IsNotEmpty()
    playerId: string;
}
