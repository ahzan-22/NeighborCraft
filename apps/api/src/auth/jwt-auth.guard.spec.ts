import { describe, it, expect } from 'vitest';
import { JwtAuthGuard } from './jwt-auth.guard.js';

function makeCtx(headers: Record<string, string | undefined>) {
  return { switchToHttp: () => ({ getRequest: () => ({ headers }) }) } as never;
}

const prismaOk = {
  user: {
    findUnique: async () => ({ id: 'u1', email: 'a@b.c', role: 'WARGA', isBanned: false }),
  },
};

describe('JwtAuthGuard', () => {
  it('menolak request tanpa Bearer token', async () => {
    const guard = new JwtAuthGuard({ verifyAsync: async () => ({}) } as never, prismaOk as never);
    await expect(guard.canActivate(makeCtx({}))).rejects.toThrow();
  });

  it('menolak token tidak valid', async () => {
    const guard = new JwtAuthGuard(
      { verifyAsync: async () => { throw new Error('invalid'); } } as never,
      prismaOk as never,
    );
    await expect(guard.canActivate(makeCtx({ authorization: 'Bearer abc' }))).rejects.toThrow();
  });

  it('menolak akun yang sudah dihapus', async () => {
    const prisma = { user: { findUnique: async () => null } };
    const guard = new JwtAuthGuard(
      { verifyAsync: async () => ({ sub: 'u1' }) } as never,
      prisma as never,
    );
    await expect(guard.canActivate(makeCtx({ authorization: 'Bearer abc' }))).rejects.toThrow();
  });

  it('menolak akun yang diblokir walau token masih valid', async () => {
    const prisma = {
      user: {
        findUnique: async () => ({ id: 'u1', email: 'a@b.c', role: 'WARGA', isBanned: true }),
      },
    };
    const guard = new JwtAuthGuard(
      { verifyAsync: async () => ({ sub: 'u1' }) } as never,
      prisma as never,
    );
    await expect(guard.canActivate(makeCtx({ authorization: 'Bearer abc' }))).rejects.toThrow();
  });

  it('memakai role terbaru dari DB, bukan klaim token yang basi', async () => {
    const prisma = {
      user: {
        findUnique: async () => ({ id: 'u1', email: 'a@b.c', role: 'WARGA', isBanned: false }),
      },
    };
    const guard = new JwtAuthGuard(
      // Token masih mengklaim ADMIN, padahal DB sudah menurunkannya ke WARGA.
      { verifyAsync: async () => ({ sub: 'u1', email: 'a@b.c', role: 'ADMIN' }) } as never,
      prisma as never,
    );
    const req = { headers: { authorization: 'Bearer abc' }, user: undefined as { sub: string; email: string; role: string } | undefined };
    await guard.canActivate({ switchToHttp: () => ({ getRequest: () => req }) } as never);
    expect(req.user?.role).toBe('WARGA');
  });
});
