import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response } from 'express';
import { Counter, Gauge, register, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  private requestCounter: Counter<string>;
  private responseTimeGauge: Gauge<string>;

  constructor() {
    // Collect default metrics (no timeout option)
    collectDefaultMetrics();

    // Get existing metric or create new Counter
    this.requestCounter =
      (register.getSingleMetric('http_requests_total') as Counter<string>) ||
      new Counter({
        name: 'http_requests_total',
        help: 'Total number of HTTP requests',
        labelNames: ['method', 'route', 'status'],
      });

    // Get existing metric or create new Gauge
    this.responseTimeGauge =
      (register.getSingleMetric(
        'http_response_time_seconds',
      ) as Gauge<string>) ||
      new Gauge({
        name: 'http_response_time_seconds',
        help: 'HTTP response time in seconds',
        labelNames: ['method', 'route'],
      });

    // Register metrics if they weren't already
    if (!register.getSingleMetric('http_requests_total')) {
      register.registerMetric(this.requestCounter);
    }
    if (!register.getSingleMetric('http_response_time_seconds')) {
      register.registerMetric(this.responseTimeGauge);
    }
  }

  use(req: Request, res: Response, next: () => void) {
    const start = Date.now();
    const { method, path } = req;

    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      this.responseTimeGauge.labels(method, path).set(duration);
      this.requestCounter.inc({
        method,
        route: path,
        status: res.statusCode,
      });
    });

    next();
  }
}
