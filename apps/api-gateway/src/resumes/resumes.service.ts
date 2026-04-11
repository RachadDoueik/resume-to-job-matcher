import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ResumesService {
  private s3Client: S3Client;
  private s3Bucket: string;
  private readonly logger = new Logger(ResumesService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.s3Bucket = this.configService.get<string>('S3_BUCKET_NAME') || 'resumes';
    this.s3Client = new S3Client({
      region: this.configService.get<string>('AWS_REGION') || 'us-east-1',
      endpoint: this.configService.get<string>('S3_ENDPOINT') || 'http://localhost:9000',
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || 'minioadmin',
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || 'minioadmin',
      },
      forcePathStyle: true,
    });
  }

  async uploadToMinio(file: any, userId: string) {
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF resumes are supported');
    }

    // Using uuid so we don't have filename collisions
    const fileId = `${uuidv4()}.pdf`; 

    try {
      this.logger.log(`Uploading file ${fileId} for user ${userId} to MinIO...`);
      
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.s3Bucket,
          Key: fileId,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );

      this.logger.log(`Successfully uploaded. Saving metadata...`);
      
      // Matcher takes care of extraction, default content represents untouched state
      const savedResume = await this.prisma.resume.create({
        data: {
          id: fileId,
          userId: userId,
          content: '',
          isPrimary: true,
        },
      });

      return {
        message: 'Resume uploaded successfully',
        resumeId: savedResume.id,
      };
    } catch (error: any) {
      this.logger.error(`Upload failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to process upload: ' + error.message);
    }
  }
}
