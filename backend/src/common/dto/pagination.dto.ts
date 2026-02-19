import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

/**
 * Shared pagination DTO for list endpoints.
 * All fields are optional with sensible defaults.
 *
 * @example
 * ```
 * GET /api/events?page=2&limit=20&sort=createdAt&order=desc
 * ```
 */
export class PaginationDto {
  /**
   * Page number (1-based).
   * @default 1
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  /**
   * Number of items per page.
   * @default 20
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  /**
   * Field name to sort by.
   * @default 'createdAt'
   */
  @IsOptional()
  @IsString()
  sort: string = 'createdAt';

  /**
   * Sort direction: 'asc' or 'desc'.
   * @default 'desc'
   */
  @IsOptional()
  @IsEnum(SortOrder)
  order: SortOrder = SortOrder.DESC;

  /**
   * Calculate the number of records to skip for Prisma's `skip` parameter.
   */
  get skip(): number {
    return (this.page - 1) * this.limit;
  }

  /**
   * Build a Prisma-compatible `orderBy` object from sort and order fields.
   */
  get orderBy(): Record<string, string> {
    return { [this.sort]: this.order };
  }
}

/**
 * Pagination metadata to include in paginated responses.
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Helper function to build pagination metadata.
 */
export function buildPaginationMeta(
  page: number,
  limit: number,
  total: number,
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}
