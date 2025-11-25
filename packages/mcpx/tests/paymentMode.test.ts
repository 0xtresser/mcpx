import { describe, expect, it } from 'vitest';
import { resolvePaymentMode } from '../src/server/middleware.js';

describe('resolvePaymentMode', () => {
  it('defaults to payThenService when mode is undefined', () => {
    expect(resolvePaymentMode()).toBe('payThenService');
    expect(resolvePaymentMode({})).toBe('payThenService');
  });

  it('returns payBeforeService when explicitly requested', () => {
    expect(resolvePaymentMode({ mode: 'payBeforeService' })).toBe('payBeforeService');
  });

  it('falls back to payThenService for unknown values', () => {
    expect(resolvePaymentMode({ mode: 'payThenService' })).toBe('payThenService');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(resolvePaymentMode({ mode: 'not-a-real-mode' as any })).toBe('payThenService');
  });
});
