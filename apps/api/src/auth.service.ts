import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

export type Role = 'ADMIN' | 'WARGA';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(data: { name: string; email: string; password: string; role?: Role }) {
    const { name, email, password } = data;

    if (!name || !email || !password) {
      throw new BadRequestException('Nama, email, dan password wajib diisi');
    }
    if (password.length < 6) {
      throw new BadRequestException('Password minimal 6 karakter');
    }

    // Keamanan: abaikan role dari client, semua pendaftaran baru selalu WARGA.
    // Role ADMIN hanya boleh diubah via seed/script manual oleh admin.
    const normalizedRole: Role = 'WARGA';

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email sudah terdaftar');
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: { name, email, password: hashed, role: normalizedRole },
    });

    const { password: _, ...result } = user;
    const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role });
    return { message: 'Register berhasil', user: result, accessToken };
  }

  async login(data: { email: string; password: string }) {
    const { email, password } = data;

    if (!email || !password) {
      throw new BadRequestException('Email dan password wajib diisi');
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Akun tidak ditemukan');
    }

    if (user.isBanned) {
      throw new UnauthorizedException(
        'Akun Anda telah dinonaktifkan/diblokir oleh Admin',
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Email atau password salah');
    }

    const { password: _, ...safeUser } = user;
    const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role });
    return {
      message: 'Login berhasil',
      user: safeUser, // berisi id, name, email, role
      accessToken,
    };
  }
}
