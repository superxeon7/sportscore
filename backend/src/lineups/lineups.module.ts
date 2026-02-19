import { Module } from '@nestjs/common';
import { LineupsController } from './lineups.controller';
import { LineupsService } from './lineups.service';

@Module({
  controllers: [LineupsController],
  providers: [LineupsService],
  exports: [LineupsService],
})
export class LineupsModule {}
