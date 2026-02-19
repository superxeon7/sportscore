import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { randomBytes } from 'crypto';
import { BadRequestException } from '@nestjs/common';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

// Ensure base upload directory exists
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_IMAGE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const imageFileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (!ALLOWED_IMAGE_MIMES.includes(file.mimetype)) {
    cb(
      new BadRequestException(
        `Invalid file type. Allowed types: ${ALLOWED_IMAGE_MIMES.join(', ')}`,
      ),
      false,
    );
    return;
  }
  cb(null, true);
};

/**
 * Factory that creates multer options for a given subdirectory.
 * Files will be stored at uploads/<subdir>/<hash><ext>.
 */
export function createMulterImageOptions(subdir: string) {
  const destDir = join(UPLOAD_DIR, subdir);
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  return {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        cb(null, destDir);
      },
      filename: (_req, file, cb) => {
        const hash = randomBytes(16).toString('hex');
        const ext = extname(file.originalname).toLowerCase();
        cb(null, `${hash}${ext}`);
      },
    }),
    limits: {
      fileSize: MAX_FILE_SIZE,
    },
    fileFilter: imageFileFilter,
  };
}

/** Backward-compatible default (uploads root, no subdir) */
export const multerImageOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
      const hash = randomBytes(16).toString('hex');
      const ext = extname(file.originalname).toLowerCase();
      cb(null, `${hash}${ext}`);
    },
  }),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: imageFileFilter,
};
