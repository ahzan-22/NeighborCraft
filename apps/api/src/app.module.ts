import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaService } from './prisma.service.js';
import { ServicesController } from './services.controller.js';
import { ServicesService } from './services.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { ReviewsController } from './reviews.controller.js';
import { ReviewsService } from './reviews.service.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { ContactsController } from './contacts.controller.js';
import { ContactsService } from './contacts.service.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';

function resolveJwtSecret(): string {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET wajib di-set pada production');
  }
  return 'neighborcraft-dev-secret';
}

@Module({
  imports: [JwtModule.register({ secret: resolveJwtSecret(), signOptions: { expiresIn: '7d' } })],
  controllers: [AppController, ServicesController, AuthController, ReviewsController, OrdersController, UsersController, ContactsController, NotificationsController],
  providers: [AppService, PrismaService, ServicesService, AuthService, ReviewsService, OrdersService, UsersService, ContactsService, NotificationsService, JwtAuthGuard],
})
export class AppModule {}
