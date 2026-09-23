// Adjustable bottom shelves count; the two fixed shelves do not.
const standardCounts = { FR: 0, LH: 1, DH: 1, HS: 3, S3D: 4, H3D: 2, S2D: 4, S7: 6, S8: 6, S9: 6 };

export function adjustableShelfCount(code, height) {
  const normalized = String(code).toUpperCase();
  const base = standardCounts[normalized];
  if (base == null) throw new Error(`Unknown tower configuration: ${code}`);
  const resolvedHeight = Number(height || (['S8', 'S9'].includes(normalized) ? 96 : 84));
  if (![84, 96].includes(resolvedHeight)) throw new Error(`Unsupported tower height: ${height}`);
  return base + (resolvedHeight === 96 && normalized !== 'FR' ? 1 : 0);
}
