import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { Redis as RedisClient } from 'ioredis';
import { Observable } from 'rxjs';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private pubClient: RedisClient;
  private subClient: RedisClient;
  private _isConnected = false;

  constructor(private readonly configService: ConfigService) {}

  get isConnected(): boolean {
    return this._isConnected;
  }

  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      throw new Error('REDIS_URL is not defined in environment variables');
    }

    this.pubClient = new Redis(redisUrl);
    this.subClient = new Redis(redisUrl);

    const handleConnect = () => {
      this._isConnected = true;
    };

    this.pubClient.on('connect', handleConnect);
    this.subClient.on('connect', handleConnect);

    this.pubClient.on('error', (err) => {
      this._isConnected = false;
      console.error('[RedisService] Publisher error:', err);
    });

    this.subClient.on('error', (err) => {
      this._isConnected = false;
      console.error('[RedisService] Subscriber error:', err);
    });
  }

  onModuleDestroy() {
    this.pubClient?.disconnect();
    this.subClient?.disconnect();
  }

  publish(channel: string, message: string) {
    if (!this._isConnected) {
      throw new Error('Redis is not connected. Cannot publish message.');
    }
    this.logger.debug(`Publishing to ${channel}: ${message}`);
    return this.pubClient.publish(channel, message);
  }

  subscribe(channel: string): Observable<string> {
    return new Observable((subscriber) => {
      if (!this._isConnected) {
        subscriber.error(
          new Error('Redis is not connected. Cannot subscribe.'),
        );
        return;
      }

      this.subClient.subscribe(channel, (err) => {
        if (err) {
          subscriber.error(err);
        }
      });

      const messageHandler = (ch: string, message: string) => {
        this.logger.debug(`Received from ${channel}: ${message}`);
        if (ch === channel) {
          subscriber.next(message);
        }
      };

      this.subClient.on('message', messageHandler);

      return () => {
        this.subClient.off('message', messageHandler);
        this.subClient.unsubscribe(channel);
      };
    });
  }

  async ping(): Promise<string> {
    if (!this._isConnected) {
      throw new Error('Redis not connected');
    }
    return this.pubClient.ping();
  }
}
