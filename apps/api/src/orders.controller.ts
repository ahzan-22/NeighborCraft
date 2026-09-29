import {
  Controller,
  Post,
  Body,
  Param,
  Patch,
  Get,
  UseGuards,
  Req,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import type { CreateOrderInput } from './orders.service.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import type { JwtPayload } from './auth/jwt-auth.guard.js';
import { PrismaService } from './prisma.service.js';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Req() req: { user: JwtPayload }) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Hanya admin yang dapat melihat semua pesanan');
    }
    return this.ordersService.findAll();
  }

  @Get('provider')
  @UseGuards(JwtAuthGuard)
  byProvider(@Req() req: { user: JwtPayload }) {
    return this.ordersService.findByProvider(req.user.sub);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() body: CreateOrderInput, @Req() req: { user: JwtPayload }) {
    // userId selalu dari JWT, abaikan nilai di body.
    return this.ordersService.createOrder({ ...body, userId: req.user.sub });
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
  @UseGuards(JwtAuthGuard)
  async byUser(@Param('userId') userId: string, @Req() req: { user: JwtPayload }) {
    if (req.user.role !== 'ADMIN' && req.user.sub !== userId) {
      throw new ForbiddenException('Hanya pemilik pesanan atau admin yang dapat melihat');
    }
    return this.ordersService.findByUser(userId);
  }

  @Get('service/:serviceId')
  @UseGuards(JwtAuthGuard)
  async byService(@Param('serviceId') serviceId: string, @Req() req: { user: JwtPayload }) {
    if (req.user.role !== 'ADMIN') {
      const service = await this.prisma.service.findUnique({
        where: { id: serviceId },
        select: { userId: true },
      });
      if (!service) {
        throw new NotFoundException(`Service dengan id ${serviceId} tidak ditemukan`);
      }
      if (service.userId !== req.user.sub) {
        throw new ForbiddenException('Hanya pemilik jasa atau admin yang dapat melihat');
      }
    }
    return this.ordersService.findByService(serviceId);
  }
}
