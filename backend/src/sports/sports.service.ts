import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSportDto } from './dto/create-sport.dto';
import { UpdateSportDto } from './dto/update-sport.dto';

@Injectable()
export class SportsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSportDto) {
    return this.prisma.sport.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        icon: dto.icon,
        rules: dto.rules ?? {},
        scoringSystem: dto.scoringSystem ?? {},
        eventTypes: dto.eventTypes ?? [],
        displayConfig: dto.displayConfig ?? {},
      },
    });
  }

  async findAll() {
    return this.prisma.sport.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const sport = await this.prisma.sport.findUnique({
      where: { id },
    });

    if (!sport) {
      throw new NotFoundException(`Sport with ID "${id}" not found`);
    }

    return sport;
  }

  async update(id: string, dto: UpdateSportDto) {
    await this.findOne(id);

    return this.prisma.sport.update({
      where: { id },
      data: {
        ...dto,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.sport.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
