import { describe, expect, it } from 'vitest';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';

describe('AppController unit test', () => {
  it('returns valid health check response conforming to api-contracts', () => {
    const appService = new AppService();
    const controller = new AppController(appService);
    const response = controller.getHealth();

    expect(response.success).toBe(true);
    expect(response.data.status).toBe('ok');
    expect(response.data.service).toBe('handcrafted-marketplace-api');
    expect(response.data.version).toBe('0.1.0');
    expect(response.data.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(response.meta?.timestamp).toBeDefined();
  });
});
