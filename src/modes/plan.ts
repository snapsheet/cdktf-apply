import { ApplyInputs, PlanResult } from "../types";
import { runTerraformPlan } from "../utils/terraform";
import * as core from "@actions/core";


export async function executePlan(
  inputs: ApplyInputs
): Promise<PlanResult> {

  const result = await runTerraformPlan(inputs.workingDirectory, inputs.stackName);

  core.summary
    .addHeading("🤔 Initial Terraform Plan")
    .addRaw(
      result.result.success
        ? "✅ Terraform plan completed successfully!\n\n"
        : "❌ Terraform plan failed! See error:\n\n",
      true
    )
    .addRaw(
      `<details><summary>Show Terraform Plan Output</summary>\n\n` +
      "```text\n" +
      (result.result.output || "No output available.") +
      "\n```\n" +
      `</details>`,
      true)
    .addBreak()
    .write();
  
  return result
};
