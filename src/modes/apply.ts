import { ApplyInputs, ApplyResult } from "../types";
import { runTerraformApply } from "../utils/terraform";
import * as core from "@actions/core";

export async function executeApply(
  inputs: ApplyInputs
): Promise<ApplyResult> {

  const result = await runTerraformApply(inputs.workingDirectory, inputs.stackName);

  core.summary
      .addHeading("🛠️ Terraform Apply")
      .addRaw(
        result.result.success
        ? "✅ Terraform apply completed successfully!\n\n"
        : "❌ Terraform apply failed! See error:\n\n" ,
      true
    )
    .addRaw(
      `<details><summary>Show Terraform Apply Output</summary>\n\n` +
      "```text\n" +
      (result.result.output || "No output available.") +
      "\n```\n" +
      `</details>`,
      true)
    .addBreak()
    .write();

    return result
}
