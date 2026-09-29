import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService, type UpdateUserDto } from './users.service.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import type { JwtPayload } from './auth/jwt-auth.guard.js';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private assertAdmin(req: { user: JwtPayload }): void {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Hanya admin yang dapat mengakses data warga');
    }
  }

  private assertSelfOrAdmin(id: string, req: { user: JwtPayload }): void {
    if (req.user.role !== 'ADMIN' && req.user.sub !== id) {
      throw new ForbiddenException('Hanya pemilik akun atau admin yang dapat mengakses');
    }
  }

  @Get()
  findAll(@Req() req: { user: JwtPayload }) {
    this.assertAdmin(req);
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: { user: JwtPayload }) {
    this.assertSelfOrAdmin(id, req);
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
    @Req() req: { user: JwtPayload },
  ) {
    this.assertAdmin(req);
    return this.usersService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: { user: JwtPayload }) {
    this.assertAdmin(req);
    return this.usersService.remove(id);
  }
}
