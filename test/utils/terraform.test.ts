import * as terraform from "../../src/utils/terraform";
import * as exec from "@actions/exec";
import * as fs from "fs";
import * as path from "path";

jest.mock("@actions/exec");
jest.mock("@actions/core");
jest.mock("fs", () => {
  const actualFs = jest.requireActual("fs");
  return {
    ...actualFs,
    existsSync: jest.fn(),
    writeFileSync: jest.fn(),
  };
});
jest.mock("path");

const defaultMocks = () => {
  (fs.existsSync as jest.Mock).mockReturnValue(true);
  (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
  (path.join as jest.Mock).mockImplementation((...args) => args.join("/"));
};

const mockSteps = (
  failStep?: string,
  opts?: {
    stdout?: string;
    stderr?: string;
    exitCode?: number;
    planExitCode?: number;
  }
) => {
  (exec.exec as jest.Mock).mockImplementation((cmd, args, execOpts) => {
    // Send stdout to terraform show (for JSON) and apply (for output), but not to plan
    if (
      execOpts &&
      execOpts.listeners &&
      opts &&
      typeof execOpts.listeners.stdout === "function" &&
      opts.stdout &&
      cmd === "terraform" &&
      (args[0] === "show" || args[0] === "apply")
    ) {
      execOpts.listeners.stdout(Buffer.from(opts.stdout));
    }
    if (
      execOpts &&
      execOpts.listeners &&
      opts &&
      typeof execOpts.listeners.stderr === "function" &&
      opts.stderr
    ) {
      execOpts.listeners.stderr(Buffer.from(opts.stderr));
    }
    if (cmd === "terraform" && args[0] === failStep) {
      return opts?.exitCode ?? 1;
    } else if (
      cmd === "npx" &&
      (args[0] === failStep || args[1] === failStep)
    ) {
      return 1;
      // Need this additional check, in order to handle the case where the plan exit code is 2 (changes detected)
    } else if (
      cmd === "terraform" &&
      args[0] === "plan" &&
      opts?.planExitCode !== undefined
    ) {
      return opts.planExitCode;
    } else {
      return 0;
    }
  });
};

describe("terraform utils", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    defaultMocks();
  });

  describe("synthApp", () => {
    it("returns success when exit code is 0", async () => {
      mockSteps();
      const result = await terraform.synthApp("/cdktf");
      expect(result).toEqual({
        success: true,
        output: "CDKTF synth ran successfully",
      });
    });

    it("returns error when exit code is nonzero", async () => {
      mockSteps("cdktf");
      const result = await terraform.synthApp("/cdktf");
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/CDKTF synth failed/);
    });
  });

  describe("runTerraformInit", () => {
    it("returns success when exit code is 0", async () => {
      mockSteps("");
      const result = await terraform.runTerraformInit("cdktf/stack");
      expect(result).toEqual({
        success: true,
        output: "Terraform initialized successfully.",
      });
    });

    it("returns error when exit code is nonzero", async () => {
      mockSteps("init");
      const result = await terraform.runTerraformInit("cdktf/stack");
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Terraform init failed/);
    });
  });

  describe("runTerraformPlan", () => {
    it("returns error if prepareStackDirectory fails", async () => {
      mockSteps("cdktf");
      const result = await terraform.runTerraformPlan("/cdktf", "stack");
      expect(result.result.success).toBe(false);
      expect(result.planJson).toBe("");
      expect(result.result.error).toMatch(/CDKTF synth failed/);
    });

    it("returns error if terraform plan fails", async () => {
      mockSteps("plan");
      const result = await terraform.runTerraformPlan("/cdktf", "stack");
      expect(result.result.success).toBe(false);
      expect(result.result.error).toMatch(/Terraform plan failed/);
      expect(result.planJson).toBe("");
    });

    it("returns noChanges if plan exit code is 0", async () => {
      mockSteps("plan", {
        exitCode: 0,
      });
      const result = await terraform.runTerraformPlan("/cdktf", "stack");
      expect(result.noChanges).toBe(true);
      expect(result.result.success).toBe(true);
      expect(result.result.output).toContain("No changes detected");
    });

    it("returns error if terraform show fails", async () => {
      mockSteps("show", {
        planExitCode: 2, // Exit code 2 = changes detected, so it continues to show step
      });
      const result = await terraform.runTerraformPlan("/cdktf", "stack");
      expect(result.result.success).toBe(false);
      expect(result.planJson).toBe("");
      expect(result.result.error).toMatch(/Terraform show failed/);
    });

    it("returns planJson and success if all ok", async () => {
      mockSteps("", {
        planExitCode: 2, // Exit code 2 = changes detected (success)
        stdout: '{"foo":"bar"}',
      });
      const result = await terraform.runTerraformPlan("/cdktf", "stack");
      expect(result.result.success).toBe(true);
      expect(result.planJson).toContain('"foo":"bar"');
    });
  });

  describe("runTerraformApply", () => {
    it("returns error if prepareStackDirectory fails", async () => {
      mockSteps("cdktf");
      const result = await terraform.runTerraformApply("/cdktf", "stack");
      expect(result.result.success).toBe(false);
      expect(result.result.error).toMatch(/CDKTF synth failed/);
    });

    it("returns error if apply fails", async () => {
      mockSteps("apply", { stderr: "apply error" });
      const result = await terraform.runTerraformApply("/cdktf", "stack");
      expect(result.result.success).toBe(false);
      expect(result.result.output).toContain("apply error");
      expect(result.result.error).toMatch(/Terraform apply failed/);
    });

    it("returns success and output if apply succeeds", async () => {
      mockSteps("", { stdout: "apply logs" });
      const result = await terraform.runTerraformApply("/cdktf", "stack");
      expect(result.result.success).toBe(true);
      expect(result.result.output).toContain("apply logs");
    });
  });
});
