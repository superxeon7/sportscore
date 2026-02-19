import { Module } from '@nestjs/common';
import { CategoryRosterController } from './category-roster.controller';
import { CategoryRosterService } from './category-roster.service';
import { PrismaModule } from '../prisma/prisma.module';
import { OwnershipService } from '../common/ownership.service';

@Module({
    imports: [PrismaModule],
    controllers: [CategoryRosterController],
    providers: [CategoryRosterService, OwnershipService],
    exports: [CategoryRosterService],
})
export class CategoryRosterModule { }
