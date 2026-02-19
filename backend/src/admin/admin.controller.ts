import { Controller, Get, Query } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuditLogFilterDto } from './dto/audit-log-filter.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('audit-logs')
  async getAuditLogs(@Query() filters: AuditLogFilterDto) {
    return this.adminService.getAuditLogs(filters);
  }

  @Get('system/health')
  async getSystemHealth() {
    return this.adminService.getSystemHealth();
  }

  @Get('dashboard-stats')
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }
}
