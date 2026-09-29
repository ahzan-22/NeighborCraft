import { Controller, Post, Body, Param, Patch, Get, UseGuards, Req } from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import type { CreateOrderInput } from './orders.service.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import type { JwtPayload } from './auth/jwt-auth.guard.js';

export interface CreateOrderDto {
  serviceId: string;
  userId: string;
}

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll() {
    return this.ordersService.findAll();
  }

  @Get('provider')
  @UseGuards(JwtAuthGuard)
  byProvider(@Req() req: { user: JwtPayload }) {
    return this.ordersService.findByProvider(req.user.sub);
  }

  @Post()
  create(@Body() body: CreateOrderInput) {
    return this.ordersService.createOrder(body);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string; cancelReason?: string },
    @Req() req: { user: JwtPayload },
  ) {
    return this.ordersService.updateStatus(id, body.status, { sub: req.user.sub, role: req.user.role }, body.cancelReason);
  }

  @Get('user/:userId')
  byUser(@Param('userId') userId: string) {
    return this.ordersService.findByUser(userId);
  }

  @Get('service/:serviceId')
  byService(@Param('serviceId') serviceId: string) {
    return this.ordersService.findByService(serviceId);
  }
}
