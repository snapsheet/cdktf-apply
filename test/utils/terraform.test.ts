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
  opts?: { stdout?: string; stderr?: string }
) => {
  (exec.exec as jest.Mock).mockImplementation((cmd, args, execOpts) => {
    if (
      execOpts &&
      execOpts.listeners &&
      opts &&
      typeof execOpts.listeners.stdout === "function" &&
      opts.stdout
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
      return 1;
    } else if (
      cmd === "npx" &&
      (args[0] === failStep || args[1] === failStep)
    ) {
      return 1;
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
        output: "CDKTF synth'd successfully.",
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

    it("returns noChanges if plan output says no changes", async () => {
      mockSteps("", {
        stdout: "No changes. Your infrastructure matches the configuration.",
      });
      const result = await terraform.runTerraformPlan("/cdktf", "stack");
      expect(result.noChanges).toBe(true);
      expect(result.result.success).toBe(true);
    });

    it("returns error if terraform show fails", async () => {
      mockSteps("show");
      const result = await terraform.runTerraformPlan("/cdktf", "stack");
      expect(result.result.success).toBe(false);
      expect(result.planJson).toBe("");
      expect(result.result.error).toMatch(/Terraform show failed/);
    });

    it("returns planJson and success if all ok", async () => {
      mockSteps("", { stdout: '{"foo":"bar"}' });
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
