import { ConfigService } from '@nestjs/config';
import { RedisService } from '../src/redis/redis.service';

jest.mock('../src/redis/redis.service', () => ({
  RedisService: jest.fn().mockImplementation(() => ({
    publish: jest.fn().mockResolvedValue(true),
    ping: jest.fn().mockResolvedValue('PONG'),
    getClient: jest.fn(),
  })),
}));

beforeEach(() => {
  jest.clearAllMocks();
});