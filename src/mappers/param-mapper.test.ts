import { describe, it, expect } from "vitest";
import { mapLightroomToDevelopParams } from "./param-mapper";

// Lightroom writes slider values as they read in its UI: exposure in EV, most
// sliders on ±100, temperature in Kelvin. Safelight uses the same scales, so
// values pass through, clamped to Safelight's ranges.
const map = async (settings: Record<string, unknown>) =>
  (await mapLightroomToDevelopParams({ name: "Test", settings }))!.params;

describe("Parameter Mapper", () => {
  it("returns the preset name with its params", async () => {
    const result = await mapLightroomToDevelopParams({
      name: "Warm Matte",
      settings: { Exposure2012: 0.5 },
    });
    expect(result).toEqual({ name: "Warm Matte", params: { exposure: 0.5 } });
  });

  it("passes exposure through in EV, clamped to ±5", async () => {
    expect(await map({ Exposure2012: 0.35 })).toEqual({ exposure: 0.35 });
    expect(await map({ Exposure2012: -7 })).toEqual({ exposure: -5 });
  });

  it("passes the ±100 tone and presence sliders through", async () => {
    const params = await map({
      Contrast2012: 12,
      Highlights2012: -45,
      Shadows2012: 30,
      Whites2012: 8,
      Blacks2012: -12,
      Texture: 10,
      Clarity2012: 15,
      Dehaze: 5,
      Vibrance: 20,
      Saturation: -5,
    });
    expect(params).toEqual({
      contrast: 12,
      highlights: -45,
      shadows: 30,
      whites: 8,
      blacks: -12,
      texture: 10,
      clarity: 15,
      dehaze: 5,
      vibrance: 20,
      saturation: -5,
    });
  });

  it("clamps sliders to Safelight's ranges", async () => {
    expect(await map({ Saturation: 500, Contrast2012: -500 })).toEqual({
      saturation: 100,
      contrast: -100,
    });
  });

  // Process 2010's Contrast (0..100, default 25) and Shadows (black clipping)
  // aren't the 2012 sliders under another name, so reading them would shift
  // the look.
  it("ignores Process 2010 tone keys whose meaning differs", async () => {
    expect(await map({ Contrast: 25, Shadows: 5 })).toEqual({});
  });

  it("keeps temperature in Kelvin within Safelight's 2000–50000 range", async () => {
    expect(await map({ Temperature: 5600, Tint: 8 })).toEqual({
      temperature: 5600,
      tint: 8,
    });
    expect(await map({ Temperature: 60000 })).toEqual({ temperature: 50000 });
  });

  // As Shot / Auto values are one photo's own white balance (a sidecar carries
  // them), not an adjustment to copy onto other photos.
  it("takes white balance only when the preset sets a custom one", async () => {
    expect(await map({ WhiteBalance: "Custom", Temperature: 5600, Tint: 8 })).toEqual({
      temperature: 5600,
      tint: 8,
    });
    expect(await map({ WhiteBalance: "As Shot", Temperature: 5200, Tint: 3 })).toEqual({});
    expect(await map({ WhiteBalance: "Auto", Temperature: 4900, Tint: -2 })).toEqual({});
  });

  it("ignores a temperature below Lightroom's 2000 K floor rather than clamping it", async () => {
    expect(await map({ Temperature: 20 })).toEqual({});
  });

  it("reads Lightroom's detail key names", async () => {
    const params = await map({
      Sharpness: 40,
      SharpenRadius: 1.2,
      SharpenDetail: 25,
      SharpenEdgeMasking: 30,
      LuminanceSmoothing: 15,
      LuminanceNoiseReductionDetail: 50,
      LuminanceNoiseReductionContrast: 10,
      ColorNoiseReduction: 25,
      ColorNoiseReductionDetail: 50,
      ColorNoiseReductionSmoothness: 60,
    });
    expect(params).toEqual({
      sharpening: 40,
      sharpenRadius: 1.2,
      sharpenDetail: 25,
      sharpenMasking: 30,
      luminanceNR: 15,
      luminanceNRDetail: 50,
      luminanceNRContrast: 10,
      colorNR: 25,
      colorNRDetail: 50,
      colorNRSmoothness: 60,
    });
  });

  it("clamps sharpening to Safelight's 0–100 amount and 1–3 radius", async () => {
    expect(await map({ Sharpness: 150, SharpenRadius: 0.5 })).toEqual({
      sharpening: 100,
      sharpenRadius: 1,
    });
  });

  it("reads HSL luminance from the colour mixer, not the B&W mixer", async () => {
    const params = await map({
      HueAdjustmentRed: 10,
      SaturationAdjustmentGreen: -20,
      LuminanceAdjustmentBlue: -20,
      GrayMixerBlue: 30,
    });
    expect(params.hsl?.hue.red).toBe(10);
    expect(params.hsl?.saturation.green).toBe(-20);
    expect(params.hsl?.luminance.blue).toBe(-20);
    expect(params.hsl?.hue.magenta).toBe(0);
  });

  it("maps all 8 HSL channels", async () => {
    const params = await map({
      HueAdjustmentRed: 1,
      HueAdjustmentOrange: 2,
      HueAdjustmentYellow: 3,
      HueAdjustmentGreen: 4,
      HueAdjustmentAqua: 5,
      HueAdjustmentBlue: 6,
      HueAdjustmentPurple: 7,
      HueAdjustmentMagenta: 8,
    });
    expect(params.hsl?.hue).toEqual({
      red: 1,
      orange: 2,
      yellow: 3,
      green: 4,
      aqua: 5,
      blue: 6,
      purple: 7,
      magenta: 8,
    });
  });

  it("maps the post-crop vignette, not lens vignetting correction", async () => {
    const params = await map({
      VignetteAmount: 40,
      PostCropVignetteAmount: -15,
      PostCropVignetteMidpoint: 35,
      PostCropVignetteRoundness: 20,
      PostCropVignetteFeather: 70,
      PostCropVignetteHighlightContrast: 10,
    });
    expect(params).toEqual({
      vignette: { amount: -15, midpoint: 35, roundness: 20, feather: 70, highlights: 10 },
    });
  });

  it("passes grain through on Lightroom's scale", async () => {
    expect(await map({ GrainAmount: 20, GrainSize: 40, GrainFrequency: 70 })).toEqual({
      grain: { amount: 20, size: 40, roughness: 70, color: 0 },
    });
  });

  it("maps tone curves from 0–255 points to 0–1", async () => {
    const params = await map({
      ToneCurvePV2012: [
        [0, 24],
        [255, 245],
      ],
      ToneCurvePV2012Blue: [
        [0, 0],
        [128, 140],
        [255, 255],
      ],
    });
    expect(params.toneCurve).toEqual({
      rgb: [
        { x: 0, y: 24 / 255 },
        { x: 1, y: 245 / 255 },
      ],
      red: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      green: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      blue: [
        { x: 0, y: 0 },
        { x: 128 / 255, y: 140 / 255 },
        { x: 1, y: 1 },
      ],
    });
  });

  // Lightroom keeps writing shadow/highlight hue and saturation under the old
  // split-toning names alongside the newer ColorGrade keys.
  it("maps colour grading from the split-toning and ColorGrade keys", async () => {
    const params = await map({
      SplitToningShadowHue: 210,
      SplitToningShadowSaturation: 12,
      SplitToningHighlightHue: 40,
      SplitToningHighlightSaturation: 18,
      ColorGradeShadowLum: -5,
      ColorGradeMidtoneHue: 30,
      ColorGradeMidtoneSat: 6,
      ColorGradeGlobalLum: 4,
    });
    expect(params.colorGrading).toEqual({
      shadows: { hue: 210, sat: 12, luma: -5 },
      midtones: { hue: 30, sat: 6, luma: 0 },
      highlights: { hue: 40, sat: 18, luma: 0 },
      global: { hue: 0, sat: 0, luma: 4 },
      shadowRange: 50,
      highlightRange: 50,
    });
  });

  it("prefers ColorGrade hue and saturation over split toning", async () => {
    const params = await map({
      SplitToningShadowHue: 210,
      ColorGradeShadowHue: 200,
      ColorGradeShadowSat: 15,
    });
    expect(params.colorGrading?.shadows).toEqual({ hue: 200, sat: 15, luma: 0 });
  });

  // Safelight has no black-and-white mode; full desaturation is the nearest
  // look (Lightroom's B&W mixer weights aren't reproduced).
  it("renders a black-and-white preset fully desaturated", async () => {
    expect(await map({ ConvertToGrayscale: true, Saturation: 20 })).toEqual({
      saturation: -100,
    });
  });

  it("ignores parameters Safelight has no equivalent for", async () => {
    expect(
      await map({ CameraProfile: "Adobe Standard", LensProfileName: "Some Lens", Exposure2012: 0.5 }),
    ).toEqual({ exposure: 0.5 });
  });
});
