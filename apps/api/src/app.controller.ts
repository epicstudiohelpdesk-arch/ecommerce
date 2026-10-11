import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { type ApiResponse, createSuccessResponse, type HealthCheckData } from '@repo/api-contracts';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth(): ApiResponse<HealthCheckData> {
    const data = this.appService.getHealth();
    return createSuccessResponse(data);
  }
}
