import { Controller, Post, Body } from '@nestjs/common';
import { AuthService, Role } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(
    @Body() body: { name: string; email: string; password: string; role?: Role },
  ) {
    return this.authService.register(body);
  }

  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body);
  }
}
