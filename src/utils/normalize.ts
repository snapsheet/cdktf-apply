export function normalizePlan(raw: string): any {
  const plan = JSON.parse(raw);

  function deepNormalize(obj: any): any {
    if (Array.isArray(obj)) {
      // Normalize each element and sort for stable comparison
      return obj.map(deepNormalize).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    }
    if (obj && typeof obj === "object") {
      const normalized: any = {};
      Object.keys(obj).sort().forEach(key => {
        let value = obj[key];
        // Convert nulls to {} or [] if you know the expected type, otherwise leave as null
        if (value === null) {
          // Heuristic: if key suggests a map/object, use {}; if suggests a list/array, use []
          if (key.endsWith("s") || key.endsWith("_list") || key.endsWith("_groups")) {
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
