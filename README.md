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

| Lightroom Parameter | SafeLight Field | Status |
|---|---|---|
| Exposure | exposure | ✅ |
| Contrast | contrast | ✅ |
| Highlights | highlights | ✅ |
| Shadows | shadows | ✅ |
| Whites | whites | ✅ |
| Blacks | blacks | ✅ |
| Texture | texture | ✅ |
| Clarity | clarity | ✅ |
| Dehaze | dehaze | ✅ |
| Vibrance | vibrance | ✅ |
| Saturation | saturation | ✅ |
| Temperature | temperature | ✅ |
| Tint | tint | ✅ |
| Sharpening | sharpening | ✅ |
| Luminance NR | luminanceNR | ✅ |
| Color NR | colorNR | ✅ |
| HSL Mixer (8 channels) | hsl | ✅ |
| Vignette | vignette | ✅ |
| Grain | grain | ✅ |

## Unsupported Lightroom Parameters

The following Lightroom features have no SafeLight equivalent and are **silently skipped**:

- **Camera Profiles** — SafeLight doesn't yet have a camera profile system (see [issue #21](https://github.com/anthonyreimche/safelight/issues/21))
- **Lens Profiles** — Lens correction profiles are planned but not yet implemented
- **Automatic Lateral CA** — Automatic chromatic aberration correction
- **Color Grade (split toning)** — Lightroom's split-toning UI doesn't map cleanly to SafeLight's color grading wheels
- **Process Version** — Lightroom-internal; ignored
- **Custom Camera Models** — Lightroom-internal; ignored

These presets will still import successfully — they'll just be missing those adjustments.

## Parameter Mapping Details

### Temperature

Lightroom stores absolute temperature in Kelvin (2000–50000; 6500 = daylight neutral).
SafeLight uses a relative adjustment (-100 to +100). The importer converts:

- Lightroom 6500 K → SafeLight 0 (neutral)
- Lightroom 7000 K → SafeLight +7.7 (warmer)
- Lightroom 5000 K → SafeLight -23 (cooler)

### Exposure

Lightroom: -5 to +5 EV  
SafeLight: -200 to +200  
Conversion: Lightroom × 100

### HSL Mixer

Lightroom encodes 8 color bands (Red, Orange, Yellow, Green, Aqua, Blue, Purple, Magenta) with independent Hue, Saturation, and Luminance adjustments.

SafeLight's HSL adjustments match this structure exactly and are directly transferred.

### Vignette & Grain

Basic vignette amount and grain amount are transferred. More advanced parameters (feather shape, edge hardness) use SafeLight defaults.

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

### Temperature conversion seems wrong

SafeLight uses a different temperature scale than Lightroom. If you imported a preset with Lightroom 7000 K and it looks too cool, manually tweak the temperature slider in SafeLight.

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
│   ├── mapping-table.ts    # 70+ parameter mappings
│   ├── param-mapper.ts     # Core conversion logic
│   └── special-cases.ts    # HSL, vignette, grain, etc.
├── utils/
│   └── numeric.ts          # Clamp, scale, safe parsing
└── types.ts                # DevelopParams (mirrors SafeLight)
```

### Adding New Mappings

Edit `src/mappers/mapping-table.ts`:

```typescript
{
  lrKeys: ["MyNewLightroomParam"],
  safelightKey: "myNewSafelightField",
  transform: (v) => clampToRange(v, -100, 100),
  comment: "Description of what this does",
}
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

**Version**: 1.0.0  
**SafeLight Minimum Version**: 2.1.0  
**Author**: Anthony
