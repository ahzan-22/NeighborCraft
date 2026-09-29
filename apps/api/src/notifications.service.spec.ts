import { describe, it, expect } from 'vitest';
import { buildOrderStatusMessage } from './notifications.service.js';

describe('notifikasi', () => {
  it('membuat judul status yang benar', () => {
    expect(buildOrderStatusMessage('CONFIRMED').title).toContain('CONFIRMED');
  });
});
