import { DevelopParams } from "../types";
import { LightroomPreset } from "../parsers/parser-types";
import { MAPPING_TABLE } from "./mapping-table";

export async function mapLightroomToDevelopParams(
  lrPreset: LightroomPreset,
): Promise<{
  name: string;
  params: Partial<DevelopParams>;
} | null> {
  const params: Partial<DevelopParams> = {};

  for (const mapping of MAPPING_TABLE) {
    const lrKey = mapping.lrKeys.find((k) => k in lrPreset.settings);
    if (!lrKey) continue;

    const lrValue = lrPreset.settings[lrKey];

    let safelightValue: number | null;
    if (mapping.transform) {
      safelightValue = mapping.transform(lrValue);
    } else {
      safelightValue = null;
    }

    if (safelightValue === null) continue;

    params[mapping.safelightKey] = safelightValue;
  }

  mapHSLAdjustments(params, lrPreset.settings);
  mapVignetteParams(params, lrPreset.settings);
  mapGrainParams(params, lrPreset.settings);

  return {
    name: lrPreset.name,
    params,
  };
}

function mapHSLAdjustments(params: Partial<DevelopParams>, lrSettings: Record<string, unknown>): void {
  const hsl: Partial<{
    hue: Record<string, number>;
    saturation: Record<string, number>;
    luminance: Record<string, number>;
  }> = {};

  const channels = ["Red", "Orange", "Yellow", "Green", "Aqua", "Blue", "Purple", "Magenta"];
  const channelKeys = ["red", "orange", "yellow", "green", "aqua", "blue", "purple", "magenta"];

  for (let i = 0; i < channels.length; i++) {
    const channel = channels[i];
    const key = channelKeys[i];

    const hueKey = `HueAdjustment${channel}`;
    const satKey = `SaturationAdjustment${channel}`;
    const lumKey = `GrayMixer${channel}`;

    const hasAny = hueKey in lrSettings || satKey in lrSettings || lumKey in lrSettings;
    if (!hasAny) continue;

    if (hueKey in lrSettings) {
      if (!hsl.hue) hsl.hue = {};
      const n = parseFloat(String(lrSettings[hueKey]));
      hsl.hue[key] = isNaN(n) ? 0 : Math.max(-180, Math.min(180, n));
    }

    if (satKey in lrSettings) {
      if (!hsl.saturation) hsl.saturation = {};
      const n = parseFloat(String(lrSettings[satKey]));
      hsl.saturation[key] = isNaN(n) ? 0 : Math.max(-100, Math.min(100, n));
    }

    if (lumKey in lrSettings) {
      if (!hsl.luminance) hsl.luminance = {};
      const n = parseFloat(String(lrSettings[lumKey]));
      hsl.luminance[key] = isNaN(n) ? 0 : Math.max(-100, Math.min(100, n));
    }
  }

  if (Object.keys(hsl).length > 0) {
    const defaultHSL = {
      hue: {
        red: 0,
        orange: 0,
        yellow: 0,
        green: 0,
        aqua: 0,
        blue: 0,
        purple: 0,
        magenta: 0,
      },
      saturation: {
        red: 0,
        orange: 0,
        yellow: 0,
        green: 0,
        aqua: 0,
        blue: 0,
        purple: 0,
        magenta: 0,
      },
      luminance: {
        red: 0,
        orange: 0,
        yellow: 0,
        green: 0,
        aqua: 0,
        blue: 0,
        purple: 0,
        magenta: 0,
      },
    };

    // Deep-merge each section so untouched channels keep their 0 defaults.
    // A shallow `{ ...defaultHSL, ...hsl }` would replace an entire section
    // (e.g. `hue`) with the partial map, dropping the other channels.
    params.hsl = {
      hue: { ...defaultHSL.hue, ...(hsl.hue ?? {}) },
      saturation: { ...defaultHSL.saturation, ...(hsl.saturation ?? {}) },
      luminance: { ...defaultHSL.luminance, ...(hsl.luminance ?? {}) },
    };
  }
}

function mapVignetteParams(params: Partial<DevelopParams>, lrSettings: Record<string, unknown>): void {
  const vignette: Partial<{
    amount: number;
    midpoint: number;
    roundness: number;
    feather: number;
    highlights: number;
  }> = {};

  const amountKey = "VignetteAmount";
  const midpointKey = "VignetteMidpoint";
  const roundnessKey = "VignetteRoundness";

  if (amountKey in lrSettings) {
    const n = parseFloat(String(lrSettings[amountKey]));
    vignette.amount = isNaN(n) ? 0 : Math.max(-100, Math.min(100, n));
  }

  if (midpointKey in lrSettings) {
    const n = parseFloat(String(lrSettings[midpointKey]));
    vignette.midpoint = isNaN(n) ? 50 : Math.max(0, Math.min(100, n));
  }

  if (roundnessKey in lrSettings) {
    const n = parseFloat(String(lrSettings[roundnessKey]));
    vignette.roundness = isNaN(n) ? 0 : Math.max(-100, Math.min(100, n));
  }

  if (Object.keys(vignette).length > 0) {
    params.vignette = {
      amount: vignette.amount ?? 0,
      midpoint: vignette.midpoint ?? 50,
      roundness: vignette.roundness ?? 0,
      feather: 50,
      highlights: 0,
    };
  }
}

function mapGrainParams(params: Partial<DevelopParams>, lrSettings: Record<string, unknown>): void {
  const grain: Partial<{
    amount: number;
    size: number;
    roughness: number;
    color: number;
  }> = {};

  const amountKey = "GrainAmount";
  const sizeKey = "GrainSize";
  const roughnessKey = "GrainFrequency";

  if (amountKey in lrSettings) {
    const n = parseFloat(String(lrSettings[amountKey]));
    grain.amount = isNaN(n) ? 0 : Math.max(0, Math.min(100, n));
  }

  if (sizeKey in lrSettings) {
    const n = parseFloat(String(lrSettings[sizeKey]));
    grain.size = isNaN(n) ? 25 : Math.max(25, Math.min(100, n * 25));
  }

  if (roughnessKey in lrSettings) {
    const n = parseFloat(String(lrSettings[roughnessKey]));
    grain.roughness = isNaN(n) ? 50 : Math.max(0, Math.min(100, n * 100));
  }

  if (Object.keys(grain).length > 0) {
    params.grain = {
      amount: grain.amount ?? 0,
      size: grain.size ?? 25,
      roughness: grain.roughness ?? 50,
      color: 0,
    };
  }
}
