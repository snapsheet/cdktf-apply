/**
 * Integration-style tests for the validate pipeline (normalize → extract → compare).
 * Ensures that plans differing only by JSON key order are treated as matching.
 */
import { normalizePlan, normalizeForComparison } from "../src/utils/normalize";
import { extractResourceChanges } from "../src/utils/extract";

function makePlanJson(containerDefinitionsStr: string): string {
  return JSON.stringify({
    resource_changes: [
      {
        address: "aws_ecs_task_definition.example",
        change: {
          actions: ["create"],
          before: {},
          after: {
            id: "example",
            container_definitions: containerDefinitionsStr,
            cpu: "1024",
          },
        },
      },
    ],
  });
}

describe("validate pipeline (normalize → extract → compare)", () => {
  it("reports plans as matching when only JSON key order differs in string fields", () => {
    const containerDefsOrder1 =
      '[{"name":"web","logConfiguration":{"options":{"awslogs-group":"x","awslogs-region":"us-east-1"}}}]';
    const containerDefsOrder2 =
      '[{"name":"web","logConfiguration":{"options":{"awslogs-region":"us-east-1","awslogs-group":"x"}}}]';

    const oldPlanRaw = makePlanJson(containerDefsOrder1);
    const newPlanRaw = makePlanJson(containerDefsOrder2);

    const oldNormalized = normalizePlan(oldPlanRaw);
    const newNormalized = normalizePlan(newPlanRaw);

    const oldChanges = extractResourceChanges(oldNormalized);
    const newChanges = extractResourceChanges(newNormalized);

    const plansMatch =
      normalizeForComparison(oldChanges) === normalizeForComparison(newChanges);

    expect(plansMatch).toBe(true);
  });

  it("reports plans as differing when actual values differ", () => {
    const oldPlanRaw = makePlanJson('[{"name":"web","image":"img:1"}]');
    const newPlanRaw = makePlanJson('[{"name":"web","image":"img:2"}]');

    const oldChanges = extractResourceChanges(normalizePlan(oldPlanRaw));
    const newChanges = extractResourceChanges(normalizePlan(newPlanRaw));

    const plansMatch =
      normalizeForComparison(oldChanges) === normalizeForComparison(newChanges);

    expect(plansMatch).toBe(false);
  });
});
