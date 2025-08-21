import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'prisma/prisma.service';
import { SignupDto } from './dto/auth.dto';
import { JwtPayload } from './jwt-payload.type';
import { User } from '@prisma/client';

type SafeUser = Omit<User, 'password'>;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<SafeUser | null> {
    try {
      const user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) return null;

      const passwordValid = await bcrypt.compare(password, user.password);
      if (!passwordValid) return null;

      const { password: _, ...result } = user;
      return result;
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Error validating user: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to validate user');
    }
  }

  async login(user: SafeUser): Promise<{ access_token: string }> {
    try {
      const payload: JwtPayload = {
        email: user.email,
        sub: user.id,
        roles: [user.role],
      };

      return {
        access_token: this.jwtService.sign(payload),
      };
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Error logging in: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to login');
    }
  }

  async validateToken(token: string) {
    try {
      this.jwtService.verify(token, { algorithms: ['HS256'] });
    } catch (err) {
      const error = err as Error;
      this.logger.warn(`Invalid token: ${error.message}`);
      throw new UnauthorizedException('Invalid token');
    }
  }

  async register({ email, password, role }: SignupDto): Promise<SafeUser> {
    try {
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      });
      if (existingUser) {
        throw new ConflictException('Email already exists');
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          role,
        },
      });

      const { password: _, ...safeUser } = user;
      return safeUser;
    } catch (err) {
      const error = err as Error;
      this.logger.error(
        `Error registering user: ${error.message}`,
        error.stack,
      );
      if (err instanceof ConflictException) throw err;
      throw new InternalServerErrorException('Failed to register user');
    }
  }
}
