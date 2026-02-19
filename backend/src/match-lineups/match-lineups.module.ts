import { Module } from '@nestjs/common';
import { MatchLineupsController } from './match-lineups.controller';
import { MatchLineupsService } from './match-lineups.service';
import { PrismaModule } from '../prisma/prisma.module';
import { OwnershipService } from '../common/ownership.service';

@Module({
    imports: [PrismaModule],
    controllers: [MatchLineupsController],
    providers: [MatchLineupsService, OwnershipService],
    exports: [MatchLineupsService],
})
export class MatchLineupsModule { }
