import { Injectable } from '@nestjs/common';
import type { HealthCheckData } from '@repo/api-contracts';

@Injectable()
export class AppService {
  private readonly startTime = Date.now();

  getHealth(): HealthCheckData {
    return {
      status: 'ok',
      service: 'handcrafted-marketplace-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }
}
