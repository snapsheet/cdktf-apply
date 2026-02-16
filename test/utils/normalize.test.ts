import { normalizePlan, normalizeForComparison } from '../../src/utils/normalize';

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

  it('normalizes JSON inside string values (e.g. container_definitions)', () => {
    // Terraform AWS provider can return the same JSON with different key order
    const raw = JSON.stringify({
      container_definitions:
        '{"logConfiguration":{"options":{"awslogs-group":"x","awslogs-region":"us-east-1"}}}'
    });
    const result = normalizePlan(raw);
    expect(typeof result.container_definitions).toBe('string');
    const parsed = JSON.parse(result.container_definitions);
    expect(parsed.logConfiguration.options).toEqual({
      'awslogs-group': 'x',
      'awslogs-region': 'us-east-1'
    });
  });

  it('produces same normalized string for JSON with different key order', () => {
    const str1 =
      '{"logConfiguration":{"options":{"awslogs-group":"x","awslogs-region":"y"}}}';
    const str2 =
      '{"logConfiguration":{"options":{"awslogs-region":"y","awslogs-group":"x"}}}';
    const plan1 = JSON.stringify({ x: str1 });
    const plan2 = JSON.stringify({ x: str2 });
    const norm1 = normalizePlan(plan1);
    const norm2 = normalizePlan(plan2);
    expect(norm1.x).toBe(norm2.x);
  });

  it('leaves string unchanged when it looks like JSON but fails to parse', () => {
    const raw = JSON.stringify({ x: '{"broken": json}' });
    const result = normalizePlan(raw);
    expect(result.x).toBe('{"broken": json}');
  });

  it('normalizes JSON array strings (e.g. container_definitions array)', () => {
    const raw = JSON.stringify({
      defs: '[{"z":3,"a":1},{"m":2}]'
    });
    const result = normalizePlan(raw);
    expect(typeof result.defs).toBe('string');
    expect(JSON.parse(result.defs)).toEqual([{ a: 1, z: 3 }, { m: 2 }]);
  });

  it('produces same normalized string for JSON array with same elements in different order', () => {
    const plan1 = JSON.stringify({ values: '[1,2,3,45,6,7]' });
    const plan2 = JSON.stringify({ values: '[7,6,45,3,1,2]' });
    const norm1 = normalizePlan(plan1);
    const norm2 = normalizePlan(plan2);
    expect(norm1.values).toBe(norm2.values);
    expect(JSON.parse(norm1.values)).toEqual([1, 2, 3, 45, 6, 7]);
  });
});

describe('normalizeForComparison', () => {
  it('treats JSON strings with different key order as equal', () => {
    const a = '{"b":2,"a":1}';
    const b = '{"a":1,"b":2}';
    expect(normalizeForComparison(a)).toBe(normalizeForComparison(b));
  });

  it('treats objects with different key order as equal', () => {
    const a = { b: 2, a: 1 };
    const b = { a: 1, b: 2 };
    expect(normalizeForComparison(a)).toBe(normalizeForComparison(b));
  });

  it('treats nested JSON strings (e.g. container_definitions) with different key order as equal', () => {
    const opts1 =
      '{"awslogs-group":"snapsheet_ai","awslogs-region":"us-east-1","awslogs-stream-prefix":"vice-uat"}';
    const opts2 =
      '{"awslogs-region":"us-east-1","awslogs-stream-prefix":"vice-uat","awslogs-group":"snapsheet_ai"}';
    expect(normalizeForComparison(opts1)).toBe(normalizeForComparison(opts2));
  });

  it('treats arrays with same elements in different order as equal', () => {
    const a = [{ address: 'b', x: 1 }, { address: 'a', x: 2 }];
    const b = [{ address: 'a', x: 2 }, { address: 'b', x: 1 }];
    expect(normalizeForComparison(a)).toBe(normalizeForComparison(b));
  });

  it('treats JSON array strings with same elements in different order as equal', () => {
    const a = '[1,2,3,45,6,7]';
    const b = '[7,6,45,3,1,2]';
    expect(normalizeForComparison(a)).toBe(normalizeForComparison(b));
  });

  it('handles null and undefined', () => {
    expect(normalizeForComparison(null)).toBe(JSON.stringify(null));
    expect(normalizeForComparison(undefined)).toBe(JSON.stringify(undefined));
  });

  it('handles primitives and non-JSON strings', () => {
    expect(normalizeForComparison(42)).toBe('42');
    expect(normalizeForComparison(true)).toBe('true');
    expect(normalizeForComparison('plain text')).toBe('"plain text"');
  });
});