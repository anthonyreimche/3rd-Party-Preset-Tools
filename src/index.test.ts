import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { activate } from "./index";

type Importer = Parameters<Parameters<typeof activate>[0]["registerPresetImporter"]>[0];

function registeredImporter(): Importer {
  const importers: Importer[] = [];
  activate({
    version: 1,
    extensionId: "lightroom-preset-importer",
    registerPresetImporter: (c) => importers.push(c),
  });
  expect(importers).toHaveLength(1);
  return importers[0];
}

const fixture = (name: string): File =>
  new File([readFileSync(resolve(__dirname, "__fixtures__", name))], name);

const IDENTITY = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
];

describe("Lightroom .xmp preset import", () => {
  it("brings a Lightroom Classic preset across on Safelight's own scales", async () => {
    const result = await registeredImporter().parse(fixture("warm-matte.xmp"));

    expect(result).toEqual({
      name: "Warm Matte",
      params: {
        exposure: 0.35,
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
        temperature: 5600,
        tint: 8,
        sharpening: 40,
        sharpenRadius: 1,
        sharpenDetail: 25,
        sharpenMasking: 30,
        luminanceNR: 15,
        luminanceNRDetail: 50,
        luminanceNRContrast: 0,
        colorNR: 25,
        colorNRDetail: 50,
        colorNRSmoothness: 50,
        hsl: {
          hue: { red: 0, orange: -6, yellow: 0, green: 20, aqua: 0, blue: -10, purple: 0, magenta: 0 },
          saturation: { red: 0, orange: 10, yellow: 0, green: -30, aqua: 0, blue: -15, purple: 0, magenta: 0 },
          luminance: { red: 0, orange: 8, yellow: 0, green: -10, aqua: 0, blue: -20, purple: 0, magenta: 0 },
        },
        toneCurve: {
          rgb: [
            { x: 0, y: 24 / 255 },
            { x: 64 / 255, y: 60 / 255 },
            { x: 192 / 255, y: 200 / 255 },
            { x: 1, y: 245 / 255 },
          ],
          red: IDENTITY,
          green: IDENTITY,
          blue: IDENTITY,
        },
        colorGrading: {
          shadows: { hue: 210, sat: 12, luma: 0 },
          midtones: { hue: 0, sat: 0, luma: 0 },
          highlights: { hue: 40, sat: 18, luma: 0 },
          global: { hue: 0, sat: 0, luma: 0 },
          shadowRange: 50,
          highlightRange: 50,
        },
        vignette: { amount: -15, midpoint: 50, roundness: 0, feather: 50, highlights: 0 },
        grain: { amount: 20, size: 25, roughness: 50, color: 0 },
      },
    });
  });
});

describe("Lightroom .lrtemplate preset import", () => {
  it("brings the point curve across with the sliders", async () => {
    const result = await registeredImporter().parse(fixture("medium-contrast.lrtemplate"));

    expect(result).toEqual({
      name: "Medium Contrast Curve",
      params: {
        exposure: 0.25,
        contrast: 10,
        toneCurve: {
          rgb: [
            { x: 0, y: 0 },
            { x: 32 / 255, y: 22 / 255 },
            { x: 64 / 255, y: 56 / 255 },
            { x: 128 / 255, y: 128 / 255 },
            { x: 192 / 255, y: 196 / 255 },
            { x: 1, y: 1 },
          ],
          red: IDENTITY,
          green: IDENTITY,
          blue: IDENTITY,
        },
      },
    });
  });
});
