import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
  Patch,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ServicesService } from './services.service.js';
import type {
  CreateServiceDto,
  AdminUpdateServiceDto,
} from './services.service.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import type { JwtPayload } from './auth/jwt-auth.guard.js';

@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  getAll(@Query('all') all?: string) {
    return this.servicesService.getAllServices(all === 'true');
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.servicesService.getServiceById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Body() body: CreateServiceDto,
    @Req() req: { user: JwtPayload },
  ) {
    const { userId: _userId, ...rest } = body;
    void _userId;
    return this.servicesService.createService({ ...rest, userId: req.user.sub });
  }

  @Patch(':id/admin')
  @UseGuards(JwtAuthGuard)
  updateAdmin(
    @Param('id') id: string,
    @Body() body: AdminUpdateServiceDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.servicesService.updateServiceAdmin(id, body, {
      sub: req.user.sub,
      role: req.user.role,
    });
  }

  @Patch(':id/verify')
  verify(@Param('id') id: string) {
    return this.servicesService.verifyService(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  delete(@Param('id') id: string, @Req() req: { user: JwtPayload }) {
    return this.servicesService.deleteService(id, {
      sub: req.user.sub,
      role: req.user.role,
    });
  }
}
