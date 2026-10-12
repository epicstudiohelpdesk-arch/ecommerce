import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import type { PresignedProductMediaRequestInput } from '@repo/validation';
import type { PresignedProductMediaUploadTicket } from '@repo/api-contracts';

@Injectable()
export class ProductMediaService {
  private readonly storageSecret: string;
  private readonly publicMediaPrefix = 'public/products';

  constructor() {
    this.storageSecret =
      process.env['STORAGE_SIGNING_SECRET'] ||
      process.env['JWT_SECRET'] ||
      'dev-storage-secret-handcrafted-marketplace-2026';
  }

  /**
   * Validates file upload constraints (MIME type and size limit).
   */
  validateMediaConstraints(mimeType: string, fileSizeBytes: number) {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowedMimeTypes.includes(mimeType)) {
      throw new BadRequestException(
        `Invalid media format: ${mimeType}. Allowed image formats: JPEG, PNG, WEBP.`,
      );
    }

    const maxSizeBytes = 10 * 1024 * 1024; // 10 MB
    if (fileSizeBytes <= 0 || fileSizeBytes > maxSizeBytes) {
      throw new BadRequestException(
        `File size must be between 1 byte and 10 MB. Received: ${fileSizeBytes} bytes.`,
      );
    }
  }

  /**
   * Generates a non-guessable, seller-isolated object storage path for public product media.
   */
  generateStoragePath(sellerId: string, fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() || 'jpg';
    const uniqueId = crypto.randomUUID();
    return `${this.publicMediaPrefix}/${sellerId}/${uniqueId}.${ext}`;
  }

  /**
   * Issues a short-lived (15 minutes) HMAC-signed pre-signed upload ticket for direct image upload.
   */
  generateUploadTicket(
    sellerId: string,
    input: PresignedProductMediaRequestInput,
  ): PresignedProductMediaUploadTicket {
    this.validateMediaConstraints(input.mimeType, input.fileSizeBytes);

    const mediaId = crypto.randomUUID();
    const storagePath = this.generateStoragePath(sellerId, input.fileName);
    const expiresInSeconds = 900; // 15 minutes
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;

    const payloadToSign = `MEDIA_UPLOAD:${mediaId}:${storagePath}:${input.mimeType}:${input.fileSizeBytes}:${expiresAt}`;
    const signature = crypto
      .createHmac('sha256', this.storageSecret)
      .update(payloadToSign)
      .digest('hex');

    const presignedUploadUrl = `/api/v1/storage/upload?ticket=${mediaId}&path=${encodeURIComponent(
      storagePath,
    )}&expires=${expiresAt}&sig=${signature}`;

    return {
      mediaId,
      storagePath,
      presignedUploadUrl,
      expiresInSeconds,
    };
  }

  /**
   * Resolves a public CDN / static URL for an uploaded product image.
   */
  getPublicUrlForPath(storagePath: string): string {
    // In dev/test, simulated endpoint; in production, maps to CDN bucket
    return `/media/${storagePath}`;
  }
}
