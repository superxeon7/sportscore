import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';
import { OfficialRole } from '@prisma/client';

export class CreateOfficialDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsEnum(OfficialRole)
    @IsNotEmpty()
    role: OfficialRole;

    @IsUrl()
    @IsOptional()
    photoUrl?: string;
}
