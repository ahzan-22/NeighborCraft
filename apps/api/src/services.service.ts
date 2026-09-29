import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import type { Prisma } from '@prisma/client';

export const PRICE_TYPES = ['FIXED', 'HOURLY', 'ESTIMATE'] as const;
export type PriceType = (typeof PRICE_TYPES)[number];
export interface Actor { sub: string; role: string; }
type ServiceWithReviews = Prisma.ServiceGetPayload<{ include: { user: { select: { id: true; name: true; email: true; role: true } }; reviews: { include: { user: { select: { id: true; name: true } } } } } }>;

export interface CreateServiceDto {
  name: string;
  skill: string;
  location: string;
  address?: string;
  phone: string;
  description?: string;
  price?: number | string | null;
  userId: string;
  category?: string;
  priceType?: string;
  isAvailable?: boolean;
  portfolioUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface AdminUpdateServiceDto {
  name?: string;
  skill?: string;
  location?: string;
  address?: string;
  phone?: string;
  description?: string;
  price?: number | string | null;
  isVerified?: boolean;
  isDeleted?: boolean;
  category?: string;
  priceType?: string;
  isAvailable?: boolean;
  portfolioUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  assertCanMutate(serviceUserId: string, actor: Actor): void {
    if (actor.role === 'ADMIN' || serviceUserId === actor.sub) return;
    throw new ForbiddenException('Anda bukan pemilik jasa ini');
  }

  parsePriceType(v: unknown): string | undefined {
    if (v === undefined) return undefined;
    if (typeof v !== 'string' || !((PRICE_TYPES as readonly string[]).includes(v))) {
      throw new BadRequestException('priceType harus FIXED, HOURLY, atau ESTIMATE');
    }
    return v;
  }

  private parseCoordinate(v: number | null | undefined, field: string): number | null | undefined {
    if (v === undefined) return undefined;
    if (v === null) return null;
    if (typeof v !== 'number') {
      throw new BadRequestException(`${field} harus number atau null`);
    }
    return v;
  }

  private withRating(service: ServiceWithReviews) {
    const reviews: { rating: number }[] = service.reviews ?? [];
    const reviewCount = reviews.length;
    const avgRating =
      reviewCount === 0
        ? 0
        : Math.round(
            (reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount) * 10,
          ) / 10;
    return { ...service, avgRating, reviewCount };
  }

  async getAllServices(includeDeleted = false) {
    const data = await this.prisma.service.findMany({
      where: includeDeleted ? undefined : { isDeleted: false },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        reviews: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return data.map((s) => this.withRating(s));
  }

  async getServiceById(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        reviews: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!service) {
      throw new NotFoundException(`Service dengan id ${id} tidak ditemukan`);
    }
    return this.withRating(service);
  }

  async createService(data: CreateServiceDto) {
    const { name, skill, location, phone, userId } = data;
    if (!name || !skill || !location || !phone || !userId) {
      throw new BadRequestException(
        'name, skill, location, phone, userId wajib diisi',
      );
    }
    const price =
      data.price === undefined || data.price === null || data.price === ''
        ? undefined
        : Number(data.price);
    if (price !== undefined && (!Number.isInteger(price) || price < 0)) {
      throw new BadRequestException('price harus bilangan bulat >= 0');
    }
    const priceType = this.parsePriceType(data.priceType);
    const latitude = this.parseCoordinate(data.latitude, 'latitude');
    const longitude = this.parseCoordinate(data.longitude, 'longitude');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User dengan id ${userId} tidak ditemukan`);
    }
    const created = await this.prisma.service.create({
      data: {
        name,
        skill,
        location,
        address: data.address ?? '',
        phone,
        description: data.description ?? '',
        price,
        userId,
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(priceType !== undefined ? { priceType } : {}),
        ...(data.isAvailable !== undefined
          ? { isAvailable: Boolean(data.isAvailable) }
          : {}),
        ...(data.portfolioUrl !== undefined
          ? { portfolioUrl: data.portfolioUrl }
          : {}),
        ...(latitude !== undefined ? { latitude } : {}),
        ...(longitude !== undefined ? { longitude } : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        reviews: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });
    return this.withRating(created);
  }

  async updateServiceAdmin(id: string, data: AdminUpdateServiceDto, actor: Actor) {
    const existing = await this.prisma.service.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Service dengan id ${id} tidak ditemukan`);
    }
    this.assertCanMutate(existing.userId, actor);

    const price =
      data.price === undefined
        ? undefined
        : data.price === null || data.price === ''
          ? null
          : Number(data.price);
    if (
      price !== undefined &&
      price !== null &&
      (!Number.isInteger(price) || price < 0)
    ) {
      throw new BadRequestException('price harus bilangan bulat >= 0');
    }
    const priceType = this.parsePriceType(data.priceType);
    const latitude = this.parseCoordinate(data.latitude, 'latitude');
    const longitude = this.parseCoordinate(data.longitude, 'longitude');

    const updated = await this.prisma.service.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.skill !== undefined ? { skill: data.skill } : {}),
        ...(data.location !== undefined ? { location: data.location } : {}),
        ...(data.address !== undefined ? { address: data.address } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(price !== undefined ? { price } : {}),
        ...(data.isVerified !== undefined
          ? { isVerified: Boolean(data.isVerified) }
          : {}),
        ...(data.isDeleted !== undefined
          ? { isDeleted: Boolean(data.isDeleted) }
          : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(priceType !== undefined ? { priceType } : {}),
        ...(data.isAvailable !== undefined
          ? { isAvailable: Boolean(data.isAvailable) }
          : {}),
        ...(data.portfolioUrl !== undefined
          ? { portfolioUrl: data.portfolioUrl }
          : {}),
        ...(latitude !== undefined ? { latitude } : {}),
        ...(longitude !== undefined ? { longitude } : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        reviews: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    return this.withRating(updated);
  }

  async verifyService(id: string) {
    const existing = await this.prisma.service.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Service dengan id ${id} tidak ditemukan`);
    }
    return this.prisma.service.update({
      where: { id },
      data: { isVerified: true },
    });
  }

  async deleteService(id: string, actor: Actor) {
    const existing = await this.prisma.service.findUnique({
      where: { id },
      include: {
        _count: {
          select: { orders: true, reviews: true },
        },
      },
    });
    if (!existing) {
      throw new NotFoundException(`Service dengan id ${id} tidak ditemukan`);
    }
    this.assertCanMutate(existing.userId, actor);

    // Jika terdapat relasi ke Order atau Review, gunakan Soft Delete
    if (existing._count.orders > 0 || existing._count.reviews > 0) {
      const updated = await this.prisma.service.update({
        where: { id },
        data: { isDeleted: true },
      });
      return {
        message:
          'Jasa berhasil dinonaktifkan (soft delete) karena memiliki riwayat pesanan/ulasan',
        service: updated,
        softDeleted: true,
      };
    }

    const deleted = await this.prisma.service.delete({ where: { id } });
    return {
      message: 'Jasa berhasil dihapus permanen',
      service: deleted,
      softDeleted: false,
    };
  }
}
