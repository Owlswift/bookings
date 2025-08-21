import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { HealthService } from './health.service';
import { register } from 'prom-client';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  async checkHealth() {
    const [db, redis] = await Promise.all([
      this.healthService.checkDatabase(),
      this.healthService.checkRedis(),
    ]);

    return {
      status: db && redis ? 'OK' : 'PARTIAL',
      database: db ? 'connected' : 'disconnected',
      redis: redis ? 'connected' : 'disconnected',
    };
  }

  @Get('metrics')
  getMetrics() {
    return this.healthService.getBasicMetrics();
  }

  @Get('metrics.prom')
  async metricsProm(@Res() res: Response) {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  }
}
