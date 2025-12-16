import { ApplyInputs, PlanResult } from "../types";
import { runTerraformPlan } from "../utils/terraform";
import * as core from "@actions/core";

/**
 * Executes the Terraform plan step for the given inputs.
 *
 * - Runs `terraform plan` in the specified working directory and stack.
 * - Summarizes the result in the GitHub Actions summary, including success/failure and output details.
 *
 * @param inputs - The inputs required to perform the plan operation, including working directory and stack name.
 * @returns The result of the plan operation, including success status and output.
 */
export async function executePlan(inputs: ApplyInputs): Promise<PlanResult> {
  const result = await runTerraformPlan(
    inputs.workingDirectory,
    inputs.stackName
  );

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
      true
    )
    .addBreak()
    .write();

  return result;
}
