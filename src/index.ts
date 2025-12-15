import * as core from "@actions/core";
import { ApplyInputs, ApplyMode } from "./types";
import { executePlan } from "./modes/plan";
import { executeValidate } from "./modes/validate";
import { executeApply } from "./modes/apply";

function getInputs(): ApplyInputs {

  const stack = process.env.STACK_NAME;

  if (!stack || stack.trim() === "") {
    throw new Error("STACK_NAME environment variable is required but was not provided.");
  }

  return {
    mode: core.getInput("mode", { required: true }) as ApplyMode,
    ref: core.getInput("ref"),
    workingDirectory: core.getInput("working_directory", { required: true }),
    environment: core.getInput("environment", { required: true }),
    stackName: stack
  };
}

async function run(): Promise<void> {
  try {
    const inputs = getInputs();

    core.info(`🔧 CDKTF action starting in mode: ${inputs.mode}`);
    core.info(`📦 Stack: ${inputs.stackName}`);
    core.info(`📁 Working directory: ${inputs.workingDirectory}`);

    if (inputs.mode === "plan") {
      const {result, noChanges} = await executePlan(inputs);
      
      if (result.success === false) {
        core.setFailed(result.error || "Terraform plan failed.");
        return;
      }
      core.setOutput("no_changes", noChanges === true ? 'true' : 'false');
      return;
    }

    if (inputs.mode === "validate") {
      const {result, driftDetected} = await executeValidate(inputs);

      if (result?.success === false) {
        core.setFailed(result.error || "Detecting plan drift failed.");
        return;
      }

      core.setOutput("drift_detected", driftDetected?.toString());

      if (driftDetected === true) {
        core.setFailed("Terraform plans do NOT match. See the plan diff artifact for details.");
      }
      return;
    }

    if (inputs.mode === "apply") {
      const {result} = await executeApply(inputs);

      if (result.success === false) {
        core.setFailed(result.error || "Terraform apply failed.");
        return
      }
      return;
    }

    throw new Error(`Unknown mode: ${inputs.mode}`);
  } catch (err: any) {
    core.setFailed(err.message || err);
  }
}

run();
