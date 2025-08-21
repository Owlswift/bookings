import { IsInt, IsEnum, IsISO8601 } from 'class-validator';
import { ServiceType } from '@prisma/client';

export class CreateBookingDto {
  @IsInt()
  providerId: number;

  @IsEnum(ServiceType)
  serviceType: ServiceType;

  @IsISO8601()
  startTime: string;

  @IsISO8601()
  endTime: string;
}
