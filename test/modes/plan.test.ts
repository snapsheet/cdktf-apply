import { executePlan } from "../../src/modes/plan";
import * as terraform from "../../src/utils/terraform";
import * as core from "@actions/core";
import { ApplyInputs } from "../../src/types";

jest.mock("../../src/utils/terraform");
jest.mock("@actions/core");

describe("executePlan", () => {
  const mockSummary = {
    addHeading: jest.fn().mockReturnThis(),
    addRaw: jest.fn().mockReturnThis(),
    addBreak: jest.fn().mockReturnThis(),
    write: jest.fn().mockResolvedValue(undefined),
  };

  const baseInputs: ApplyInputs = {
    mode: "plan",
    ref: "main",
    workingDirectory: ".",
    previousPlanJson: "",
    environment: "test",
    stackName: "test-stack",
  };

  beforeAll(() => {
    (core.summary as any) = mockSummary;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("writes a success summary and returns result", async () => {
    (terraform.runTerraformPlan as jest.Mock).mockResolvedValue({
      result: { success: true, output: "plan stdout logs" },
    });

    const result = await executePlan(baseInputs);

    expect(mockSummary.addHeading).toHaveBeenCalledWith(
      "🤔 Initial Terraform Plan"
    );
    expect(mockSummary.addRaw).toHaveBeenCalledWith(
      "✅ Terraform plan completed successfully!\n\n",
      true
    );

    expect(mockSummary.addRaw).toHaveBeenCalledWith(
      expect.stringContaining("plan stdout logs"),
      true
    );

    expect(mockSummary.write).toHaveBeenCalled();
    expect(result).toEqual({
      result: { success: true, output: "plan stdout logs" },
    });
  });

  it("writes a failure summary and returns result", async () => {
    (terraform.runTerraformPlan as jest.Mock).mockResolvedValue({
      result: {
        success: false,
        output: "plan stderr logs",
        error:
          "Terraform plan failed with exit code 1. See plan.stderr.log for details.",
      },
    });

    const result = await executePlan(baseInputs);

    expect(mockSummary.addRaw).toHaveBeenCalledWith(
      "❌ Terraform plan failed! See error:\n\n",
      true
    );

    expect(mockSummary.addRaw).toHaveBeenCalledWith(
      expect.stringContaining("plan stderr logs"),
      true
    );
    expect(mockSummary.write).toHaveBeenCalled();
    expect(result).toEqual({
      result: {
        success: false,
        output: "plan stderr logs",
        error:
          "Terraform plan failed with exit code 1. See plan.stderr.log for details.",
      },
    });
  });
});
