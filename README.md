# 3rd-Party Preset Importer for SafeLight

This extension teaches SafeLight's Presets panel to import Adobe Lightroom presets in `.xmp` and `.lrtemplate` formats. It automatically maps Lightroom's editing parameters to SafeLight's DevelopParams structure, making it easy for Lightroom users to bring their preset libraries into SafeLight.

## Features

- **Import `.xmp` files** — Adobe Camera Raw setting sidecars from Lightroom Classic 8+
- **Import `.lrtemplate` files** — Legacy Lightroom Classic presets (pre-2018)
- **Automatic parameter mapping** — 25+ core adjustments automatically converted
- **Partial presets** — Imported presets behave like SafeLight partial presets (merge over current params, not override)
- **HSL mixer support** — Color channel adjustments (Hue, Saturation, Luminance) from Lightroom's mixer
- **Vignette & grain** — Post-processing effects converted where possible
- **Graceful degradation** — Unsupported Lightroom parameters are silently skipped

## Installation

This extension is part of the "3rd-Party Preset Tools for SafeLight" extension bundle. Install it via the Extensions panel:

1. **Preferences** → **Extensions**
2. Install the extension from GitHub (owner/repo format)
3. The extension activates automatically

## Usage

### Importing Presets

1. Open the **Develop module**
2. Go to the **Presets panel** (right sidebar)
3. Click the **Import** button
4. Select one or more `.xmp` or `.lrtemplate` files
5. Select a preset from the list to apply it to the current photo

### Keyboard Shortcut

(Future: add a keyboard shortcut for quick import)

## Supported Lightroom Parameters

The following Lightroom adjustments map to SafeLight parameters:

| Lightroom Parameter | Lightroom key(s) | SafeLight Field |
|---|---|---|
| Exposure | `Exposure2012` | exposure |
| Contrast, Highlights, Shadows, Whites, Blacks | `Contrast2012` … `Blacks2012` | contrast … blacks |
| Texture, Clarity, Dehaze | `Texture`, `Clarity2012`, `Dehaze` | texture, clarity, dehaze |
| Vibrance, Saturation | `Vibrance`, `Saturation` | vibrance, saturation |
| Temperature, Tint (custom white balance only) | `Temperature`, `Tint` | temperature, tint |
| Sharpening (amount, radius, detail, masking) | `Sharpness`, `SharpenRadius`, `SharpenDetail`, `SharpenEdgeMasking` | sharpening … sharpenMasking |
| Noise Reduction (luminance, detail, contrast; color, detail, smoothness) | `LuminanceSmoothing`, `LuminanceNoiseReduction*`, `ColorNoiseReduction*` | luminanceNR …, colorNR … |
| HSL / Color mixer (8 channels) | `HueAdjustment*`, `SaturationAdjustment*`, `LuminanceAdjustment*` | hsl |
| Tone curve (point curve, R, G, B) | `ToneCurvePV2012`, `ToneCurvePV2012Red/Green/Blue` | toneCurve |
| Color grading (shadows, midtones, highlights, global) | `ColorGrade*`, `SplitToning*` | colorGrading |
| Post-crop vignette | `PostCropVignette*` | vignette |
| Grain | `GrainAmount`, `GrainSize`, `GrainFrequency` | grain |
| Black & White | `ConvertToGrayscale` | saturation −100 |

## Unsupported Lightroom Parameters

The following Lightroom features have no SafeLight equivalent and are **silently skipped**:

- **Camera Profiles** — including the profile embedded in a preset (`crs:Look`)
- **Lens Profiles** and **lens vignetting correction** (`VignetteAmount`)
- **Automatic Lateral CA** — Automatic chromatic aberration correction
- **B&W mix** (`GrayMixer*`) — a black-and-white preset imports fully desaturated
- **Color grading Blending and Balance** — SafeLight's shadow/highlight ranges keep their defaults
- **Relative white balance for JPEGs** (`IncrementalTemperature`, `IncrementalTint`)
- **Masks, crop, and transform**
- **Process Version** — Lightroom-internal; ignored
- **Custom Camera Models** — Lightroom-internal; ignored

These presets will still import successfully — they'll just be missing those adjustments.

## Parameter Mapping Details

Lightroom writes each slider as it reads in its own UI, and SafeLight's sliders use the same scales, so values transfer unchanged and are only clamped to SafeLight's ranges:

- **Exposure** — EV, −5 to +5.
- **Temperature** — Kelvin, 2000 to 50000; **Tint** −150 to +150.
- **Tone, presence, HSL** — −100 to +100.
- **Sharpening amount** — Lightroom goes to 150, SafeLight to 100; radius is clamped to SafeLight's 1–3.
- **Grain size** — SafeLight's smallest grain is 25 (Lightroom's default).
- **Tone curves** — Lightroom's 0–255 points become SafeLight's 0–1 points.

Only Process 2012 keys are read for the tone sliders: the older Process 2010 Contrast (0–100, default 25) and Shadows (black clipping) mean something different.

White balance transfers only when the preset sets a custom one. As Shot and Auto store one photo's own white balance (an `.xmp` sidecar carries them), so importing a sidecar as a preset leaves each photo's white balance alone.

## File Format Details

### `.xmp` (XML)

Adobe Camera Raw metadata sidecar. Standard XML with the `crs:` namespace:

```xml
<?xml version="1.0"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF>
    <rdf:Description
      xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"
      crs:Exposure="0.5"
      crs:Saturation="-20"
      ...
    />
  </rdf:RDF>
</x:xmpmeta>
```

### `.lrtemplate` (Lua Table)

Lightroom preset file format (legacy). Plain text containing a Lua table:

```lua
{
  id = "1234567890ABCDEF",
  title = "Preset Name",
  Exposure = 0.5,
  Contrast = 1.2,
  Saturation = -20,
  -- ...
}
```

The importer uses regex-based extraction (no full Lua parser), so it handles the common cases robustly.

## Troubleshooting

### Preset imports but looks different from Lightroom

SafeLight and Lightroom use different rendering pipelines, tone curves, and color spaces. A preset that looks identical in Lightroom may render slightly differently in SafeLight. This is normal and expected.

### Some adjustments are missing from the imported preset

Check the browser console (`Cmd+Opt+I` on Mac, `Ctrl+Shift+I` on Windows) for a list of skipped parameters. If you see a Lightroom parameter that SafeLight does support, file an issue with the preset file.

### File won't import (returns null)

- Ensure the file is a valid `.xmp` (well-formed XML) or `.lrtemplate` (valid Lua subset)
- Check the browser console for parse errors
- Try opening the file in a text editor to verify format

## Development

### Build

```bash
npm install
npm run build
```

Output: `dist/index.js`

### Testing

```bash
npm test
```

### Project Structure

```
src/
├── index.ts                 # Extension entry point
├── parsers/
│   ├── xmp-parser.ts       # XML DOMParser
│   ├── lrtemplate-parser.ts # Lua regex extraction
│   └── parser-types.ts     # Shared interfaces
├── mappers/
│   ├── mapping-table.ts    # Scalar slider mappings
│   └── param-mapper.ts     # Conversion, plus HSL, curves, grading, vignette, grain
├── utils/
│   └── numeric.ts          # Clamp, scale, safe parsing
└── types.ts                # DevelopParams (mirrors SafeLight)
```

### Adding New Mappings

Edit `src/mappers/mapping-table.ts`:

```typescript
{ lrKeys: ["MyNewLightroomParam"], safelightKey: "myNewSafelightField", transform: within(-100, 100) },
```

Then run `npm test` to verify.

## License

MIT

## Contributing

Contributions welcome. If you encounter a Lightroom preset that doesn't import correctly, please file an issue with:

1. The preset file (or a minimal example)
2. Browser console output
3. Expected vs. actual result

---

**Version**: 1.1.0  
**SafeLight Minimum Version**: 2.1.0  
**Author**: Anthony
