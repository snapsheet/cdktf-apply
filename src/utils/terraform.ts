import * as exec from "@actions/exec";
import * as core from "@actions/core";
import * as path from "path";
import * as fs from "fs";
import { ApplyResult, PlanResult, Result } from "../types";

export async function synthApp(workingDir: string): Promise<Result> {
  core.info("Running CDKTF Synth...");

  const exitCode = await exec.exec("npx", ["cdktf", "synth"], { cwd: workingDir, ignoreReturnCode: true });

  return {
    success: exitCode === 0,
    output: exitCode === 0 ? "CDKTF synth'd successfully." : undefined,
    error: exitCode !== 0 ? `CDKTF synth failed with exit code ${exitCode}.` : undefined
  };
}

export async function runTerraformInit(stackDir: string): Promise<Result> {
  core.info(`Initializing Terraform in ${stackDir}...`);

  const exitCode = await exec.exec("terraform", ["init", "-no-color"], {
    ignoreReturnCode: true,
    cwd: stackDir
  });

  return {
    success: exitCode === 0,
    output: exitCode === 0 ? "Terraform initialized successfully." : undefined,
    error: exitCode !== 0 ? `Terraform init failed with exit code ${exitCode}.` : undefined
  };
}

export async function runTerraformPlan(
  working_directory: string,
  stack_name: string
): Promise<PlanResult> {

  const { stackDir, result: prepareResult} = await prepareStackDirectory(working_directory, stack_name);
  if (prepareResult.success === false) {
    return { planJson: "", result: prepareResult };
  }

  core.info(`Running Terraform plan in ${stackDir}...`);
  
  let planStdout = "";
  let planStderr = "";

  // Generate plan file
  const exitCode = await exec.exec(
    "terraform",
    ["plan", "-out=plan.tfplan", "-no-color"],
    {
      cwd: stackDir,
      ignoreReturnCode: true,
      listeners: {
        stdout: (data: Buffer) => (planStdout += data.toString()),
        stderr: (data: Buffer) => (planStderr += data.toString())
      }
    }
  );

  // Save logs
  fs.writeFileSync(path.join(stackDir, "plan.stdout.log"), planStdout);
  fs.writeFileSync(path.join(stackDir, "plan.stderr.log"), planStderr);

  if (exitCode !== 0) {
    return {planJson: "", result: { success: false, output: planStderr, error: `Terraform plan failed with exit code ${exitCode}. See plan.stderr.log for details.` } };
  }

  if (planStdout.includes("No changes. Your infrastructure matches the configuration.")) {
    return {planJson: "", noChanges: true, result: { success: true, output: "✅ No changes detected in Terraform plan. Canceling job." } };
  }

  core.info(`Extracting JSON plan from plan.tfplan...`);

  // Generate JSON output from plan file
  let jsonOutput = "";
  let showStderr = "";

  const showExitCode = await exec.exec(
    "terraform",
    ["show", "-json", "plan.tfplan"],
    {
      cwd: stackDir,
      silent: true,
      ignoreReturnCode: true,
      listeners: {
        stdout: (d: Buffer) => (jsonOutput += d.toString()),
        stderr: (d: Buffer) => (showStderr += d.toString())
      }
    }
  );
  fs.writeFileSync(path.join(stackDir, "plan_show.stderr.log"), showStderr);
  fs.writeFileSync(path.join(stackDir, "plan.json"), jsonOutput);

  if (showExitCode !== 0) {
    return { planJson: "", result: { success: false, output: showStderr, error: `Terraform show failed with exit code ${showExitCode}. See plan_show.stderr.log for details.` } };
  }


  return { planJson: jsonOutput, result: { success: true, output: planStdout } };
}

export async function runTerraformApply(
  working_directory: string,
  stack_name: string
): Promise<ApplyResult> {

  const { stackDir, result } = await prepareStackDirectory(working_directory, stack_name);

  if (result.success === false) {
    return { result }
  }

  core.info(`Running Terraform apply in ${stackDir}...`);

  let output = "";
  let stderrOutput = "";

  const exitCode = await exec.exec(
    "terraform",
    ["apply", "-auto-approve", "-no-color", "plan.tfplan"],
    {
      cwd: stackDir,
      ignoreReturnCode: true,
      listeners: {
        stdout: (data: Buffer) => output += data.toString(),
        stderr: (data: Buffer) => stderrOutput += data.toString()
      }
    }
  );

  fs.writeFileSync(path.join(stackDir, "apply.stdout.log"), output);
  fs.writeFileSync(path.join(stackDir, "apply.stderr.log"), stderrOutput);

  if (exitCode !== 0) {
    return {  result: { success: false, output:stderrOutput, error: `Terraform apply failed with exit code ${exitCode}. See apply.stderr.log for details.` } };
  }

  return { result: { success: true, output } };
}

export async function prepareStackDirectory(working_directory: string, stack_name: string): Promise<{stackDir: string; result: Result}> {

  const synthResult = await synthApp(working_directory);

  if (synthResult.success === false) {
    return {stackDir: "", result: synthResult };
  }

  const stackDir = path.join(working_directory,"cdktf.out","stacks",stack_name);

  if (!fs.existsSync(stackDir)) {
    throw new Error(`Stack directory does not exist: ${stackDir}`);
  }

  const initResult = await runTerraformInit(stackDir);

  if (initResult.success === false) {
    return {stackDir, result: initResult };
  }

  return {stackDir, result: {success: true}};
}