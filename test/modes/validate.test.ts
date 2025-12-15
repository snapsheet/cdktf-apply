import { executeValidate } from '../../src/modes/validate';
import * as terraform from '../../src/utils/terraform';
import * as normalize from '../../src/utils/normalize';
import * as extract from '../../src/utils/extract';
import * as diff from '../../src/utils/diff';
import * as core from '@actions/core';
import * as fs from 'fs';
import path from 'path';
import { ApplyInputs } from '../../src/types';

jest.mock('../../src/utils/terraform');
jest.mock('../../src/utils/normalize');
jest.mock('../../src/utils/extract');
jest.mock('../../src/utils/diff');
jest.mock('@actions/core');

jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
  };
});

describe('executeValidate', () => {
  const mockSummary = {
    addHeading: jest.fn().mockReturnThis(),
    addRaw: jest.fn().mockReturnThis(),
    addBreak: jest.fn().mockReturnThis(),
    write: jest.fn().mockResolvedValue(undefined),
  };

  const baseInputs: ApplyInputs = {
    mode: 'validate',
    ref: 'main',
    workingDirectory: '',
    previousPlanJson: '',
    environment: 'test',
    stackName: 'stack',
  };

  beforeAll(() => {
    (core.summary as any) = mockSummary;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns early and writes summary if plan fails', async () => {
    (terraform.runTerraformPlan as jest.Mock).mockResolvedValue({
      planJson: '{}',
      result: { success: false, output: 'plan stderr logs', error: 'Terraform plan failed with exit code 1. See plan.stderr.log for details.' }
    });

    const result = await executeValidate(baseInputs);

    expect(mockSummary.addHeading).toHaveBeenCalledWith("🤔 Pre-Apply Terraform Plan");
    expect(mockSummary.addRaw).toHaveBeenCalledWith(
      "❌ Terraform plan failed! See error:\n\n",
      true
    );

     expect(mockSummary.addRaw).toHaveBeenCalledWith(
      expect.stringContaining('plan stderr logs'),
      true
    );

    expect(mockSummary.write).toHaveBeenCalled();
    expect(result).toEqual({ result: { success: false, output: 'plan stderr logs', error: 'Terraform plan failed with exit code 1. See plan.stderr.log for details.' } });
  });

  it('writes diff and returns driftDetected if plans differ', async () => {
    (terraform.runTerraformPlan as jest.Mock).mockResolvedValue({
      planJson: '{"foo":"bar"}',
      result: { success: true, output: 'plan stdout logs' }
    });

    (fs.readFileSync as jest.Mock).mockReturnValue('{"foo":"baz"}');
    (normalize.normalizePlan as jest.Mock).mockImplementation(x => x);
    (extract.extractResourceChanges as jest.Mock)
      .mockImplementationOnce(() => [{ address: 'a', before: 1, after: 2, actions: ['update'] }])
      .mockImplementationOnce(() => [{ address: 'a', before: 1, after: 3, actions: ['update'] }]);
    (diff.generateMarkdownDiff as jest.Mock).mockReturnValue({
      driftDetected: true,
      diffMarkdown: 'DIFF_MARKDOWN'
    });

    const result = await executeValidate(baseInputs);

    expect(mockSummary.addHeading).toHaveBeenCalledWith("Terraform Plan Diff - Current Plan vs Initial Plan");
    expect(mockSummary.addRaw).toHaveBeenCalledWith(
      expect.stringContaining("❌ Initial plan and current plan differ! Infrastructure drift detected!\n\nDIFF_MARKDOWN"),
      true
    );
    expect(mockSummary.addRaw).toHaveBeenCalledWith(
      expect.stringContaining('DIFF_MARKDOWN'),
      true
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join('./', 'cdktf.out', 'stacks', 'stack', 'plan_diff.md'),
      'DIFF_MARKDOWN'
    );
    expect(result).toEqual({
      driftDetected: true,
      result: { success: true }
    });
  });

  it('writes diff and returns no drift if plans match', async () => {
    (terraform.runTerraformPlan as jest.Mock).mockResolvedValue({
      planJson: '{"foo":"bar"}',
      result: { success: true, output: 'plan stdout logs' }
    });
    (fs.readFileSync as jest.Mock).mockReturnValue('{"foo":"bar"}');
    (normalize.normalizePlan as jest.Mock).mockImplementation(x => x);
    (extract.extractResourceChanges as jest.Mock)
      .mockImplementation(() => [{ address: 'a', before: 1, after: 2, actions: ['update'] }]);
    (diff.generateMarkdownDiff as jest.Mock).mockReturnValue({
      driftDetected: false,
      diffMarkdown: 'DIFF_MATCH'
    });

    const result = await executeValidate(baseInputs);

    expect(mockSummary.addRaw).toHaveBeenCalledWith(
      expect.stringContaining("✅ Initial plan and current plan match! No infrastructure drift detected!\n\n"),
      true
    );

    // There should not be a diff in the summary if the plans match :)
    expect(mockSummary.addRaw).not.toHaveBeenCalledWith(
      expect.stringContaining('DIFF_MATCH'),
      true
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join('./', 'cdktf.out', 'stacks', 'stack', 'plan_diff.md'),
      'DIFF_MATCH'
    );
    expect(result).toEqual({
      driftDetected: false,
      result: { success: true }
    });
  });

  it('returns error if previous plan is missing', async () => {
    (terraform.runTerraformPlan as jest.Mock).mockResolvedValue({
      planJson: '{}',
      result: { success: true, output: 'plan stdout logs' }
    });
    (fs.readFileSync as jest.Mock).mockImplementation(() => { throw new Error('not found'); });

    const result = await executeValidate(baseInputs);

    expect(result).toEqual({ result: { success: false, error: "Could not read previous plan JSON" } });
  });

  it('returns error if previous plan is empty', async () => {
    (terraform.runTerraformPlan as jest.Mock).mockResolvedValue({
      planJson: '{}',
      result: { success: true, output: 'plan stdout logs' }
    });
    (fs.readFileSync as jest.Mock).mockReturnValue('');

    const result = await executeValidate(baseInputs);

   expect(result).toEqual({ result: { success: false, error: "Previous plan JSON is empty" } });
  });
});