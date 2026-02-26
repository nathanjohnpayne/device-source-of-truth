import { describe, it, expect } from 'vitest';
import { safeNumber } from '../src/services/safeNumber.js';

describe('safeNumber', () => {
  describe('passthrough numeric inputs', () => {
    it.each([
      [0, 0],
      [1, 1],
      [42, 42],
      [-5, -5],
      [3.14, 3.14],
      [1_000_000, 1_000_000],
    ])('safeNumber(%s) → %s', (input, expected) => {
      expect(safeNumber(input)).toBe(expected);
    });
  });

  describe('nullish and empty inputs → 0', () => {
    it.each([
      [null, 0],
      [undefined, 0],
      ['', 0],
      ['   ', 0],
      ['n/a', 0],
      ['N/A', 0],
    ])('safeNumber(%j) → %s', (input, expected) => {
      expect(safeNumber(input)).toBe(expected);
    });
  });

  describe('K/M/B suffixes', () => {
    it.each([
      ['614K', 614_000],
      ['614k', 614_000],
      ['1.2M', 1_200_000],
      ['1.2m', 1_200_000],
      ['2B', 2_000_000_000],
      ['2.5b', 2_500_000_000],
      ['0.5K', 500],
    ])('safeNumber(%j) → %s', (input, expected) => {
      expect(safeNumber(input)).toBe(expected);
    });
  });

  describe('comma-separated thousands', () => {
    it.each([
      ['1,234', 1234],
      ['1,234,567', 1234567],
      ['10,000', 10000],
    ])('safeNumber(%j) → %s (commas stripped as thousands separators)', (input, expected) => {
      expect(safeNumber(input)).toBe(expected);
    });
  });

  describe('comma + suffix ambiguity ("1,4K" decision)', () => {
    it('treats commas as thousands separators before suffix parsing → "1,4K" = 14000', () => {
      // Current behavior: commas are stripped first → "14K" → 14000
      // If European decimal were intended, "1,4K" would mean 1.4K = 1400
      // This test documents the current decision
      expect(safeNumber('1,4K')).toBe(14_000);
    });

    it('"1,400" → 1400 (unambiguous thousands separator)', () => {
      expect(safeNumber('1,400')).toBe(1400);
    });
  });

  describe('invalid strings → 0', () => {
    it.each([
      ['hello', 0],
      ['not-a-number', 0],
      ['abc123', 0],
      ['---', 0],
      ['NaN', 0],
    ])('safeNumber(%j) → 0', (input) => {
      expect(safeNumber(input)).toBe(0);
    });
  });

  describe('negative string values', () => {
    it('"-5" → -5', () => {
      expect(safeNumber('-5')).toBe(-5);
    });

    it('"-3.7" → -4 (rounds)', () => {
      expect(safeNumber('-3.7')).toBe(-4);
    });
  });

  describe('decimal strings are rounded', () => {
    it.each([
      ['3.14', 3],
      ['99.9', 100],
      ['0.4', 0],
      ['0.5', 1],
    ])('safeNumber(%j) → %s', (input, expected) => {
      expect(safeNumber(input)).toBe(expected);
    });
  });

  describe('NaN guard', () => {
    it('NaN → 0', () => {
      expect(safeNumber(NaN)).toBe(0);
    });

    it('Infinity is passed through as number', () => {
      expect(safeNumber(Infinity)).toBe(Infinity);
    });
  });
});
