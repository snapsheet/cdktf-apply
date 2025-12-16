import { FlatTerraformResourceChange } from "../types.js";

/**
 * Generates a markdown-formatted diff between two sets of Terraform resource changes.
 * - Identifies added, removed, and updated resources.
 * - Marks drift detection if any differences are found.
 *
 * @param oldChanges - The resource changes from the previous plan.
 * @param newChanges - The resource changes from the current plan.
 * @returns An object containing drift detection status and the markdown diff.
 */
export function generateMarkdownDiff(
  oldChanges: FlatTerraformResourceChange[],
  newChanges: FlatTerraformResourceChange[]
): { driftDetected: boolean; diffMarkdown: string } {
  const oldMap = new Map(oldChanges.map((c) => [c.address, c]));
  const newMap = new Map(newChanges.map((c) => [c.address, c]));

  const added: string[] = [];
  const removed: string[] = [];
  const updateDetails: string[] = [];

  for (const [address, newItem] of newMap.entries()) {
    if (!oldMap.has(address)) {
      added.push(address);
    } else {
      const oldItem = oldMap.get(address)!;
      const beforeStateDriftDetected =
        JSON.stringify(oldItem.before) !== JSON.stringify(newItem.before);
      const afterStateDriftDetected =
        JSON.stringify(oldItem.after) !== JSON.stringify(newItem.after);
      if (
        // Compare before and after too to catch updates that don't change resulting state.
        // EX: Initial plan shows a change to change a default service to 1,
        // but someone manually updates to 2 before plan is applied.
        // The after state would still be the same, but there was a drift.
        afterStateDriftDetected ||
        beforeStateDriftDetected
      ) {
        // The spacing of this is very brittle. Please do not change or I may cry :(

        // Before State
        const oldBefore =
          "    Initial Plan Initial State:\n" +
          "    ```json\n" +
          JSON.stringify(oldItem.before, null, 2)
            .split("\n")
            .map((line) => "    " + line)
            .join("\n") +
          "\n    ```\n";
        const newBefore =
          "    Second Plan Initial State:\n" +
          "    ```json\n" +
          JSON.stringify(newItem.before, null, 2)
            .split("\n")
            .map((line) => "    " + line)
            .join("\n") +
          "\n    ```";

        // After State
        const oldAfter =
          "    Initial Plan Result State:\n" +
          "    ```json\n" +
          JSON.stringify(oldItem.after, null, 2)
            .split("\n")
            .map((line) => "    " + line)
            .join("\n") +
          "\n    ```\n";
        const newAfter =
          "    Second Plan Result State:\n" +
          "    ```json\n" +
          JSON.stringify(newItem.after, null, 2)
            .split("\n")
            .map((line) => "    " + line)
            .join("\n") +
          "\n    ```";
        let details = `<details><summary>🔄 ${address}</summary>\n`;
        if (afterStateDriftDetected) {
          details +=
            "    ❌ Plan has changed!    \n\n" +
            newAfter +
            "\n" +
            oldAfter +
            "\n";
        }
        if (beforeStateDriftDetected) {
          details +=
            "    ❌ Resource has been modified outside plan!    \n\n" +
            newBefore +
            "\n" +
            oldBefore +
            "\n";
        }
        details += "</details>";
        updateDetails.push(details);
      }
    }
  }

  for (const [address] of oldMap.entries()) {
    if (!newMap.has(address)) {
      removed.push(address);
    }
  }

  const markdown = `## 🆕 Added (${added.length})
${added.length ? added.map((a) => `- \`${a}\``).join("\n") : "_None_"}

## 🗑️ Removed (${removed.length})
${removed.length ? removed.map((r) => `- \`${r}\``).join("\n") : "_None_"}

## ✏️ Updated (${updateDetails.length})
${
  updateDetails.length
    ? updateDetails.map((d) => `- ${d}`).join("\n\n")
    : "_None_"
}
`;

  return {
    driftDetected:
      added.length > 0 || removed.length > 0 || updateDetails.length > 0,
    diffMarkdown: markdown,
  };
}
