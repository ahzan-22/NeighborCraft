import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

export interface UpdateUserDto {
  name?: string;
  email?: string;
  role?: 'ADMIN' | 'WARGA';
  isBanned?: boolean;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      include: {
        _count: {
          select: { services: true, orders: true, reviews: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return users.map(({ password: _password, ...rest }) => rest);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: { services: true, orders: true, reviews: true },
        },
      },
    });
    if (!user) {
      throw new NotFoundException(`User dengan id ${id} tidak ditemukan`);
    }
    const { password: _password, ...rest } = user;
    return rest;
  }

  async update(id: string, data: UpdateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`User dengan id ${id} tidak ditemukan`);
    }

    // Proteksi: admin tidak bisa diubah role/banned via API ini (hanya via seed/script manual)
    if (existing.role === 'ADMIN') {
      throw new BadRequestException('Akun admin tidak dapat diubah melalui API ini');
    }

    if (data.email && data.email !== existing.email) {
      const emailTaken = await this.prisma.user.findUnique({
        where: { email: data.email },
      });
      if (emailTaken) {
        throw new ConflictException('Email sudah digunakan oleh user lain');
      }
    }

    if (data.role && data.role !== 'ADMIN' && data.role !== 'WARGA') {
      throw new BadRequestException('Role harus bernilai ADMIN atau WARGA');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.role !== undefined ? { role: data.role } : {}),
        ...(data.isBanned !== undefined ? { isBanned: Boolean(data.isBanned) } : {}),
      },
      include: {
        _count: {
          select: { services: true, orders: true, reviews: true },
        },
      },
    });

    const { password: _password, ...safeUser } = updated;
    return {
      message: 'Data user berhasil diperbarui',
      user: safeUser,
    };
  }

  async remove(id: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`User dengan id ${id} tidak ditemukan`);
    }

    // Proteksi: admin tidak bisa dihapus via API
    if (existing.role === 'ADMIN') {
      throw new BadRequestException('Akun admin tidak dapat dihapus melalui API ini');
    }

    // Hard Delete permanen: bersihkan relasi yang bersifat restrict
    // (Order.user, Order.service, Review.order tidak memakai onDelete: Cascade)
    // agar `prisma.user.delete` tidak gagal FK. Tanpa soft delete / flag apapun.
    const userServices = await this.prisma.service.findMany({
      where: { userId: id },
      select: { id: true },
    });
    const serviceIds = userServices.map((s) => s.id);

    const relatedOrders = await this.prisma.order.findMany({
      where: {
        OR: [
          { userId: id },
          ...(serviceIds.length > 0 ? [{ serviceId: { in: serviceIds } }] : []),
        ],
      },
      select: { id: true },
    });
    const orderIds = relatedOrders.map((o) => o.id);

    await this.prisma.$transaction([
      this.prisma.notification.deleteMany({ where: { userId: id } }),
      // 1. Hapus review yang menempel pada order-order terkait (FK Review.order restrict)
      ...(orderIds.length > 0
        ? [this.prisma.review.deleteMany({ where: { orderId: { in: orderIds } } })]
        : []),
      // 2. Hapus review milik user / review pada jasa milik user (sisa yang belum terhapus)
      this.prisma.review.deleteMany({ where: { userId: id } }),
      ...(serviceIds.length > 0
        ? [this.prisma.review.deleteMany({ where: { serviceId: { in: serviceIds } } })]
        : []),
      // 3. Hapus order milik user / order pada jasa milik user (FK Order restrict)
      this.prisma.order.deleteMany({ where: { userId: id } }),
      ...(serviceIds.length > 0
        ? [this.prisma.order.deleteMany({ where: { serviceId: { in: serviceIds } } })]
        : []),
      // 4. Hapus jasa milik user
      this.prisma.service.deleteMany({ where: { userId: id } }),
      // 5. Hapus user secara permanen
      this.prisma.user.delete({ where: { id } }),
    ]);

    const { password: _password, ...safeUser } = existing;
    return {
      message: 'Akun warga berhasil dihapus permanen dari database',
      user: safeUser,
      softDeleted: false,
    };
  }
}
