import { DevelopParams } from "../types";
import { asNumber, clamp } from "../utils/numeric";

// Keys of DevelopParams whose value is a plain number. The main mapping loop
// only ever assigns numbers, so restricting to these keys keeps the indexed
// assignment type-safe and prevents mapping numeric values onto object-typed
// fields (e.g. `vignette`, `grain`), which are handled by dedicated mappers.
type NumericDevelopKey = {
  [K in keyof DevelopParams]: DevelopParams[K] extends number ? K : never;
}[keyof DevelopParams];

export interface ParameterMapping {
  lrKeys: string[];
  safelightKey: NumericDevelopKey;
  transform?: (value: unknown) => number | null;
  comment?: string;
}

function mapExposure(v: unknown): number | null {
  const n = asNumber(v);
  if (n === null) return null;
  return clamp(n * 100, -200, 200);
}

function mapNormalized(v: unknown): number | null {
  const n = asNumber(v);
  if (n === null) return null;
  return clamp(n, -100, 100);
}

function mapNormalizedPercent(v: unknown): number | null {
  const n = asNumber(v);
  if (n === null) return null;
  return clamp(n * 100, -100, 100);
}

function mapPercent0To100(v: unknown): number | null {
  const n = asNumber(v);
  if (n === null) return null;
  return clamp(n, 0, 100);
}

function mapTemperature(v: unknown): number | null {
  const n = asNumber(v);
  if (n === null) return null;
  const kelvin = clamp(n, 2000, 50000);
  return clamp((kelvin - 6500) / 65, -100, 100);
}

export const MAPPING_TABLE: ParameterMapping[] = [
  {
    lrKeys: ["Exposure2012", "Exposure"],
    safelightKey: "exposure",
    transform: mapExposure,
    comment: "Exposure adjustment",
  },
  {
    lrKeys: ["Contrast2012", "Contrast"],
    safelightKey: "contrast",
    transform: mapNormalizedPercent,
    comment: "Contrast adjustment",
  },
  {
    lrKeys: ["Highlights2012", "Highlights"],
    safelightKey: "highlights",
    transform: mapNormalizedPercent,
    comment: "Highlights adjustment",
  },
  {
    lrKeys: ["Shadows2012", "Shadows"],
    safelightKey: "shadows",
    transform: mapNormalizedPercent,
    comment: "Shadows adjustment",
  },
  {
    lrKeys: ["Whites2012", "Whites"],
    safelightKey: "whites",
    transform: mapNormalizedPercent,
    comment: "Whites/Highlights adjustment",
  },
  {
    lrKeys: ["Blacks2012", "Blacks"],
    safelightKey: "blacks",
    transform: mapNormalizedPercent,
    comment: "Blacks/Shadows adjustment",
  },
  {
    lrKeys: ["Texture"],
    safelightKey: "texture",
    transform: mapNormalizedPercent,
    comment: "Texture adjustment",
  },
  {
    lrKeys: ["Clarity2012", "Clarity"],
    safelightKey: "clarity",
    transform: mapNormalizedPercent,
    comment: "Clarity adjustment",
  },
  {
    lrKeys: ["Dehaze"],
    safelightKey: "dehaze",
    transform: mapNormalizedPercent,
    comment: "Dehaze adjustment",
  },
  {
    lrKeys: ["Vibrance"],
    safelightKey: "vibrance",
    transform: mapNormalized,
    comment: "Vibrance adjustment",
  },
  {
    lrKeys: ["Saturation"],
    safelightKey: "saturation",
    transform: mapNormalized,
    comment: "Saturation adjustment",
  },
  {
    lrKeys: ["Temperature"],
    safelightKey: "temperature",
    transform: mapTemperature,
    comment: "Color temperature in Kelvin",
  },
  {
    lrKeys: ["Tint"],
    safelightKey: "tint",
    transform: mapNormalized,
    comment: "Tint adjustment (magenta/green)",
  },
  {
    lrKeys: ["Sharpening"],
    safelightKey: "sharpening",
    transform: mapPercent0To100,
    comment: "Sharpening amount",
  },
  {
    lrKeys: ["SharpenRadius"],
    safelightKey: "sharpenRadius",
    transform: (v) => {
      const n = asNumber(v);
      if (n === null) return null;
      return clamp(n, 1, 3);
    },
    comment: "Sharpening radius",
  },
  {
    lrKeys: ["SharpenDetail"],
    safelightKey: "sharpenDetail",
    transform: mapPercent0To100,
    comment: "Sharpening detail/edge detection",
  },
  {
    lrKeys: ["SharpenMasking"],
    safelightKey: "sharpenMasking",
    transform: mapPercent0To100,
    comment: "Sharpening edge masking",
  },
  {
    lrKeys: ["LuminanceSmoothing"],
    safelightKey: "luminanceNR",
    transform: mapPercent0To100,
    comment: "Luminance noise reduction",
  },
  {
    lrKeys: ["LuminanceDetail"],
    safelightKey: "luminanceNRDetail",
    transform: mapPercent0To100,
    comment: "Luminance NR detail preservation",
  },
  {
    lrKeys: ["LuminanceContrast"],
    safelightKey: "luminanceNRContrast",
    transform: mapPercent0To100,
    comment: "Luminance NR contrast preservation",
  },
  {
    lrKeys: ["LuminanceNoiseShadows"],
    safelightKey: "luminanceNRShadows",
    transform: mapPercent0To100,
    comment: "Luminance NR shadow weight",
  },
  {
    lrKeys: ["LuminanceNoiseHighlights"],
    safelightKey: "luminanceNRHighlights",
    transform: mapPercent0To100,
    comment: "Luminance NR highlight protection",
  },
  {
    lrKeys: ["ColorNoiseReduction"],
    safelightKey: "colorNR",
    transform: mapPercent0To100,
    comment: "Color (chroma) noise reduction",
  },
  {
    lrKeys: ["ColorNoiseDetail"],
    safelightKey: "colorNRDetail",
    transform: mapPercent0To100,
    comment: "Color NR detail preservation",
  },
  {
    lrKeys: ["ColorNoiseSmoothness"],
    safelightKey: "colorNRSmoothness",
    transform: mapPercent0To100,
    comment: "Color NR smoothness",
  },
  // Note: VignetteAmount and GrainAmount are object-valued in DevelopParams and
  // are handled by mapVignetteParams/mapGrainParams in param-mapper.ts.
];

export function findMapping(lrKey: string): ParameterMapping | undefined {
  return MAPPING_TABLE.find((m) => m.lrKeys.includes(lrKey));
}

export function getUnsupportedKeys(): string[] {
  return [
    "CameraProfile",
    "CameraProfileFileName",
    "EnableProfileCorrections",
    "LensProfileEnable",
    "LensProfileName",
    "LensProfileFilename",
    "AutoLateralCA",
    "ColorGradeGlobalHue",
    "ColorGradeShadowHue",
    "ColorGradeHighlightHue",
    "SplitToningShadowHue",
    "SplitToningHighlightHue",
    "SplitToningShadowSaturation",
    "SplitToningHighlightSaturation",
    "ProcessVersion",
    "CameraModelRestriction",
  ];
}
