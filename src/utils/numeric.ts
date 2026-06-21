export function asNumber(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = parseFloat(value);
    return isNaN(n) ? null : n;
  }
  return null;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function scale(
  value: number,
  fromMin: number,
  fromMax: number,
  toMin: number,
  toMax: number,
): number {
  const normalized = (value - fromMin) / (fromMax - fromMin);
  return normalized * (toMax - toMin) + toMin;
}

export function safeNumber(value: unknown, fallback: number = 0): number {
  const num = asNumber(value);
  return num !== null ? num : fallback;
}
