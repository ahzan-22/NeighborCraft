import { describe, it, expect } from 'vitest';
import { ServicesService } from './services.service.js';
import { ForbiddenException } from '@nestjs/common';

describe('ownership jasa', () => {
  it('non-pemilik bukan admin ditolak', () => {
    const svc = new ServicesService({} as never);
    expect(() => (svc as unknown as { assertCanMutate: (a: string, b: { sub: string; role: string }) => void }).assertCanMutate('owner-1', { sub: 'orang-lain', role: 'WARGA' })).toThrow(ForbiddenException);
  });
  it('pemilik dan admin diizinkan', () => {
    const svc = new ServicesService({} as never);
    const fn = (svc as unknown as { assertCanMutate: (a: string, b: { sub: string; role: string }) => void }).assertCanMutate.bind(svc);
    expect(() => fn('owner-1', { sub: 'owner-1', role: 'WARGA' })).not.toThrow();
    expect(() => fn('owner-1', { sub: 'siapa-saja', role: 'ADMIN' })).not.toThrow();
  });
});
