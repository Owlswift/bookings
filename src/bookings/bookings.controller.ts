import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { FindAllBookingsDto } from './dto/find-bookings.dto';
import { User } from 'src/common/decorators/user.decorator';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @Roles('USER')
  @UseGuards(JwtAuthGuard, RolesGuard)
  create(
    @Body() createBookingDto: CreateBookingDto,
    @User() user: { userId: number },
  ) {
    return this.bookingsService.create(createBookingDto, user.userId);
  }

  @Get(':id')
  @Roles('ADMIN', 'PROVIDER', 'USER')
  @UseGuards(JwtAuthGuard, RolesGuard)
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @User() user: { userId: number; roles },
  ) {
    return this.bookingsService.findOne(id, user);
  }

  @Get()
  @Roles('ADMIN', 'PROVIDER', 'USER')
  @UseGuards(JwtAuthGuard, RolesGuard)
  findAll(
    @Query() query: FindAllBookingsDto,
    @User() user: { userId: number; roles; email },
  ) {
    return this.bookingsService.findAll(
      query.type,
      query.page,
      query.limit,
      user,
    );
  }
}
