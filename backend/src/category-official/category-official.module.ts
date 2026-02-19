import { Module } from '@nestjs/common';
import { CategoryOfficialController } from './category-official.controller';
import { CategoryOfficialService } from './category-official.service';
import { PrismaModule } from '../prisma/prisma.module';
import { OwnershipService } from '../common/ownership.service';

@Module({
    imports: [PrismaModule],
    controllers: [CategoryOfficialController],
    providers: [CategoryOfficialService, OwnershipService],
    exports: [CategoryOfficialService],
})
export class CategoryOfficialModule { }
