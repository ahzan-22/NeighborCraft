import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service.js';

function makePrisma(service: { isAvailable: boolean; isDeleted?: boolean }) {
  const created: unknown[] = [];
  const prisma = {
    service: {
      findUnique: async () => ({
        id: 'svc1',
        name: 'Jasa Sulap',
        userId: 'pemilik',
        isAvailable: service.isAvailable,
        isDeleted: service.isDeleted ?? false,
      }),
    },
    order: {
      create: async (args: unknown) => {
        created.push(args);
        return { id: 'o1' };
      },
    },
    notification: {
      create: async () => ({ id: 'n1' }),
    },
  };
  return { prisma, created };
}

const PESANAN = {
  serviceId: 'svc1',
  userId: 'pemesan',
  deliveryAddress: 'Jl. Mawar No. 1',
  customerPhone: '08123456789',
};

describe('createOrder vs status tutup sementara', () => {
  it('menolak pesanan untuk jasa yang sedang tutup sementara', async () => {
    const { prisma, created } = makePrisma({ isAvailable: false });
    const svc = new OrdersService(prisma as never);

    await expect(svc.createOrder(PESANAN)).rejects.toThrow(BadRequestException);
    expect(created).toHaveLength(0);
  });

  it('menolak pesanan dengan pesan yang menyebut tutup sementara', async () => {
    const { prisma } = makePrisma({ isAvailable: false });
    const svc = new OrdersService(prisma as never);

    await expect(svc.createOrder(PESANAN)).rejects.toThrow(/tutup sementara/i);
  });

  it('tetap membuat pesanan untuk jasa yang buka', async () => {
    const { prisma, created } = makePrisma({ isAvailable: true });
    const svc = new OrdersService(prisma as never);

    await expect(svc.createOrder(PESANAN)).resolves.toEqual({ id: 'o1' });
    expect(created).toHaveLength(1);
  });

  it('tetap menolak jasa yang dihapus walau isAvailable masih true', async () => {
    const { prisma, created } = makePrisma({ isAvailable: true, isDeleted: true });
    const svc = new OrdersService(prisma as never);

    await expect(svc.createOrder(PESANAN)).rejects.toThrow(BadRequestException);
    expect(created).toHaveLength(0);
  });
});
