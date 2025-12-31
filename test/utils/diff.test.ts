import { generateMarkdownDiff } from '../../src/utils/diff';
import { FlatTerraformResourceChange } from '../../src/types';

describe('generateMarkdownDiff', () => {
  it('detects added resources', () => {
    const oldChanges: FlatTerraformResourceChange[] = [];
    const newChanges: FlatTerraformResourceChange[] = [
      { address: 'aws_s3_bucket.new', before: {}, after: { name: 'bucket' }, actions: ['create'] }
    ];
    const result = generateMarkdownDiff(oldChanges, newChanges);
    expect(result.driftDetected).toBe(true);
    expect(result.diffMarkdown).toContain('## 🆕 Added (1)');
    expect(result.diffMarkdown).toContain('`aws_s3_bucket.new`');
    expect(result.diffMarkdown).toContain('_None_'); 
  });

  it('detects removed resources', () => {
    const oldChanges: FlatTerraformResourceChange[] = [
      { address: 'aws_s3_bucket.old', before: { name: 'bucket' }, after: {}, actions: ['delete'] }
    ];
    const newChanges: FlatTerraformResourceChange[] = [];
    const result = generateMarkdownDiff(oldChanges, newChanges);
    expect(result.driftDetected).toBe(true);
    expect(result.diffMarkdown).toContain('## 🗑️ Removed (1)');
    expect(result.diffMarkdown).toContain('`aws_s3_bucket.old`');
    expect(result.diffMarkdown).toContain('_None_');
  });

  it('detects updated resources (after state)', () => {
    const oldChanges: FlatTerraformResourceChange[] = [
      { address: 'aws_instance.example', before: { count: 1 }, after: { count: 1 }, actions: ['update'] }
    ];
    const newChanges: FlatTerraformResourceChange[] = [
      { address: 'aws_instance.example', before: { count: 1 }, after: { count: 2 }, actions: ['update'] }
    ];
    const result = generateMarkdownDiff(oldChanges, newChanges);
    expect(result.driftDetected).toBe(true);
    expect(result.diffMarkdown).toContain('## ✏️ Updated (1)');
    expect(result.diffMarkdown).toContain('<details><summary>🔄 aws_instance.example</summary>');
    expect(result.diffMarkdown).toContain('Plan has changed!');
    expect(result.diffMarkdown).toContain('Second Plan Result State:');
    expect(result.diffMarkdown).toContain('Initial Plan Result State:');
  });

  it('detects updated resources (before state)', () => {
    const oldChanges: FlatTerraformResourceChange[] = [
      { address: 'aws_instance.example', before: { count: 1 }, after: { count: 2 }, actions: ['update'] }
    ];
    const newChanges: FlatTerraformResourceChange[] = [
      { address: 'aws_instance.example', before: { count: 2 }, after: { count: 2 }, actions: ['update'] }
    ];
    const result = generateMarkdownDiff(oldChanges, newChanges);
    expect(result.driftDetected).toBe(true);
    expect(result.diffMarkdown).toContain('Resource has been modified outside plan!');
    expect(result.diffMarkdown).toContain('Second Plan Initial State:');
    expect(result.diffMarkdown).toContain('Initial Plan Initial State:');
  });

  it('shows no drift when nothing changes', () => {
    const oldChanges: FlatTerraformResourceChange[] = [
      { address: 'aws_instance.example', before: { count: 1 }, after: { count: 2 }, actions: ['update'] }
    ];
    const newChanges: FlatTerraformResourceChange[] = [
      { address: 'aws_instance.example', before: { count: 1 }, after: { count: 2 }, actions: ['update'] }
    ];
    const result = generateMarkdownDiff(oldChanges, newChanges);
    expect(result.driftDetected).toBe(false);
    expect(result.diffMarkdown).toContain('## 🆕 Added (0)');
    expect(result.diffMarkdown).toContain('## 🗑️ Removed (0)');
    expect(result.diffMarkdown).toContain('## ✏️ Updated (0)');
    expect(result.diffMarkdown).toContain('_None_');
  });
});