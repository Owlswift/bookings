import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Server } from 'socket.io';
import { RedisService } from 'src/redis/redis.service';
import { Booking } from 'src/bookings/entities/booking.entity';
import { Subscription } from 'rxjs';

@Injectable()
export class NotificationsService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private io: Server | null = null;
  private pending: Booking[] = [];
  private redisSub: Subscription | null = null;

  constructor(private readonly redisService: RedisService) {}

  setServer(server: Server) {
    this.io = server;
    this.logger.log('Socket.IO server registered in NotificationsService');
    this.initRedisSubscription();
    this.flushPending();
  }

  private initRedisSubscription() {
    if (this.redisSub) return;

    if (!this.redisService.isConnected) {
      this.logger.warn(
        'Redis not connected yet — will retry subscribing in 5s',
      );
      setTimeout(() => this.initRedisSubscription(), 5000);
      return;
    }

    this.redisSub = this.redisService.subscribe('booking.created').subscribe({
      next: (message) => {
        try {
          const booking = JSON.parse(message) as Booking;
          this.logger.debug(
            `NotificationsService received Redis booking: ${message}`,
          );
          this.handleBookingCreated(booking);
        } catch (err) {
          this.logger.error('Failed to parse booking message', err);
        }
      },
      error: (err) => {
        this.logger.error(
          'Redis subscription error in NotificationsService',
          err,
        );
        this.redisSub?.unsubscribe();
        this.redisSub = null;
      },
    });

    this.logger.log('NotificationsService subscribed to Redis booking.created');
  }

  private flushPending() {
    if (!this.io) return;
    if (this.pending.length === 0) return;
    this.logger.log(`Flushing ${this.pending.length} pending booking(s)`);
    this.pending.forEach((b) => this.broadcastBooking(b));
    this.pending = [];
  }

  private handleBookingCreated(booking: Booking) {
    if (!this.io) {
      this.logger.warn('Socket server not set yet — buffering booking');
      this.pending.push(booking);
      return;
    }

    this.broadcastBooking(booking);
  }

  private broadcastBooking(booking: Booking) {
    try {
      const adminRoom = 'admin.bookings';
      const adminClients =
        (this.io?.sockets?.adapter?.rooms?.get(adminRoom)?.size as number) || 0;

      this.logger.debug(
        `Broadcasting booking ${booking.id} to admin room (${adminClients} clients)`,
      );

      this.io!.to(adminRoom).emit('booking.created', booking);
      this.io!.to(`provider.${booking.providerId}`).emit(
        'booking.created',
        booking,
      );
    } catch (err) {
      this.logger.error('Error broadcasting booking', err);
    }
  }

  notifyBookingCreated(booking: Booking) {
    this.handleBookingCreated(booking);
  }

  onModuleDestroy() {
    this.redisSub?.unsubscribe();
  }
}
