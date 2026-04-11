import { Controller, Post, UseInterceptors, UploadedFile, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ResumesService } from './resumes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/interfaces/auth-user.interface';

@Controller('resumes')
@UseGuards(JwtAuthGuard)
export class ResumesController {
  constructor(private readonly resumesService: ResumesService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadResume(@UploadedFile() file: any, @Req() req: any) {
    if (!file) throw new BadRequestException('No file provided');
    
    // Explicit cast since Express.Multer.File is tricky to import correctly on some environments
    const user = req.user as AuthUser;
    return this.resumesService.uploadToMinio(file, user.id);
  }
}