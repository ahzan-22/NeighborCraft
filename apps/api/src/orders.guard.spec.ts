import { describe, it, expect } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { OrdersService } from './orders.service.js';

describe('orders guard', () => {
  it('updateStatus menolak aktor asing', async () => {
    const prisma = {
      order: {
        findUnique: async () => ({
          id: 'o1',
          userId: 'pemesan',
          status: 'PENDING',
          service: { userId: 'pemilik', phone: '08' },
          customerPhone: '08',
        }),
      },
    };
    const svc = new OrdersService(prisma as never);
    await expect(
      svc.updateStatus('o1', 'CONFIRMED', { sub: 'orang-asing', role: 'WARGA' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('findByProvider hanya mengembalikan milik provider', async () => {
    const prisma = {
      order: {
        findMany: async (args: { where: { service: { userId: string } } }) =>
          args.where.service.userId === 'p1' ? [{ id: 'o1' }] : [],
      },
    };
    const svc = new OrdersService(prisma as never);
    const rows = await svc.findByProvider('p1');
    expect(rows).toEqual([{ id: 'o1' }]);
  });
});
