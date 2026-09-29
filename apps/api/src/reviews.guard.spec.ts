import { describe, it, expect } from 'vitest';
import { assertRating } from './reviews.service.js';

describe('rating', () => {
  it('rating 0 ditolak', () => {
    expect(() => assertRating(0)).toThrow();
  });
  it('rating 5 diterima', () => {
    expect(() => assertRating(5)).not.toThrow();
  });
  it('rating 6 dan non-integer ditolak', () => {
    expect(() => assertRating(6)).toThrow();
    expect(() => assertRating(4.5)).toThrow();
  });
});
