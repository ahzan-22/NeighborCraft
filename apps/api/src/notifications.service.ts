import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

export interface NotifyInput { userId: string; title: string; message: string; type?: string; }
export interface Actor { sub: string; role: string; }

export function buildOrderStatusMessage(status: string): { title: string; message: string } {
  return { title: `Pesanan ${status}`, message: `Status pesanan Anda berubah menjadi ${status}.` };
}

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}
  notify(input: NotifyInput) {
    return this.prisma.notification.create({
      data: { userId: input.userId, title: input.title, message: input.message, type: input.type ?? 'ORDER' },
    });
  }
  listFor(userId: string) {
    return this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }
  async markRead(id: string, actor: Actor) {
    const n = await this.prisma.notification.findUnique({ where: { id } });
    if (!n) throw new NotFoundException(`Notifikasi ${id} tidak ditemukan`);
    if (n.userId !== actor.sub && actor.role !== 'ADMIN') throw new ForbiddenException('Bukan notifikasi milik Anda');
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }
}
