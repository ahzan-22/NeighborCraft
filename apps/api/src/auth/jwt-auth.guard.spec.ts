import { describe, it, expect } from 'vitest';
import { JwtAuthGuard } from './jwt-auth.guard.js';

describe('JwtAuthGuard', () => {
  it('menolak request tanpa Bearer token', async () => {
    const guard = new JwtAuthGuard({ verifyAsync: async () => { throw new Error('invalid'); } } as never);
    await expect(guard.canActivate({ switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }) } as never)).rejects.toThrow();
  });
});
