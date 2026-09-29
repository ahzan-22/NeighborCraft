import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

export interface CreateReviewDto {
  rating: number;
  comment?: string;
  serviceId: string;
  userId: string;
  orderId: string;
}

export function assertRating(rating: number): void {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new BadRequestException('Rating harus bilangan bulat 1-5');
  }
}

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async createReview(data: CreateReviewDto) {
    const { rating, serviceId, userId, orderId } = data;

    assertRating(rating);
    if (!serviceId || !userId || !orderId) {
      throw new BadRequestException('serviceId, userId, dan orderId wajib diisi');
    }

    const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) {
      throw new NotFoundException(`Service dengan id ${serviceId} tidak ditemukan`);
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User dengan id ${userId} tidak ditemukan`);
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException(`Order dengan id ${orderId} tidak ditemukan`);
    }
    if (order.id !== orderId || order.serviceId !== serviceId || order.userId !== userId) {
      throw new BadRequestException(
        'Ulasan harus merujuk pada pesanan milik Anda untuk jasa ini'
      );
    }
    if (order.status !== 'COMPLETED') {
      throw new BadRequestException(
        'Anda harus menggunakan dan menyelesaikan jasa ini terlebih dahulu sebelum memberikan ulasan'
      );
    }

    const existingReview = await this.prisma.review.findFirst({
      where: { orderId: order.id },
    });
    if (existingReview) {
      throw new BadRequestException('Anda sudah memberikan ulasan untuk order ini');
    }

    try {
      const review = await this.prisma.review.create({
        data: {
          rating,
          comment: data.comment ?? '',
          serviceId,
          userId,
          orderId: order.id,
        },
        include: { user: { select: { id: true, name: true } } },
      });

      try {
        await this.prisma.notification.create({
          data: {
            userId: service.userId,
            title: 'Ulasan baru',
            message: `Ulasan baru (rating ${rating}) untuk jasa ${service.name}.`,
            type: 'REVIEW',
          },
        });
      } catch {
        // best-effort: jangan gagalkan review
      }

      return review;
    } catch (err: unknown) {
      // Race condition: user klik 2x cepat -> orderId unik melanggar (P2002).
      // Ubah error 500 mentah menjadi 400 yang ramah.
      if ((err as { code?: string })?.code === 'P2002') {
        throw new BadRequestException('Anda sudah memberikan ulasan untuk order ini');
      }
      throw err;
    }
  }

  async getByService(serviceId: string) {
    return this.prisma.review.findMany({
      where: { serviceId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
