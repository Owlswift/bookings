import { IsInt, IsPositive, IsOptional, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class FindAllBookingsDto {
  @IsIn(['upcoming', 'past'])
  @IsOptional()
  type?: 'upcoming' | 'past';

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsOptional()
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsOptional()
  limit: number = 10;
}

export class IdParamDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  id: number;
}
