// Fix: Import test runner functions to resolve TypeScript errors.
import { describe, it, expect } from 'vitest';
import { formatTime } from './utils';

describe('formatTime', () => {
  it('should format seconds correctly', () => {
    expect(formatTime(59)).toBe('0m 59s');
  });

  it('should format minutes and seconds correctly', () => {
    expect(formatTime(125)).toBe('2m 5s');
  });

  it('should handle exactly zero correctly', () => {
    expect(formatTime(0)).toBe('0m 0s');
  });

  it('should handle exact minutes correctly', () => {
    expect(formatTime(120)).toBe('2m 0s');
  });

  it('should handle invalid input gracefully', () => {
    expect(formatTime(-10)).toBe('0m 0s');
    expect(formatTime(NaN)).toBe('0m 0s');
  });
});