import { describe, it, expect } from "vitest";
import { mapLightroomToDevelopParams } from "./param-mapper";
import { LightroomPreset } from "../parsers/parser-types";

describe("Parameter Mapper", () => {
  it("maps basic exposure and contrast", async () => {
    const preset: LightroomPreset = {
      name: "Test Preset",
      settings: {
        Exposure: 0.5,
        Contrast: 0.25,
      },
    };

    const result = await mapLightroomToDevelopParams(preset);

    expect(result?.name).toBe("Test Preset");
    expect(result?.params.exposure).toBe(50);
    expect(result?.params.contrast).toBe(25);
  });

  it("clamps values to valid ranges", async () => {
    const preset: LightroomPreset = {
      name: "Clamp Test",
      settings: {
        Saturation: 500,
        Contrast: -500,
      },
    };

    const result = await mapLightroomToDevelopParams(preset);

    expect(result?.params.saturation).toBe(100);
    expect(result?.params.contrast).toBe(-100);
  });

  it("maps temperature from Kelvin to relative", async () => {
    const preset: LightroomPreset = {
      name: "Temperature Test",
      settings: {
        Temperature: 6500,
      },
    };

    const result = await mapLightroomToDevelopParams(preset);

    expect(result?.params.temperature).toBeCloseTo(0, 0);
  });

  it("maps HSL adjustments for 8 color channels", async () => {
    const preset: LightroomPreset = {
      name: "HSL Test",
      settings: {
        HueAdjustmentRed: 10,
        SaturationAdjustmentGreen: -20,
        GrayMixerBlue: 30,
      },
    };

    const result = await mapLightroomToDevelopParams(preset);

    expect(result?.params.hsl?.hue.red).toBe(10);
    expect(result?.params.hsl?.saturation.green).toBe(-20);
    expect(result?.params.hsl?.luminance.blue).toBe(30);
  });

  it("maps vignette parameters", async () => {
    const preset: LightroomPreset = {
      name: "Vignette Test",
      settings: {
        VignetteAmount: -25,
        VignetteMidpoint: 75,
      },
    };

    const result = await mapLightroomToDevelopParams(preset);

    expect(result?.params.vignette?.amount).toBe(-25);
    expect(result?.params.vignette?.midpoint).toBe(75);
  });

  it("maps grain parameters", async () => {
    const preset: LightroomPreset = {
      name: "Grain Test",
      settings: {
        GrainAmount: 50,
        GrainSize: 2,
      },
    };

    const result = await mapLightroomToDevelopParams(preset);

    expect(result?.params.grain?.amount).toBe(50);
    expect(result?.params.grain?.size).toBe(50);
  });

  it("ignores unmapped parameters", async () => {
    const preset: LightroomPreset = {
      name: "Unmapped Test",
      settings: {
        Exposure: 0.5,
        CameraProfile: "Adobe Standard",
        LensProfileName: "Some Lens",
      },
    };

    const result = await mapLightroomToDevelopParams(preset);

    expect(result?.params.exposure).toBe(50);
    expect(result?.params).not.toHaveProperty("cameraProfile");
    expect(result?.params).not.toHaveProperty("lensProfileName");
  });

  it("handles missing transformation gracefully", async () => {
    const preset: LightroomPreset = {
      name: "No Transform",
      settings: {
        UnknownParam: "value",
      },
    };

    const result = await mapLightroomToDevelopParams(preset);

    expect(result?.params).toBeDefined();
    expect(Object.keys(result?.params || {}).length).toBeLessThanOrEqual(1);
  });

  it("returns complete object with name and params", async () => {
    const preset: LightroomPreset = {
      name: "Complete Test",
      settings: {
        Exposure: 0.5,
      },
    };

    const result = await mapLightroomToDevelopParams(preset);

    expect(result).toHaveProperty("name");
    expect(result).toHaveProperty("params");
    expect(typeof result?.name).toBe("string");
    expect(typeof result?.params).toBe("object");
  });

  it("maps all 8 HSL channels correctly", async () => {
    const preset: LightroomPreset = {
      name: "Full HSL",
      settings: {
        HueAdjustmentRed: 1,
        HueAdjustmentOrange: 2,
        HueAdjustmentYellow: 3,
        HueAdjustmentGreen: 4,
        HueAdjustmentAqua: 5,
        HueAdjustmentBlue: 6,
        HueAdjustmentPurple: 7,
        HueAdjustmentMagenta: 8,
      },
    };

    const result = await mapLightroomToDevelopParams(preset);

    expect(result?.params.hsl?.hue.red).toBe(1);
    expect(result?.params.hsl?.hue.orange).toBe(2);
    expect(result?.params.hsl?.hue.yellow).toBe(3);
    expect(result?.params.hsl?.hue.green).toBe(4);
    expect(result?.params.hsl?.hue.aqua).toBe(5);
    expect(result?.params.hsl?.hue.blue).toBe(6);
    expect(result?.params.hsl?.hue.purple).toBe(7);
    expect(result?.params.hsl?.hue.magenta).toBe(8);
  });
});
