import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';

@Injectable()
export class UploadsService {
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    // Build base URL from APP_URL env, or derive from PORT
    const appUrl = this.configService.get<string>('APP_URL');
    if (appUrl) {
      this.baseUrl = appUrl;
    } else {
      const port = this.configService.get<string>('PORT', '3001');
      this.baseUrl = `http://localhost:${port}`;
    }
  }

  /**
   * Process an uploaded file and return the full public URL.
   * @param file - the uploaded multer file
   * @param subdir - optional subdirectory (e.g. 'avatars', 'team-logo').
   *                 If provided, the URL path includes the subdir segment.
   */
  handleImageUpload(file: Express.Multer.File, subdir?: string): { url: string } {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const pathSegment = subdir ? `${subdir}/${file.filename}` : file.filename;
    const url = `${this.baseUrl}/api/storage/${pathSegment}`;

    return { url };
  }

  /**
   * Delete a previously uploaded file by its relative storage path.
   * @param relativePath - e.g. "avatars/abc123.jpg" or "abc123.jpg"
   */
  deleteFile(relativePath: string): void {
    const absPath = join(process.cwd(), 'uploads', relativePath);
    if (existsSync(absPath)) {
      try {
        unlinkSync(absPath);
      } catch {
        // Non-fatal: log but don't throw
      }
    }
  }
}
