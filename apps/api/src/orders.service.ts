import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { mapsLink, waLink } from './common/links.js';

export const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface OrderActor {
  sub: string;
  role: string;
}

export interface CreateOrderInput {
  serviceId: string;
  userId: string;
  deliveryAddress: string;
  customerPhone: string;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
}

const TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
};

export function isValidTransition(from: string, to: string): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async createOrder(data: CreateOrderInput) {
    const { serviceId, userId, deliveryAddress, customerPhone, latitude, longitude, notes } = data;

    if (!serviceId || !userId || !deliveryAddress || !customerPhone) {
      throw new BadRequestException('serviceId, userId, deliveryAddress, dan customerPhone wajib diisi');
    }

    if (latitude !== undefined && latitude !== null && typeof latitude !== 'number') {
      throw new BadRequestException('latitude harus number atau null');
    }
    if (longitude !== undefined && longitude !== null && typeof longitude !== 'number') {
      throw new BadRequestException('longitude harus number atau null');
    }

    const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) {
      throw new NotFoundException(`Service dengan id ${serviceId} tidak ditemukan`);
    }
    if (service.isDeleted) {
      throw new BadRequestException('Service sudah dihapus');
    }
    if (!service.isAvailable) {
      throw new BadRequestException('Jasa sedang tutup sementara, belum bisa dipesan');
    }

    const order = await this.prisma.order.create({
      data: {
        serviceId,
        userId,
        status: 'PENDING',
        deliveryAddress,
        customerPhone,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        notes: notes ?? null,
      },
      include: { service: true, user: { select: { id: true, name: true } }, review: true },
    });

    try {
      await this.prisma.notification.create({
        data: {
          userId: service.userId,
          title: 'Pesanan baru',
          message: `Pesanan ${order.id} untuk jasa ${service.name}.`,
          type: 'ORDER_CREATED',
        },
      });
    } catch {
      // best-effort: jangan gagalkan order
    }

    return order;
  }

  async updateStatus(id: string, status: string, actor: OrderActor, cancelReason?: string) {
    if (!(ORDER_STATUSES as readonly string[]).includes(status)) {
      throw new BadRequestException(`Status tidak valid. Pilih dari: ${ORDER_STATUSES.join(', ')}`);
    }

    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { service: true },
    });
    if (!order) {
      throw new NotFoundException(`Order dengan id ${id} tidak ditemukan`);
    }

    if (actor.role !== 'ADMIN' && order.service.userId !== actor.sub && order.userId !== actor.sub) {
      throw new ForbiddenException('Tidak berhak mengubah status pesanan ini');
    }

    if (!isValidTransition(order.status, status)) {
      throw new BadRequestException(`Transisi ${order.status} -> ${status} tidak diizinkan`);
    }

    if (status === 'CANCELLED' && !cancelReason) {
      throw new BadRequestException('cancelReason wajib diisi untuk CANCELLED');
    }

    const data: { status: string; cancelReason?: string | null; completedAt?: Date | null } = { status };
    if (status === 'COMPLETED') {
      data.completedAt = new Date();
    } else if (status === 'CANCELLED') {
      data.completedAt = null;
      data.cancelReason = cancelReason ?? null;
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data,
      include: { service: true, user: { select: { id: true, name: true } }, review: true },
    });

    const message = `Pesanan ${id} kini ${status}.`;
    const targets: string[] = [];
    if (actor.role === 'ADMIN') {
      targets.push(order.userId, order.service.userId);
    } else if (actor.sub === order.service.userId) {
      targets.push(order.userId);
    } else {
      targets.push(order.service.userId);
    }
    for (const userId of targets) {
      try {
        await this.prisma.notification.create({
          data: { userId, title: 'Status pesanan', message, type: 'ORDER_STATUS' },
        });
      } catch {
        // best-effort
      }
    }

    const isCustomerActor = actor.sub === order.userId;
    const phone = isCustomerActor ? order.service.phone : order.customerPhone;
    return {
      order: updated,
      waLink: waLink(phone, message),
      mapsLink: mapsLink(updated.latitude, updated.longitude, updated.deliveryAddress),
    };
  }

  async findByProvider(providerId: string) {
    return this.prisma.order.findMany({
      where: { service: { userId: providerId } },
      include: { service: true, user: { select: { id: true, name: true } }, review: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll() {
    return this.prisma.order.findMany({
      include: {
        service: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByUser(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      // `review` perlu diikutkan agar UI bisa menandai "ulasan sudah dikirim"
      // tanpa request tambahan per order.
      include: {
        service: true,
        review: { select: { id: true, rating: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByService(serviceId: string) {
    return this.prisma.order.findMany({
      where: { serviceId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        review: { select: { id: true, rating: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
