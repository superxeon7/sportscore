import { UserRole } from '@prisma/client';

export class TokenUserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class TokenResponseDto {
  accessToken: string;
  refreshToken: string;
  user: TokenUserDto;
}
