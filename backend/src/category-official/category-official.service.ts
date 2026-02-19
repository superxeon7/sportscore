import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OwnershipService } from '../common/ownership.service';
import { UserRole } from '@prisma/client';
import { CreateOfficialDto } from './dto/create-official.dto';
import { UpdateOfficialDto } from './dto/update-official.dto';

@Injectable()
export class CategoryOfficialService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly ownershipService: OwnershipService,
    ) { }

    async getOfficials(
        categoryId: string,
        teamId: string | undefined, // optional query param
        userId: string,
        userRole: UserRole,
    ) {
        // Resolve target team
        let targetTeamId = teamId;

        if (!targetTeamId) {
            if (userRole === UserRole.TEAM_MANAGER) {
                const team = await this.prisma.team.findUnique({
                    where: { managerId: userId },
                    select: { id: true },
                });
                if (!team) throw new NotFoundException('You do not manage any team');
                targetTeamId = team.id;
            } else {
                // If organizer/admin and no teamId provided, maybe return all?
                // Plan says "List officials", let's support teamId filtering or default to empty/error if vague?
                // Let's require teamId for non-TM if they want specific team, or just return all for category?
                // Returning all for category might be useful for organizer.
                // Let's stick to "target specific team" pattern for consistency with roster.
                // But if purely "list officials in category" (e.g. for generating tournament accreditation), maybe all is better.
                // Let's support filtering. if teamId provided -> filter. if not provided -> if ORG/ADMIN -> all. if TM -> my team.
            }
        }

        // Access Control
        if (userRole === UserRole.TEAM_MANAGER) {
            const managedTeam = await this.prisma.team.findUnique({
                where: { managerId: userId },
                select: { id: true },
            });
            // If try to view other team
            if (targetTeamId && (!managedTeam || managedTeam.id !== targetTeamId)) {
                throw new ForbiddenException('You can only view your own team officials');
            }
            // If no targetTeamId, we naturally show only my team (logic below)
            if (!targetTeamId && managedTeam) targetTeamId = managedTeam.id;
        } else if (userRole === UserRole.ORGANIZER) {
            // Check event ownership
            const category = await this.prisma.eventCategory.findUnique({
                where: { id: categoryId },
                include: { event: true },
            });
            if (!category) throw new NotFoundException('Category not found');
            if (category.event.organizerId !== userId) {
                throw new ForbiddenException('You are not the organizer of this event');
            }
        }

        const where: any = { categoryId };
        if (targetTeamId) {
            where.teamId = targetTeamId;
        }

        return this.prisma.categoryOfficial.findMany({
            where,
            orderBy: { name: 'asc' },
        });
    }

    async addOfficial(
        categoryId: string,
        dto: CreateOfficialDto,
        userId: string,
        userRole: UserRole,
    ) {
        if (userRole !== UserRole.TEAM_MANAGER && userRole !== UserRole.ADMIN) {
            throw new ForbiddenException('Only Team Managers can manage officials');
        }

        // 1. Resolve Team
        let teamId: string;
        if (userRole === UserRole.TEAM_MANAGER) {
            const team = await this.prisma.team.findUnique({
                where: { managerId: userId },
            });
            if (!team) throw new ForbiddenException('You do not manage a team');
            teamId = team.id;
        } else {
            throw new ForbiddenException('Admin flow not implemented');
        }

        // 2. Check category existence
        const category = await this.prisma.eventCategory.findUnique({
            where: { id: categoryId },
        });
        if (!category) throw new NotFoundException('Category not found');

        // 3. Check registration
        const registration = await this.prisma.eventCategoryTeam.findUnique({
            where: {
                eventCategoryId_teamId: {
                    eventCategoryId: categoryId,
                    teamId,
                },
            },
        });
        if (!registration) {
            throw new BadRequestException('Team is not registered in this category');
        }

        // 4. Create official
        return this.prisma.categoryOfficial.create({
            data: {
                categoryId,
                teamId,
                name: dto.name,
                role: dto.role,
                photoUrl: dto.photoUrl,
            },
        });
    }

    async updateOfficial(
        id: string,
        dto: UpdateOfficialDto,
        userId: string,
        userRole: UserRole,
    ) {
        if (userRole !== UserRole.TEAM_MANAGER && userRole !== UserRole.ADMIN) {
            throw new ForbiddenException('Only Team Managers can manage officials');
        }

        const official = await this.prisma.categoryOfficial.findUnique({
            where: { id },
        });
        if (!official) throw new NotFoundException('Official not found');

        // Ownership check
        if (userRole === UserRole.TEAM_MANAGER) {
            const team = await this.prisma.team.findUnique({
                where: { managerId: userId },
            });
            if (!team || team.id !== official.teamId) {
                throw new ForbiddenException('You do not manage this team');
            }
        }

        return this.prisma.categoryOfficial.update({
            where: { id },
            data: dto,
        });
    }

    async removeOfficial(
        id: string,
        userId: string,
        userRole: UserRole,
    ) {
        if (userRole !== UserRole.TEAM_MANAGER && userRole !== UserRole.ADMIN) {
            throw new ForbiddenException('Only Team Managers can manage officials');
        }

        const official = await this.prisma.categoryOfficial.findUnique({
            where: { id },
        });
        if (!official) throw new NotFoundException('Official not found');

        // Ownership check
        if (userRole === UserRole.TEAM_MANAGER) {
            const team = await this.prisma.team.findUnique({
                where: { managerId: userId },
            });
            if (!team || team.id !== official.teamId) {
                throw new ForbiddenException('You do not manage this team');
            }
        }

        return this.prisma.categoryOfficial.delete({
            where: { id },
        });
    }
}
