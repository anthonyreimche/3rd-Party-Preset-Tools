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
  /** Lightroom keys to read, first present wins. */
  lrKeys: string[];
  safelightKey: NumericDevelopKey;
  transform: (value: unknown) => number | null;
}

// Lightroom stores each slider as it reads in its UI (exposure in EV, ±100
// sliders, Kelvin), and Safelight's sliders share those scales, so values pass
// through clamped to Safelight's range.
function within(min: number, max: number): (value: unknown) => number | null {
  return (value) => {
    const n = asNumber(value);
    return n === null ? null : clamp(n, min, max);
  };
}

const SLIDER = within(-100, 100);
const AMOUNT = within(0, 100);

// Lightroom's Kelvin scale starts at 2000; a lower value isn't a Kelvin
// temperature, and clamping it would turn the photo deep blue.
function kelvin(value: unknown): number | null {
  const n = asNumber(value);
  return n === null || n < 2000 ? null : Math.min(n, 50000);
}

// Process 2012 keys only for the tone sliders: Process 2010's Contrast
// (0..100, default 25) and Shadows (black clipping) mean something else.
// Exposure and Clarity kept their scale, so their 2010 keys are read too.
export const MAPPING_TABLE: ParameterMapping[] = [
  { lrKeys: ["Exposure2012", "Exposure"], safelightKey: "exposure", transform: within(-5, 5) },
  { lrKeys: ["Contrast2012"], safelightKey: "contrast", transform: SLIDER },
  { lrKeys: ["Highlights2012"], safelightKey: "highlights", transform: SLIDER },
  { lrKeys: ["Shadows2012"], safelightKey: "shadows", transform: SLIDER },
  { lrKeys: ["Whites2012"], safelightKey: "whites", transform: SLIDER },
  { lrKeys: ["Blacks2012"], safelightKey: "blacks", transform: SLIDER },
  { lrKeys: ["Texture"], safelightKey: "texture", transform: SLIDER },
  { lrKeys: ["Clarity2012", "Clarity"], safelightKey: "clarity", transform: SLIDER },
  { lrKeys: ["Dehaze"], safelightKey: "dehaze", transform: SLIDER },
  { lrKeys: ["Vibrance"], safelightKey: "vibrance", transform: SLIDER },
  { lrKeys: ["Saturation"], safelightKey: "saturation", transform: SLIDER },
  { lrKeys: ["Temperature"], safelightKey: "temperature", transform: kelvin },
  { lrKeys: ["Tint"], safelightKey: "tint", transform: within(-150, 150) },
  { lrKeys: ["Sharpness"], safelightKey: "sharpening", transform: AMOUNT },
  { lrKeys: ["SharpenRadius"], safelightKey: "sharpenRadius", transform: within(1, 3) },
  { lrKeys: ["SharpenDetail"], safelightKey: "sharpenDetail", transform: AMOUNT },
  { lrKeys: ["SharpenEdgeMasking"], safelightKey: "sharpenMasking", transform: AMOUNT },
  { lrKeys: ["LuminanceSmoothing"], safelightKey: "luminanceNR", transform: AMOUNT },
  {
    lrKeys: ["LuminanceNoiseReductionDetail"],
    safelightKey: "luminanceNRDetail",
    transform: AMOUNT,
  },
  {
    lrKeys: ["LuminanceNoiseReductionContrast"],
    safelightKey: "luminanceNRContrast",
    transform: AMOUNT,
  },
  { lrKeys: ["ColorNoiseReduction"], safelightKey: "colorNR", transform: AMOUNT },
  { lrKeys: ["ColorNoiseReductionDetail"], safelightKey: "colorNRDetail", transform: AMOUNT },
  {
    lrKeys: ["ColorNoiseReductionSmoothness"],
    safelightKey: "colorNRSmoothness",
    transform: AMOUNT,
  },
];
