import * as core from "@actions/core";
import * as fs from "fs";
import { ApplyInputs, ValidateResult } from "../types";
import { runTerraformPlan } from "../utils/terraform";
import { normalizePlan } from "../utils/normalize";
import { extractResourceChanges } from "../utils/extract";
import { generateMarkdownDiff } from "../utils/diff";
import * as path from "path";

export async function executeValidate(
  inputs: ApplyInputs
): Promise<ValidateResult> {

  // Run new plan
  const { planJson: newPlanRaw, result } = await runTerraformPlan(inputs.workingDirectory, inputs.stackName);

  await core.summary
    .addHeading("🤔 Pre-Apply Terraform Plan")
    .addRaw(
      result.success
      ? "✅ Terraform plan completed successfully!\n\n"
      : "❌ Terraform plan failed! See error:\n\n" ,
    true
    )
    .addRaw(
      `<details><summary>Show Terraform Plan Output</summary>\n\n` +
      "```text\n" +
      (result.output || "No output available.") +
      "\n```\n" +
      `</details>`,
      true
    )
    .addBreak()
    .write();

  if (result.success === false) {
    return { result };
  }

  const stackDir = path.join(inputs.workingDirectory,"cdktf.out","stacks",inputs.stackName);
  
  // Load previous plan JSON
  const oldPlanPath = path.join(stackDir, "previous", "plan.json");

  core.info("Loading previous plan...");

  let oldPlanRaw = "";
  try {
    oldPlanRaw = fs.readFileSync(oldPlanPath, "utf8");

    if (!oldPlanRaw || oldPlanRaw.trim().length === 0) {
      core.error(`Previous plan JSON at ${oldPlanPath} is empty.`);
      return {result: {success: false, error: "Previous plan JSON is empty"}};
    }
  } catch (err) {
    core.error(`Failed to read previous plan JSON from ${oldPlanPath}: ${(err as Error).message}`);
    return {result: {success: false, error: "Could not read previous plan JSON"}};
  }

  core.info("Normalizing plans...");
  // Normalize both plans
  const newNormalized = normalizePlan(newPlanRaw);
  const oldNormalized = normalizePlan(oldPlanRaw);

  core.info("Extracting resource changes...");
  // Extract meaningful changes
  const oldChanges = extractResourceChanges(oldNormalized);
  const newChanges = extractResourceChanges(newNormalized);

  core.info("Comparing resource changes...");
  // Compare plans
  const plansMatch = JSON.stringify(oldChanges) === JSON.stringify(newChanges);
  
  core.info('Generating diff...');
  // Build markdown diff
  const diffResult = generateMarkdownDiff(oldChanges, newChanges);

  // ALWAYS print the markdown for reviewers
  core.info("Terraform Diff - Current Plan vs Initial");
  core.info(diffResult.diffMarkdown || "No changes detected");

  // Write diff as markdown file
  fs.writeFileSync(path.join(stackDir, "plan_diff.md"), diffResult.diffMarkdown || "No changes detected");

  // Add markdown to the GitHub Step Summary panel
  await core.summary
    .addHeading("Terraform Plan Diff - Current Plan vs Initial Plan")
    .addRaw(
    plansMatch && !diffResult.driftDetected
      ? "✅ Initial plan and current plan match! No infrastructure drift detected!\n\n"
      : "❌ Initial plan and current plan differ! Infrastructure drift detected!\n\n" + diffResult.diffMarkdown,
    true
    )
    .addBreak()
    .write();

  return {
    driftDetected: !plansMatch || diffResult.driftDetected,
    result: { success: true },
  };
}
