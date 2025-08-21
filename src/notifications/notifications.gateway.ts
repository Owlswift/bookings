import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Booking } from 'src/bookings/entities/booking.entity';
import { NotificationsService } from './notifications.service';
import { AuthService } from 'src/auth/auth.service';

@WebSocketGateway({
  namespace: 'bookings',
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) {}

  afterInit() {
    this.logger.log('Bookings WebSocket Gateway initialized');

    if (this.server) {
      this.notificationsService.setServer(this.server);
    } else {
      this.logger.warn('afterInit: server not available yet');
    }

    this.logger.log(`WebSocket server running`);
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.query.token as string;
      if (!token) {
        this.logger.warn('No token provided. Disconnecting client.');
        client.emit('connection_error', { message: 'Token required' });
        return client.disconnect();
      }

      const cleanToken = token.trim();
      const payload = this.jwtService.verify(cleanToken, {
        algorithms: ['HS256'],
      });
      const isValid = await this.authService.validateToken(cleanToken);
      client.data.user = payload;

      const roles = Array.isArray(payload.roles)
        ? payload.roles.map((r) => r.toLowerCase())
        : [];

      if (roles.includes('admin')) {
        client.join('admin.bookings');
        this.logger.debug(`Admin joined bookings room: ${client.id}`);
      }

      this.logger.log(
        `Client connected: ${client.id}, User ID: ${payload.sub}`,
      );
      client.emit('connection_success', { status: 'authenticated' });
    } catch (error) {
      const err = error as Error;
      this.logger.warn(`Connection failed: ${err.message}`);
      client.emit('connection_error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Keep this method for in-process usage; delegate to NotificationsService
  handleBookingCreated(booking: Booking) {
    this.notificationsService.notifyBookingCreated(booking);
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket) {
    client.emit('pong', { timestamp: Date.now() });
  }
}
