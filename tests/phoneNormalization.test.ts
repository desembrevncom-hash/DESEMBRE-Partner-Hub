import { describe, it, expect } from 'vitest';
import { normalizePhone } from '../src/lib/phoneNormalization';

describe('phoneNormalization', () => {
  it('normalizes valid 09xxxxxxxx format', () => {
    expect(normalizePhone('0912345678')).toBe('+84912345678');
  });

  it('normalizes valid 03xxxxxxxx format', () => {
    expect(normalizePhone('0312345678')).toBe('+84312345678');
  });

  it('normalizes valid 07xxxxxxxx format', () => {
    expect(normalizePhone('0712345678')).toBe('+84712345678');
  });

  it('normalizes valid 08xxxxxxxx format', () => {
    expect(normalizePhone('0812345678')).toBe('+84812345678');
  });

  it('normalizes +84 formats', () => {
    expect(normalizePhone('+84912345678')).toBe('+84912345678');
    expect(normalizePhone('+84 912 345 678')).toBe('+84912345678');
  });

  it('normalizes 84 format (without plus)', () => {
    expect(normalizePhone('84912345678')).toBe('+84912345678');
  });

  it('handles spaces, dashes, and parentheses', () => {
    expect(normalizePhone('0912-345-678')).toBe('+84912345678');
    expect(normalizePhone('(091) 234 5678')).toBe('+84912345678');
    expect(normalizePhone('091.234.5678')).toBe('+84912345678');
  });

  it('rejects too short numbers', () => {
    expect(normalizePhone('09123456')).toBeNull();
    expect(normalizePhone('+849123456')).toBeNull();
  });

  it('rejects too long numbers', () => {
    expect(normalizePhone('09123456789')).toBeNull();
    expect(normalizePhone('+849123456789')).toBeNull();
  });

  it('rejects invalid prefixes', () => {
    expect(normalizePhone('0412345678')).toBeNull(); // 4 is not valid mobile prefix
    expect(normalizePhone('0212345678')).toBeNull();
  });

  it('rejects letters and invalid characters completely modifying length', () => {
    // abc becomes empty string, length 0
    expect(normalizePhone('abcdefghij')).toBeNull();
  });

  it('handles empty input gracefully', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });
});
