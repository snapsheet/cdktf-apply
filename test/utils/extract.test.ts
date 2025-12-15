import { extractResourceChanges } from '../../src/utils/extract';

describe('extractResourceChanges', () => {
  it('extracts added resources', () => {
    const plan = {
      resource_changes: [
        {
          address: 'aws_s3_bucket.new',
          change: {
            actions: ['create'],
            before: {},
            after: { name: 'bucket' }
          }
        }
      ]
    };
    const result = extractResourceChanges(plan);
    expect(result).toEqual([
      {
        address: 'aws_s3_bucket.new',
        actions: ['create'],
        before: {},
        after: { name: 'bucket' }
      }
    ]);
  });

  it('extracts updated resources with changed fields only', () => {
    const plan = {
      resource_changes: [
        {
          address: 'aws_instance.example',
          change: {
            actions: ['update'],
            before: { count: 1, unchanged: 'foo' },
            after: { count: 2, unchanged: 'foo' }
          }
        }
      ]
    };
    const result = extractResourceChanges(plan);
    expect(result).toEqual([
      {
        address: 'aws_instance.example',
        actions: ['update'],
        before: { count: 1 },
        after: { count: 2 }
      }
    ]);
  });

  it('extracts deleted resources', () => {
    const plan = {
      resource_changes: [
        {
          address: 'aws_s3_bucket.old',
          change: {
            actions: ['delete'],
            before: { name: 'bucket' },
            after: {}
          }
        }
      ]
    };
    const result = extractResourceChanges(plan);
    expect(result).toEqual([
      {
        address: 'aws_s3_bucket.old',
        actions: ['delete'],
        before: { name: 'bucket' },
        after: {}
      }
    ]);
  });

  it('ignores no-op resources', () => {
    const plan = {
      resource_changes: [
        {
          address: 'aws_s3_bucket.unchanged',
          change: {
            actions: ['no-op'],
            before: { name: 'bucket' },
            after: { name: 'bucket' }
          }
        }
      ]
    };
    const result = extractResourceChanges(plan);
    expect(result).toEqual([]);
  });

  it('ignores resources with no changed fields', () => {
    const plan = {
      resource_changes: [
        {
          address: 'aws_s3_bucket.unchanged',
          change: {
            actions: ['update'],
            before: { name: 'bucket' },
            after: { name: 'bucket' }
          }
        }
      ]
    };
    const result = extractResourceChanges(plan);
    expect(result).toEqual([]);
  });

   it('handles empty or missing resource_changes', () => {
    expect(extractResourceChanges({ resource_changes: [] })).toEqual([]);
    expect(extractResourceChanges({})).toEqual([]);
  });
});