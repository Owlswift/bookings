import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  controllers: [HealthController],
  providers: [HealthService],
  imports: [RedisModule],
})
export class HealthModule {}
