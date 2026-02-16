/**
 * Normalizes a Terraform plan JSON string for stable comparison.
 * - Recursively sorts object keys and array elements.
 * - Converts nulls to empty objects or arrays based on key heuristics.
 * - Parses and normalizes any string values that contain JSON (e.g. container_definitions)
 *   so that key order inside those strings does not cause false drift.
 *
 * @param raw - The raw Terraform plan JSON string.
 * @returns The normalized plan object.
 */
export function normalizePlan(raw: string): any {
  const plan = JSON.parse(raw);

  function deepNormalize(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    if (typeof obj === "string") {
      const trimmed = obj.trim();
      const looksLikeJson =
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"));
      if (looksLikeJson) {
        try {
          const parsed = JSON.parse(obj);
          return JSON.stringify(deepNormalize(parsed));
        } catch {
          return obj;
        }
      }
      return obj;
    }
    if (Array.isArray(obj)) {
      // Normalize each element and sort for stable comparison
      return obj
        .map(deepNormalize)
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    }
    if (typeof obj === "object") {
      const normalized: any = {};
      Object.keys(obj)
        .sort()
        .forEach((key) => {
          let value = obj[key];
          // Convert nulls to {} or [] if you know the expected type, otherwise leave as null
          if (value === null) {
            // Heuristic: if key suggests a map/object, use {}; if suggests a list/array, use []
            if (
              key.endsWith("s") ||
              key.endsWith("_list") ||
              key.endsWith("_groups")
            ) {
              value = [];
            } else {
              value = {};
            }
          }
          normalized[key] = deepNormalize(value);
        });
      return normalized;
    }
    return obj;
  }

  return deepNormalize(plan);
}

/**
 * Returns a canonical string for a value so that two semantically equal values
 * (e.g. JSON strings with different key order) produce the same string.
 * Use for order-insensitive comparison: normalizeForComparison(a) === normalizeForComparison(b).
 */
export function normalizeForComparison(value: any): string {
  if (value === null || value === undefined) {
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    const looksLikeJson =
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"));
    if (looksLikeJson) {
      try {
        return JSON.stringify(normalizePlan(value));
      } catch {
        return JSON.stringify(value);
      }
    }
    return JSON.stringify(value);
  }
  if (typeof value === "object") {
    return JSON.stringify(normalizePlan(JSON.stringify(value)));
  }
  return JSON.stringify(value);
}
