import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { RedisModule } from 'src/redis/redis.module';
import { AuthModule } from 'src/auth/auth.module';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  controllers: [BookingsController],
  providers: [BookingsService],
  imports: [RedisModule, AuthModule, NotificationsModule],
})
export class BookingsModule {}
