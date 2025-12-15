import { executeApply } from '../../src/modes/apply';
import * as terraform from '../../src/utils/terraform';
import * as core from '@actions/core';
import { ApplyInputs } from '../../src/types';

jest.mock('../../src/utils/terraform');
jest.mock('@actions/core');

describe('executeApply', () => {
  const mockSummary = {
    addHeading: jest.fn().mockReturnThis(),
    addRaw: jest.fn().mockReturnThis(),
    addBreak: jest.fn().mockReturnThis(),
    write: jest.fn().mockResolvedValue(undefined),
  };

  const baseInputs: ApplyInputs = {
    mode: 'apply',
    ref: 'main',
    workingDirectory: '.',
    previousPlanJson: '',
    environment: 'test',
    stackName: 'test-stack',
  };

  beforeAll(() => {
    (core.summary as any) = mockSummary;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes a success summary and returns result', async () => {
    (terraform.runTerraformApply as jest.Mock).mockResolvedValue({
      result: { success: true, output: 'apply stdout logs' }
    });

    const result = await executeApply(baseInputs);

    expect(mockSummary.addHeading).toHaveBeenCalledWith("🛠️ Terraform Apply");
    expect(mockSummary.addRaw).toHaveBeenCalledWith(
      "✅ Terraform apply completed successfully!\n\n",
      true
    );

    expect(mockSummary.addRaw).toHaveBeenCalledWith(
      expect.stringContaining('apply stdout logs'),
      true
    );

    expect(mockSummary.write).toHaveBeenCalled();
    expect(result).toEqual({ result: { success: true, output: 'apply stdout logs' } });
  });

  it('writes a failure summary and returns result', async () => {
    (terraform.runTerraformApply as jest.Mock).mockResolvedValue({
      result: { success: false, output: 'apply stderr logs', error: "Terraform apply failed with exit code 1. See apply.stderr.log for details." }
    });

    const result = await executeApply(baseInputs);

    expect(mockSummary.addRaw).toHaveBeenCalledWith(
      "❌ Terraform apply failed! See error:\n\n",
      true
    );

    expect(mockSummary.addRaw).toHaveBeenCalledWith(
      expect.stringContaining('apply stderr logs'),
      true
    );
    expect(mockSummary.write).toHaveBeenCalled();
    expect(result).toEqual({ result: { success: false, output: 'apply stderr logs', error: "Terraform apply failed with exit code 1. See apply.stderr.log for details." } });
  });
});