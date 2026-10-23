import { describe, expect, it } from 'vitest';
import { formatPhone, isIndianMobile, normalizePhone, validateDemoUser } from './demoAuth';

describe('demo sign-in validation', () => {
  it('normalises the common ways people type an Indian mobile', () => {
    expect(normalizePhone('+91 98765 43210')).toBe('9876543210');
    expect(normalizePhone('098765-43210')).toBe('9876543210');
    expect(normalizePhone('9876543210')).toBe('9876543210');
  });

  it('accepts only 10-digit numbers starting with 6-9', () => {
    expect(isIndianMobile('9876543210')).toBe(true);
    expect(isIndianMobile('5876543210')).toBe(false);
    expect(isIndianMobile('987654321')).toBe(false);
  });

  it('reports each invalid field', () => {
    expect(validateDemoUser('A', '123')).toEqual({ name: 'nameShort', phone: 'phoneInvalid' });
    expect(validateDemoUser('Asha', '+91 98765 43210')).toEqual({});
  });

  it('formats for display', () => {
    expect(formatPhone('9876543210')).toBe('+91 98765 43210');
  });
});
