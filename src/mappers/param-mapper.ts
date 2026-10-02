import { ColorGradingRange, CurvePoint, DevelopParams, HSLValues, ToneCurves } from "../types";
import { LightroomPreset } from "../parsers/parser-types";
import { asNumber, clamp } from "../utils/numeric";
import { MAPPING_TABLE } from "./mapping-table";

type LrSettings = Record<string, unknown>;

export async function mapLightroomToDevelopParams(
  lrPreset: LightroomPreset,
): Promise<{
  name: string;
  params: Partial<DevelopParams>;
} | null> {
  const params: Partial<DevelopParams> = {};
  const lr = lrPreset.settings;

  for (const mapping of MAPPING_TABLE) {
    const lrKey = mapping.lrKeys.find((k) => k in lr);
    if (!lrKey) continue;
    const value = mapping.transform(lr[lrKey]);
    if (value !== null) params[mapping.safelightKey] = value;
  }

  // As Shot / Auto values are one photo's own white balance (a sidecar carries
  // them), not an adjustment to copy onto other photos.
  if ("WhiteBalance" in lr && lr.WhiteBalance !== "Custom") {
    delete params.temperature;
    delete params.tint;
  }

  mapHSLAdjustments(params, lr);
  mapToneCurves(params, lr);
  mapColorGrading(params, lr);
  mapVignetteParams(params, lr);
  mapGrainParams(params, lr);

  // Safelight has no black-and-white mode; full desaturation is the nearest
  // look. Lightroom ignores Saturation in B&W, so it is overridden here.
  if (lr.ConvertToGrayscale === true) params.saturation = -100;

  return {
    name: lrPreset.name,
    params,
  };
}

function readNumber(lr: LrSettings, key: string, min: number, max: number): number | null {
  const n = asNumber(lr[key]);
  return n === null ? null : clamp(n, min, max);
}

const HSL_CHANNELS: { lr: string; key: keyof HSLValues }[] = [
  { lr: "Red", key: "red" },
  { lr: "Orange", key: "orange" },
  { lr: "Yellow", key: "yellow" },
  { lr: "Green", key: "green" },
  { lr: "Aqua", key: "aqua" },
  { lr: "Blue", key: "blue" },
  { lr: "Purple", key: "purple" },
  { lr: "Magenta", key: "magenta" },
];

const zeroHSL = (): HSLValues => ({
  red: 0,
  orange: 0,
  yellow: 0,
  green: 0,
  aqua: 0,
  blue: 0,
  purple: 0,
  magenta: 0,
});

// Lightroom's colour mixer: HueAdjustment*, SaturationAdjustment* and
// LuminanceAdjustment*, all ±100 like Safelight's. (GrayMixer* is the B&W mix.)
function mapHSLAdjustments(params: Partial<DevelopParams>, lr: LrSettings): void {
  const bands = { hue: "HueAdjustment", saturation: "SaturationAdjustment", luminance: "LuminanceAdjustment" };
  const hsl = { hue: zeroHSL(), saturation: zeroHSL(), luminance: zeroHSL() };
  let touched = false;
  for (const [band, prefix] of Object.entries(bands) as [keyof typeof hsl, string][]) {
    for (const { lr: channel, key } of HSL_CHANNELS) {
      const n = readNumber(lr, `${prefix}${channel}`, -100, 100);
      if (n === null) continue;
      hsl[band][key] = n;
      touched = true;
    }
  }
  if (touched) params.hsl = hsl;
}

const IDENTITY_CURVE: CurvePoint[] = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
];

// Lightroom curve points are [x, y] pairs on 0..255; Safelight's are 0..1.
function readCurve(lr: LrSettings, key: string): CurvePoint[] | null {
  const raw = lr[key];
  if (!Array.isArray(raw)) return null;
  const points: CurvePoint[] = [];
  for (const pair of raw) {
    if (!Array.isArray(pair) || pair.length !== 2) return null;
    const [x, y] = pair.map(asNumber);
    if (x === null || y === null) return null;
    points.push({ x: clamp(x / 255, 0, 1), y: clamp(y / 255, 0, 1) });
  }
  return points.length >= 2 ? points : null;
}

function mapToneCurves(params: Partial<DevelopParams>, lr: LrSettings): void {
  const curves: Record<keyof ToneCurves, CurvePoint[] | null> = {
    rgb: readCurve(lr, "ToneCurvePV2012"),
    red: readCurve(lr, "ToneCurvePV2012Red"),
    green: readCurve(lr, "ToneCurvePV2012Green"),
    blue: readCurve(lr, "ToneCurvePV2012Blue"),
  };
  if (!Object.values(curves).some(Boolean)) return;
  params.toneCurve = {
    rgb: curves.rgb ?? IDENTITY_CURVE,
    red: curves.red ?? IDENTITY_CURVE,
    green: curves.green ?? IDENTITY_CURVE,
    blue: curves.blue ?? IDENTITY_CURVE,
  };
}

// Lightroom still writes shadow and highlight hue/saturation under the
// split-toning names; the ColorGrade spelling wins when a file has both.
function readGradeRange(
  lr: LrSettings,
  range: string,
  splitToning?: string,
): ColorGradingRange | null {
  const fallback = (key: string) => (splitToning ? `SplitToning${splitToning}${key}` : null);
  const pick = (gradeKey: string, splitKey: string | null, min: number, max: number) =>
    readNumber(lr, gradeKey, min, max) ?? (splitKey ? readNumber(lr, splitKey, min, max) : null);
  const hue = pick(`ColorGrade${range}Hue`, fallback("Hue"), 0, 360);
  const sat = pick(`ColorGrade${range}Sat`, fallback("Saturation"), 0, 100);
  const luma = readNumber(lr, `ColorGrade${range}Lum`, -100, 100);
  if (hue === null && sat === null && luma === null) return null;
  return { hue: hue ?? 0, sat: sat ?? 0, luma: luma ?? 0 };
}

function mapColorGrading(params: Partial<DevelopParams>, lr: LrSettings): void {
  const shadows = readGradeRange(lr, "Shadow", "Shadow");
  const midtones = readGradeRange(lr, "Midtone");
  const highlights = readGradeRange(lr, "Highlight", "Highlight");
  const global = readGradeRange(lr, "Global");
  if (!shadows && !midtones && !highlights && !global) return;
  const neutral: ColorGradingRange = { hue: 0, sat: 0, luma: 0 };
  params.colorGrading = {
    shadows: shadows ?? neutral,
    midtones: midtones ?? neutral,
    highlights: highlights ?? neutral,
    global: global ?? neutral,
    // Lightroom's Blending/Balance have no direct counterpart; keep defaults.
    shadowRange: 50,
    highlightRange: 50,
  };
}

// The Effects panel's post-crop vignette. Plain Vignette* keys are lens
// vignetting correction, a different adjustment.
function mapVignetteParams(params: Partial<DevelopParams>, lr: LrSettings): void {
  const amount = readNumber(lr, "PostCropVignetteAmount", -100, 100);
  const midpoint = readNumber(lr, "PostCropVignetteMidpoint", 0, 100);
  const roundness = readNumber(lr, "PostCropVignetteRoundness", -100, 100);
  const feather = readNumber(lr, "PostCropVignetteFeather", 0, 100);
  const highlights = readNumber(lr, "PostCropVignetteHighlightContrast", 0, 100);
  if ([amount, midpoint, roundness, feather, highlights].every((v) => v === null)) return;
  params.vignette = {
    amount: amount ?? 0,
    midpoint: midpoint ?? 50,
    roundness: roundness ?? 0,
    feather: feather ?? 50,
    highlights: highlights ?? 0,
  };
}

// Same scales and defaults as Safelight's grain (size bottoms out at 25 there).
function mapGrainParams(params: Partial<DevelopParams>, lr: LrSettings): void {
  const amount = readNumber(lr, "GrainAmount", 0, 100);
  const size = readNumber(lr, "GrainSize", 25, 100);
  const roughness = readNumber(lr, "GrainFrequency", 0, 100);
  if (amount === null && size === null && roughness === null) return;
  params.grain = {
    amount: amount ?? 0,
    size: size ?? 25,
    roughness: roughness ?? 50,
    color: 0,
  };
}
