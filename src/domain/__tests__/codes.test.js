import { describe, expect, it } from 'vitest';
import { createProjectCode, normalizeProjectCode } from '../codes';

describe('project codes', () => {
  it('normalizes to uppercase letters and digits only', () => {
    expect(normalizeProjectCode(' a7-k2!! ')).toBe('A7K2');
    expect(normalizeProjectCode('x8k2p')).toBe('X8K2');
    expect(normalizeProjectCode('你A1B2')).toBe('A1B2');
  });

  it('generates readable 4-character codes', () => {
    for (let index = 0; index < 100; index += 1) {
      const code = createProjectCode();
      expect(code).toMatch(/^[A-Z0-9]{4}$/);
      expect(code).not.toMatch(/[O01I]/);
    }
  });
});
