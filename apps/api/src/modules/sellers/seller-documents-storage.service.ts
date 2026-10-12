import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import type { PresignedDocumentRequestInput } from '@repo/validation';
import type { PresignedDocumentUploadTicket } from '@repo/api-contracts';

@Injectable()
export class SellerDocumentsStorageService {
  private readonly storageSecret: string;
  private readonly baseStoragePrefix = 'private/sellers';

  constructor() {
    this.storageSecret =
      process.env['STORAGE_SIGNING_SECRET'] ||
      process.env['JWT_SECRET'] ||
      'dev-storage-secret-handcrafted-marketplace-2026';
  }

  /**
   * Generates a non-guessable, multi-tenant isolated storage path for private KYC documents.
   */
  generateStoragePath(sellerId: string, documentType: string, fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() || 'bin';
    const uniqueId = crypto.randomUUID();
    return `${this.baseStoragePrefix}/${sellerId}/${documentType}/${uniqueId}.${ext}`;
  }

  /**
   * Generates a secure, time-limited pre-signed upload ticket for direct private upload.
   */
  generateUploadTicket(
    sellerId: string,
    input: PresignedDocumentRequestInput,
  ): PresignedDocumentUploadTicket {
    const documentId = crypto.randomUUID();
    const storagePath = this.generateStoragePath(sellerId, input.documentType, input.fileName);
    const expiresInSeconds = 900; // 15 minutes
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;

    // Generate HMAC signature guaranteeing ticket integrity
    const payloadToSign = `UPLOAD:${documentId}:${storagePath}:${input.mimeType}:${input.fileSizeBytes}:${expiresAt}`;
    const signature = crypto
      .createHmac('sha256', this.storageSecret)
      .update(payloadToSign)
      .digest('hex');

    // Secure endpoint ticket URL (simulates S3 PUT URL in dev/test, delegates to object store)
    const presignedUploadUrl = `/api/v1/storage/upload?ticket=${documentId}&path=${encodeURIComponent(
      storagePath,
    )}&expires=${expiresAt}&sig=${signature}`;

    return {
      documentId,
      storagePath,
      presignedUploadUrl,
      expiresInSeconds,
    };
  }

  /**
   * Generates a 5-minute pre-signed download URL accessible only by authorized staff reviewers.
   */
  generateAuthorizedDownloadUrl(storagePath: string, reviewerId: string): string {
    const expiresInSeconds = 300; // 5 minutes max access
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;

    const payloadToSign = `DOWNLOAD:${storagePath}:${reviewerId}:${expiresAt}`;
    const signature = crypto
      .createHmac('sha256', this.storageSecret)
      .update(payloadToSign)
      .digest('hex');

    return `/api/v1/storage/download?path=${encodeURIComponent(
      storagePath,
    )}&reviewer=${reviewerId}&expires=${expiresAt}&sig=${signature}`;
  }

  /**
   * Validates file upload constraints (MIME type and size limit).
   */
  validateDocumentConstraints(mimeType: string, fileSizeBytes: number) {
    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

    if (!allowedMimeTypes.includes(mimeType)) {
      throw new BadRequestException(
        `Invalid document format: ${mimeType}. Allowed formats: PDF, JPEG, PNG, WEBP.`,
      );
    }

    const maxSizeBytes = 10 * 1024 * 1024; // 10 MB
    if (fileSizeBytes <= 0 || fileSizeBytes > maxSizeBytes) {
      throw new BadRequestException(
        `File size must be between 1 byte and 10 MB. Received: ${fileSizeBytes} bytes.`,
      );
    }
  }
}
