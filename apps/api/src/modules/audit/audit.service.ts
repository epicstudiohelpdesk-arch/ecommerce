import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface AuditLogEntry {
  actorId?: string | null;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string;
  ipAddress?: string;
  userAgent?: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Records an immutable security or operational event to the audit_logs table.
   * Strips all potential credentials/secrets before persistence.
   */
  async logEvent(entry: AuditLogEntry): Promise<void> {
    try {
      const sanitizedMetadata = this.sanitizePayload(entry.metadata);
      const sanitizedBefore = this.sanitizePayload(entry.beforeState);
      const sanitizedAfter = this.sanitizePayload(entry.afterState);

      await this.databaseService.db.insert(this.databaseService.schema.auditLogs).values({
        actorId: entry.actorId ?? null,
        actorRole: entry.actorRole,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ? entry.userAgent.substring(0, 500) : null,
        beforeState: sanitizedBefore ?? null,
        afterState: sanitizedAfter ?? null,
        metadata: sanitizedMetadata ?? null,
      });
    } catch (err) {
      // Never crash the primary transaction due to secondary audit log failure,
      // but write to stderr logger immediately.
      this.logger.error(
        `Failed to record audit log: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  /**
   * Sanitizes payloads by removing sensitive fields (passwords, tokens, secrets, codes)
   */
  private sanitizePayload(
    obj: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> | null {
    if (!obj) return null;
    const sensitiveKeys = [
      'password',
      'passwordhash',
      'secret',
      'mfasecret',
      'token',
      'refreshtoken',
      'accesstoken',
      'code',
      'otp',
      'authorization',
    ];

    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        sanitized[key] = this.sanitizePayload(val as Record<string, unknown>);
      } else {
        sanitized[key] = val;
      }
    }
    return sanitized;
  }
}
