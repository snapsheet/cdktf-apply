import { ResourceChange } from "../types";

/**
 * Extracts resource changes from a normalized Terraform plan object.
 * - Filters out no-op (no-operation) changes.
 * - Returns only fields that have changed between before and after states.
 * - Expects plan to be normalized (normalizePlan) so key order is already canonical; plain stringify is sufficient.
 *
 * @param plan - The normalized Terraform plan object.
 * @returns An array of resource changes with address, actions, and changed before/after fields.
 */
export function extractResourceChanges(plan: any): {
  address: string;
  actions: string[];
  after: Record<string, any>;
  before: Record<string, any>;
}[] {
  const changes: ResourceChange[] = plan.resource_changes || [];
  return (
    changes
      // Only include changes that are not no-op
      .filter((rc) => rc.change?.actions?.[0] !== "no-op")
      .map((rc) => {
        const before = rc.change?.before || {};
        const after = rc.change?.after || {};
        const changedFields = Object.keys({ ...before, ...after }).filter(
          (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key])
        );
        const filteredBefore: Record<string, any> = {};
        const filteredAfter: Record<string, any> = {};

        // Pull out changed fields
        changedFields.forEach((key) => {
          filteredBefore[key] = before[key];
          filteredAfter[key] = after[key];
        });
        return {
          address: rc.address,
          actions: rc.change?.actions,
          before: filteredBefore,
          after: filteredAfter,
        };
      })
      // Filter to only changes with actual before/after differences
      .filter(
        (rc) =>
          Object.keys(rc.after).length > 0 || Object.keys(rc.before).length > 0
      )
  );
}
