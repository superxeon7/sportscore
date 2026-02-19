import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AuditLogFilterDto } from './dto/audit-log-filter.dto';
import { buildPaginationMeta } from '../common/dto/pagination.dto';
import { MatchStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private readonly startTime = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Get paginated and filtered audit logs.
   */
  async getAuditLogs(filters: AuditLogFilterDto) {
    const where: Record<string, unknown> = {};

    if (filters.entity) {
      where.entity = filters.entity;
    }

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.action) {
      where.action = filters.action;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        (where.createdAt as Record<string, unknown>).gte = new Date(
          filters.startDate,
        );
      }
      if (filters.endDate) {
        (where.createdAt as Record<string, unknown>).lte = new Date(
          filters.endDate,
        );
      }
    }

    const [auditLogs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: filters.skip,
        take: filters.limit,
        orderBy: filters.orderBy,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: auditLogs,
      meta: buildPaginationMeta(filters.page, filters.limit, total),
    };
  }

  /**
   * Create an audit log entry.
   */
  async createAuditLog(data: {
    action: string;
    entity: string;
    entityId: string;
    changes?: Record<string, any>;
    userId?: string;
    ipAddress?: string;
  }) {
    const auditLog = await this.prisma.auditLog.create({
      data: {
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        changes: data.changes || {},
        userId: data.userId,
        ipAddress: data.ipAddress,
      },
    });

    this.logger.log(
      `Audit log created: ${data.action} on ${data.entity}:${data.entityId} by user ${data.userId || 'system'}`,
    );

    return auditLog;
  }

  /**
   * Check system health: database connection, Redis connection, and uptime.
   */
  async getSystemHealth() {
    const health: Record<string, any> = {
      status: 'ok',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
    };

    // Check database connection
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      health.database = {
        status: 'connected',
      };
    } catch (error) {
      health.database = {
        status: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      health.status = 'degraded';
    }

    // Check Redis connection
    try {
      const client = this.redis.getClient();
      const pong = await client.ping();
      health.redis = {
        status: pong === 'PONG' ? 'connected' : 'unknown',
      };
    } catch (error) {
      health.redis = {
        status: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      health.status = 'degraded';
    }

    return health;
  }

  /**
   * Get dashboard statistics: counts of users, events, teams, and active matches.
   */
  async getDashboardStats() {
    const [usersCount, eventsCount, teamsCount, activeMatchesCount] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.event.count(),
        this.prisma.team.count(),
        this.prisma.match.count({
          where: {
            status: {
              in: [
                MatchStatus.LIVE,
                MatchStatus.WARMUP,
                MatchStatus.HALF_TIME,
                MatchStatus.PAUSED,
              ],
            },
          },
        }),
      ]);

    return {
      users: usersCount,
      events: eventsCount,
      teams: teamsCount,
      activeMatches: activeMatchesCount,
    };
  }
}
