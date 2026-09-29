import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface JwtPayload { sub: string; email: string; role: string; }

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: JwtPayload }>();
    const header = req.headers['authorization'] ?? req.headers['Authorization'];
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Token tidak ditemukan');
    try {
      req.user = await this.jwt.verifyAsync<JwtPayload>(header.slice(7));
      return true;
    } catch {
      throw new UnauthorizedException('Token tidak valid');
    }
  }
}
