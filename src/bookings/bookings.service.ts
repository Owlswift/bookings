import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { CreateBookingDto } from './dto/create-booking.dto';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { RedisService } from 'src/redis/redis.service';
import { PrismaService } from 'prisma/prisma.service';
import { BookingResponseDto } from './dto/booking.response.dto';
import { plainToInstance } from 'class-transformer';
import { Booking, Prisma, Role } from '@prisma/client';
import { NotificationsService } from 'src/notifications/notifications.service';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private schedulerRegistry: SchedulerRegistry,
    private notifications: NotificationsService,
  ) {}

  private scheduleReminder(booking: Booking) {
    try {
      const reminderTime = new Date(booking.startTime);
      reminderTime.setMinutes(reminderTime.getMinutes() - 10);

      const job = new CronJob(reminderTime, () => {
        this.notifications.notifyBookingCreated(booking);
        this.schedulerRegistry.deleteCronJob(`reminder-${booking.id}`);
      });

      this.schedulerRegistry.addCronJob(`reminder-${booking.id}`, job);
      job.start();
    } catch (err) {
      const error = err as Error;
      this.logger.error(
        `Failed to schedule reminder for booking ${booking.id}: ${error.message}`,
        error.stack,
      );
    }
  }

  async create(
    createBookingDto: CreateBookingDto,
    userId: number,
  ): Promise<BookingResponseDto> {
    try {
      const now = new Date();
      const startTime = new Date(createBookingDto.startTime);
      const endTime = new Date(createBookingDto.endTime);

      if (startTime < now) {
        throw new BadRequestException('Cannot create a booking in the past');
      }

      if (endTime <= startTime) {
        throw new BadRequestException('End time must be after start time');
      }

      const booking = await this.prisma.booking.create({
        data: {
          ...createBookingDto,
          userId,
          status: 'CONFIRMED',
        },
      });

      this.redisService.publish('booking.created', JSON.stringify(booking));
      this.scheduleReminder(booking);

      return plainToInstance(BookingResponseDto, booking);
    } catch (err) {
      const error = err as Error;

      // ✅ Rethrow known exceptions (so tests & API behave correctly)
      if (err instanceof BadRequestException) {
        throw err;
      }

      this.logger.error(
        `Failed to create booking: ${error.message}`,
        error.stack,
      );

      throw new InternalServerErrorException('Failed to create booking');
    }
  }

  async findOne(id: number, currentUser: { userId: number; roles: Role[] }) {
    try {
      if (isNaN(id) || id <= 0) {
        throw new BadRequestException(`Invalid booking id: ${id}`);
      }

      const booking = await this.prisma.booking.findUnique({ where: { id } });
      if (!booking) {
        throw new NotFoundException(`Booking with id ${id} not found`);
      }

      if (currentUser.roles.includes('ADMIN')) {
        return plainToInstance(BookingResponseDto, booking);
      }

      if (
        currentUser.roles.includes('PROVIDER') &&
        booking.providerId !== currentUser.userId
      ) {
        throw new ForbiddenException('Not authorized to access this booking');
      }

      if (
        currentUser.roles.includes('USER') &&
        booking.userId !== currentUser.userId
      ) {
        throw new ForbiddenException('Not authorized to access this booking');
      }

      return plainToInstance(BookingResponseDto, booking);
    } catch (err) {
      const error = err as Error;
      this.logger.error(
        `Error fetching booking ${id}: ${error.message}`,
        error.stack,
      );
      if (
        err instanceof NotFoundException ||
        err instanceof BadRequestException ||
        err instanceof ForbiddenException
      ) {
        throw err;
      }
      throw new InternalServerErrorException('Failed to fetch booking');
    }
  }

  async findAll(
    type: 'upcoming' | 'past',
    page: number = 1,
    limit: number = 10,
    user: { userId: number; email: string; roles: string[] },
  ) {
    if (page <= 0 || limit <= 0) {
      throw new BadRequestException('Page and limit must be positive numbers');
    }

    try {
      const now = new Date();
      let where: Prisma.BookingWhereInput =
        type === 'upcoming'
          ? { startTime: { gt: now } }
          : { startTime: { lt: now } };

      if (user.roles.includes('USER')) {
        where = { ...where, userId: user.userId };
      } else if (user.roles.includes('PROVIDER')) {
        where = { ...where, providerId: user.userId };
      }

      const [bookings, total] = await Promise.all([
        this.prisma.booking.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { startTime: 'asc' },
        }),
        this.prisma.booking.count({ where }),
      ]);

      return {
        data: plainToInstance(BookingResponseDto, bookings),
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (err) {
      const error = err as Error;
      this.logger.error(
        `Error fetching bookings list: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to fetch bookings');
    }
  }
}
