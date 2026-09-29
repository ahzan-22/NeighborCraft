import { describe, it, expect } from 'vitest';
import { isValidTransition } from './orders.service.js';

describe('transisi status', () => {
  it('PENDING -> IN_PROGRESS langsung ditolak', () => {
    expect(isValidTransition('PENDING', 'IN_PROGRESS')).toBe(false);
  });
  it('PENDING -> CONFIRMED diterima', () => {
    expect(isValidTransition('PENDING', 'CONFIRMED')).toBe(true);
  });
  it('IN_PROGRESS -> COMPLETED diterima, COMPLETED -> apa pun ditolak', () => {
    expect(isValidTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
    expect(isValidTransition('COMPLETED', 'CANCELLED')).toBe(false);
  });
});
