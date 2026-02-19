import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadsService } from './uploads.service';
import { multerImageOptions } from './multer.config';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('file', multerImageOptions))
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    return this.uploadsService.handleImageUpload(file);
  }
}
