import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>(
      'roles',
      context.getHandler(),
    );
    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new ForbiddenException('Authorization header is missing');
    }

    const token = authHeader.split(' ')[1];
    let user;

    try {
      user = this.jwtService.verify(token, { algorithms: ['HS256'] });
    } catch (e) {
      throw new ForbiddenException('Invalid token');
    }

    if (!user || !user.roles) {
      throw new ForbiddenException('Invalid user permissions');
    }

    return requiredRoles.some((role) => user.roles.includes(role));
  }
}
