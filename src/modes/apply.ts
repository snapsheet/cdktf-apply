import { ApplyInputs, ApplyResult } from "../types";
import { runTerraformApply } from "../utils/terraform";
import * as core from "@actions/core";

/**
 * Executes the Terraform apply step for the given inputs.
 *
 * - Runs `terraform apply` in the specified working directory and stack.
 * - Summarizes the result in the GitHub Actions summary, including success/failure and output details.
 *
 * @param inputs - The inputs required to perform the apply operation, including working directory and stack name.
 * @returns The result of the apply operation, including success status and output.
 */
export async function executeApply(inputs: ApplyInputs): Promise<ApplyResult> {
  const result = await runTerraformApply(
    inputs.workingDirectory,
    inputs.stackName
  );

  core.summary
    .addHeading("🛠️ Terraform Apply")
    .addRaw(
      result.result.success
        ? "✅ Terraform apply completed successfully!\n\n"
        : "❌ Terraform apply failed! See error:\n\n",
      true
    )
    .addRaw(
      `<details><summary>Show Terraform Apply Output</summary>\n\n` +
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
