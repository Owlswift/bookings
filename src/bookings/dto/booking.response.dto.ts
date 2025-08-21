import { ServiceType } from '@prisma/client';
import { Expose } from 'class-transformer';

export class BookingResponseDto {
  @Expose()
  id: number;

  @Expose()
  userId: number;

  @Expose()
  serviceType: ServiceType;

  @Expose()
  startTime: Date;

  @Expose()
  endTime: Date;

  @Expose()
  status: string;
}
