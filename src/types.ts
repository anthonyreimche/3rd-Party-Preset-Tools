export interface CurvePoint {
  x: number;
  y: number;
}

export interface ToneCurves {
  rgb: CurvePoint[];
  red: CurvePoint[];
  green: CurvePoint[];
  blue: CurvePoint[];
}

export interface HSLValues {
  red: number;
  orange: number;
  yellow: number;
  green: number;
  aqua: number;
  blue: number;
  purple: number;
  magenta: number;
}

export interface HSLAdjustments {
  hue: HSLValues;
  saturation: HSLValues;
  luminance: HSLValues;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TransformParams {
  perspectiveV: number;
  perspectiveH: number;
  aspect: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  flipH: boolean;
  flipV: boolean;
}

export interface ColorGradingRange {
  hue: number;
  sat: number;
  luma: number;
}

export interface ColorGradingParams {
  shadows: ColorGradingRange;
  midtones: ColorGradingRange;
  highlights: ColorGradingRange;
  global: ColorGradingRange;
  shadowRange: number;
  highlightRange: number;
}

export interface LensCorrectionParams {
  mode: "off" | "profile" | "manual";
  profileId: string | null;
  profileSource: "lensfun" | "extension" | null;
  distortionEnabled: boolean;
  caEnabled: boolean;
  vignetteEnabled: boolean;
  autoCrop: boolean;
  distortion: number;
  chromaticAberration: number;
  defringe: number;
  vignetting: number;
}

export interface VignetteParams {
  amount: number;
  midpoint: number;
  roundness: number;
  feather: number;
  highlights: number;
}

export interface GrainParams {
  amount: number;
  size: number;
  roughness: number;
  color: number;
}

export interface DevelopParams {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  texture: number;
  clarity: number;
  dehaze: number;
  sharpening: number;
  sharpenRadius: number;
  sharpenDetail: number;
  sharpenMasking: number;
  luminanceNR: number;
  luminanceNRDetail: number;
  luminanceNRContrast: number;
  luminanceNRShadows: number;
  luminanceNRHighlights: number;
  colorNR: number;
  colorNRDetail: number;
  colorNRSmoothness: number;
  vibrance: number;
  saturation: number;
  temperature: number;
  tint: number;
  straighten: number;
  crop: CropRect;
  transform: TransformParams;
  uprightMode: string;
  guidedLines: unknown[];
  toneCurve: ToneCurves;
  hsl: HSLAdjustments;
  colorGrading: ColorGradingParams;
  lensCorrection: LensCorrectionParams;
  vignette: VignetteParams;
  grain: GrainParams;
  masks: unknown[];
  retouch: unknown[];
}
