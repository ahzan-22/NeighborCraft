import { Controller, Get, Patch, Param, Query, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import type { JwtPayload } from './auth/jwt-auth.guard.js';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@Query('userId') userId: string, @Req() req: { user: JwtPayload }) {
    if (!userId) return this.notifications.listFor(req.user.sub);
    if (userId !== req.user.sub && req.user.role !== 'ADMIN') throw new ForbiddenException('Hanya notifikasi milik sendiri');
    return this.notifications.listFor(userId);
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard)
  markRead(@Param('id') id: string, @Req() req: { user: JwtPayload }) {
    return this.notifications.markRead(id, { sub: req.user.sub, role: req.user.role });
  }
}
