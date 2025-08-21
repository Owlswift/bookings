import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { SchedulerRegistry } from '@nestjs/schedule';
import { AppModule } from '../src/app.module';
import * as bcrypt from 'bcrypt';

describe('Booking Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redisService: RedisService;
  let scheduler: SchedulerRegistry;
  let authToken: string;
  let createdBookingId: number;
  let testUserId: number;
  let provider;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    redisService = moduleFixture.get<RedisService>(RedisService);
    scheduler = moduleFixture.get<SchedulerRegistry>(SchedulerRegistry);

    // Reset test database
    await prisma.booking.deleteMany({});
    await prisma.user.deleteMany({});

    // Hash password
    const password = 'secret';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create USER
    const testUser = await prisma.user.create({
      data: {
        email: 'user@point.com',
        password: hashedPassword,
        role: 'USER',
      },
    });
    testUserId = testUser.id;

    // Create PROVIDER
    provider = await prisma.user.create({
      data: {
        email: 'provider@point.com',
        password: await bcrypt.hash(password, 10),
        role: 'PROVIDER',
      },
    });

    // Login as USER
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'user@point.com',
        password: password, // plain text, will match hashed password
      });

    if (!loginResponse.body.access_token) {
      console.error('Login response body:', loginResponse.body);
      throw new Error(
        `No auth token returned from /auth/login. Got: ${JSON.stringify(
          loginResponse.body,
        )}`,
      );
    }

    authToken = loginResponse.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should complete full booking flow', async () => {
    // Spy BEFORE booking creation
    const publishSpy = jest.spyOn(redisService, 'publish');

    // 1. Create booking
    const bookingData = {
      userId: testUserId,
      providerId: provider.id, // provider created in setup
      serviceType: 'MANICURE', // must match Prisma enum
      startTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      endTime: new Date(Date.now() + 7200000).toISOString(), // 2 hours from now
    };

    const createResponse = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${authToken}`)
      .send(bookingData)
      .expect(201);

    expect(createResponse.body).toHaveProperty('id');
    createdBookingId = createResponse.body.id;

    // 2. Verify Redis publish
    expect(publishSpy).toHaveBeenCalledWith(
      'booking.created',
      expect.stringContaining(`"id":${createdBookingId}`),
    );

    // 3. Verify reminder job scheduled
    const jobExists = scheduler.doesExist(
      'cron',
      `reminder-${createdBookingId}`,
    );
    expect(jobExists).toBe(true);

    // 4. Get booking by ID
    const getResponse = await request(app.getHttpServer())
      .get(`/bookings/${createdBookingId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(getResponse.body.id).toEqual(createdBookingId);
    expect(getResponse.body.serviceType).toEqual(bookingData.serviceType);

    // 5. List upcoming bookings
    const listResponse = await request(app.getHttpServer())
      .get('/bookings?type=upcoming')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(listResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: createdBookingId }),
      ]),
    );
  });
});
