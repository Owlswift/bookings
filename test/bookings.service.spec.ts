import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { BookingsService } from '../src/bookings/bookings.service';
import { PrismaService } from 'prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('BookingsService', () => {
  let service: BookingsService;
  let prisma: PrismaService;
  let redis: RedisService;
  let scheduler: SchedulerRegistry;
  let notifications: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: PrismaService,
          useValue: {
            booking: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
            },
          },
        },
        {
          provide: RedisService,
          useValue: {
            publish: jest.fn(),
          },
        },
        {
          provide: SchedulerRegistry,
          useValue: {
            addCronJob: jest.fn(),
            deleteCronJob: jest.fn(),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            notifyBookingCreated: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    prisma = module.get<PrismaService>(PrismaService);
    redis = module.get<RedisService>(RedisService);
    scheduler = module.get<SchedulerRegistry>(SchedulerRegistry);
    notifications = module.get<NotificationsService>(NotificationsService);
  });

  describe('create', () => {
    it('should throw if start time is in the past', async () => {
      const dto: any = {
        serviceType: 'Consultation',
        startTime: new Date(Date.now() - 10000).toISOString(),
        endTime: new Date(Date.now() + 10000).toISOString(),
      };

      await expect(service.create(dto, 1)).rejects.toThrow(BadRequestException);
    });

    it('should throw if end time <= start time', async () => {
      const start = new Date(Date.now() + 10000);
      const dto: any = {
        serviceType: 'Consultation',
        startTime: start.toISOString(),
        endTime: start.toISOString(),
      };

      await expect(service.create(dto, 1)).rejects.toThrow(BadRequestException);
    });

    it('should create booking and schedule reminder', async () => {
      const start = new Date(Date.now() + 60 * 60 * 1000);
      const end = new Date(Date.now() + 2 * 60 * 60 * 1000);

      const dto: any = {
        serviceType: 'Consultation',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      };

      const booking = {
        id: 1,
        ...dto,
        userId: 1,
        status: 'CONFIRMED',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(prisma.booking, 'create').mockResolvedValue(booking as any);

      const result = await service.create(dto, 1);

      expect(prisma.booking.create).toHaveBeenCalledWith({
        data: { ...dto, userId: 1, status: 'CONFIRMED' },
      });
      expect(redis.publish).toHaveBeenCalledWith(
        'booking.created',
        JSON.stringify(booking),
      );
      expect(scheduler.addCronJob).toHaveBeenCalledWith(
        `reminder-${booking.id}`,
        expect.any(CronJob),
      );
      expect(notifications.notifyBookingCreated).not.toHaveBeenCalled(); // only called at reminder time
      expect(result).toHaveProperty('id', 1);
    });
  });

  describe('findOne', () => {
    it('should throw if booking not found', async () => {
      jest.spyOn(prisma.booking, 'findUnique').mockResolvedValue(null);

      await expect(
        service.findOne(1, { userId: 1, roles: ['USER'] as any }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow ADMIN to access any booking', async () => {
      const booking = { id: 1, userId: 2, providerId: 3 };
      jest
        .spyOn(prisma.booking, 'findUnique')
        .mockResolvedValue(booking as any);

      const result = await service.findOne(1, {
        userId: 99,
        roles: ['ADMIN'] as any,
      });
      expect(result.id).toEqual(1);
    });

    it('should forbid USER from accessing another user’s booking', async () => {
      const booking = { id: 1, userId: 2 };
      jest
        .spyOn(prisma.booking, 'findUnique')
        .mockResolvedValue(booking as any);

      await expect(
        service.findOne(1, { userId: 99, roles: ['USER'] as any }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAll', () => {
    it('should return paginated upcoming bookings for USER', async () => {
      const now = new Date();
      const bookings = [
        { id: 1, userId: 1, startTime: new Date(now.getTime() + 10000) },
      ];

      jest.spyOn(prisma.booking, 'findMany').mockResolvedValue(bookings as any);
      jest.spyOn(prisma.booking, 'count').mockResolvedValue(1);

      const result = await service.findAll('upcoming', 1, 10, {
        userId: 1,
        email: 'a@b.com',
        roles: ['USER'],
      });

      expect(result.data[0].id).toBe(1);
      expect(result.meta.total).toBe(1);
    });
  });
});
