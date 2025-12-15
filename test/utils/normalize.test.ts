import { normalizePlan } from '../../src/utils/normalize';

describe('normalizePlan', () => {
  it('sorts object keys', () => {
    const raw = JSON.stringify({ b: 2, a: 1 });
    const result = normalizePlan(raw);
    expect(Object.keys(result)).toEqual(['a', 'b']);
  });

  it('sorts arrays of objects', () => {
    const raw = JSON.stringify([{ z: 1 }, { a: 2 }]);
    const result = normalizePlan(raw);
    expect(result).toEqual([{ a: 2 }, { z: 1 }]);
  });

  it('deeply normalizes nested objects', () => {
    const raw = JSON.stringify({ foo: { b: 2, a: 1 } });
    const result = normalizePlan(raw);
    expect(Object.keys(result.foo)).toEqual(['a', 'b']);
  });

  it('converts nulls to {} or [] heuristically', () => {
    const raw = JSON.stringify({
      something: null,
      items: null,
      group_list: null,
      foo_groups: null
    });
    const result = normalizePlan(raw);
    expect(result.something).toEqual({});
    expect(result.items).toEqual([]);
    expect(result.group_list).toEqual([]);
    expect(result.foo_groups).toEqual([]);
  });

  it('handles primitives', () => {
    const raw = JSON.stringify(42);
    const result = normalizePlan(raw);
    expect(result).toBe(42);
  });

  it('handles arrays of primitives', () => {
    const raw = JSON.stringify([3, 2, 1]);
    const result = normalizePlan(raw);
    expect(result).toEqual([1, 2, 3]);
  });
});