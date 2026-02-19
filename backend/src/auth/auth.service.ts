import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { TokenResponseDto } from './dto/token-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Register a new user account. Validates email uniqueness, hashes the password,
   * creates the user, and returns a token pair.
   */
  async register(dto: RegisterDto): Promise<TokenResponseDto> {
    const existing = await this.usersService.findByEmail(dto.email);

    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const user = await this.usersService.create({
      email: dto.email,
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role,
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.hashAndStoreRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user,
    };
  }

  /**
   * Authenticate a user with email and password. Returns a token pair on success.
   */
  async login(dto: LoginDto): Promise<TokenResponseDto> {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.hashAndStoreRefreshToken(user.id, tokens.refreshToken);
    await this.usersService.updateLastLogin(user.id);

    const { passwordHash, refreshToken, ...safeUser } = user;

    return {
      ...tokens,
      user: safeUser,
    };
  }

  /**
   * Validate the incoming refresh token against the stored hash and issue a new
   * token pair. This rotates both the access and refresh tokens.
   */
  async refreshTokens(
    userId: string,
    incomingRefreshToken: string,
  ): Promise<TokenResponseDto> {
    const user = await this.usersService.findByIdFull(userId);

    if (!user || !user.isActive) {
      throw new ForbiddenException('Access denied');
    }

    if (!user.refreshToken) {
      throw new ForbiddenException('Access denied - no active session');
    }

    const tokenMatches = await bcrypt.compare(
      incomingRefreshToken,
      user.refreshToken,
    );

    if (!tokenMatches) {
      throw new ForbiddenException('Access denied - invalid refresh token');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.hashAndStoreRefreshToken(user.id, tokens.refreshToken);

    const { passwordHash, refreshToken, ...safeUser } = user;

    return {
      ...tokens,
      user: safeUser,
    };
  }

  /**
   * Log out by clearing the stored refresh token hash.
   */
  async logout(userId: string): Promise<void> {
    await this.usersService.updateRefreshToken(userId, null);
  }

  /**
   * Generate a pair of JWT tokens: a short-lived access token (15m)
   * and a longer-lived refresh token (7d).
   */
  async generateTokens(
    userId: string,
    email: string,
    role: UserRole,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Hash the refresh token and store it on the user record.
   */
  private async hashAndStoreRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const hash = await bcrypt.hash(refreshToken, 12);
    await this.usersService.updateRefreshToken(userId, hash);
  }
}
