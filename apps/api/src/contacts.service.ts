import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

export interface CreateContactDto {
  name: string;
  email?: string;
  subject?: string;
  message: string;
}

export interface UpdateContactDto {
  status?: string;
  subject?: string;
  message?: string;
}

const VALID_STATUSES = ['BARU', 'DIBACA', 'SELESAI'];

@Injectable()
export class ContactsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.contactMessage.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.contactMessage.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Pesan dengan id ${id} tidak ditemukan`);
    }
    return item;
  }

  async create(data: CreateContactDto) {
    const { name, message } = data;
    if (!name || !message) {
      throw new BadRequestException('Nama dan pesan wajib diisi');
    }
    return this.prisma.contactMessage.create({
      data: {
        name,
        email: data.email ?? '',
        subject: data.subject ?? '',
        message,
        status: 'BARU',
      },
    });
  }

  async update(id: string, data: UpdateContactDto) {
    const existing = await this.prisma.contactMessage.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Pesan dengan id ${id} tidak ditemukan`);
    }
    if (data.status !== undefined && !VALID_STATUSES.includes(data.status)) {
      throw new BadRequestException(
        `Status tidak valid. Pilih dari: ${VALID_STATUSES.join(', ')}`,
      );
    }
    return this.prisma.contactMessage.update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.subject !== undefined ? { subject: data.subject } : {}),
        ...(data.message !== undefined ? { message: data.message } : {}),
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.contactMessage.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Pesan dengan id ${id} tidak ditemukan`);
    }
    return this.prisma.contactMessage.delete({ where: { id } });
  }
}
