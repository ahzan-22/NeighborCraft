import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service.js';

export interface JwtPayload { sub: string; email: string; role: string; }

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined>; user?: JwtPayload }>();
    const header = req.headers['authorization'] ?? req.headers['Authorization'];
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Token tidak ditemukan');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(header.slice(7));
    } catch {
      throw new UnauthorizedException('Token tidak valid');
    }

    // Klaim role di token bisa basi (umur 7 hari): admin yang di-demote atau
    // warga yang di-ban harus langsung kehilangan akses, jadi role & isBanned
    // selalu diambil ulang dari database, bukan dipercaya dari token.
    const fresh = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, isBanned: true },
    });
    if (!fresh) throw new UnauthorizedException('Akun tidak ditemukan');
    if (fresh.isBanned) {
      throw new UnauthorizedException('Akun Anda telah dinonaktifkan/diblokir oleh Admin');
    }

    req.user = { sub: fresh.id, email: fresh.email, role: fresh.role };
    return true;
  }
}
