# Development Guide: Lightroom Preset Importer

This document covers the architecture, testing, and extension patterns for the Lightroom Preset Importer extension.

## Quick Start

```bash
npm install
npm run build      # Build the extension
npm test          # Run tests
npm run dev       # Watch mode for development
```

Output: `dist/index.js` (the ESM bundle SafeLight loads)

## Architecture Overview

The extension is structured in three layers:

### 1. **Parsers** (`src/parsers/`)

Convert raw file formats into a unified `LightroomPreset` structure.

- **xmp-parser.ts**: Parse XML Camera Raw settings using DOMParser
  - Input: `.xmp` File
  - Output: `{ name, settings }`
  - Extracts `crs:*` attributes from rdf:Description elements

- **lrtemplate-parser.ts**: Parse Lua-like table syntax with regex
  - Input: `.lrtemplate` File
  - Output: `{ name, settings }`
  - Uses multiple regexes for strings, numbers, booleans
  - No full Lua interpreter needed

### 2. **Mappers** (`src/mappers/`)

Convert `LightroomPreset.settings` into SafeLight's `DevelopParams`.

- **mapping-table.ts**: Declarative definition of 25+ parameter mappings
  - Each mapping: Lightroom key(s) → SafeLight field + transformation
  - Transformations handle range conversion, clamping, scale
  - Special cases documented inline

- **param-mapper.ts**: Core conversion logic
  - Iterate through mappings, apply transformations
  - Handle special structures: HSL, vignette, grain
  - Return `{ name, params }`

### 3. **Entry Point** (`src/index.ts`)

Register with SafeLight's extension API.

- Implements `activate(api)` exported as default
- Calls `api.registerPresetImporter({...})`
- Routes file to correct parser based on extension
- Pipes parsed preset through mapper

## File Format Internals

### XMP Format

Adobe Camera Raw settings stored as XML attributes in the `crs:` namespace:

```xml
<rdf:Description rdf:about="Preset Name"
  xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"
  crs:Exposure="0.5"
  crs:Saturation="-20"
/>
```

**Parser strategy**: Use DOM querySelectorAll to find Description elements, iterate attributes, extract `crs:*` keys.

**Why not SAX?**: File sizes are small (< 10 KB typically), so DOM is fine. No streaming needed.

### LRTemplate Format

Lua table syntax (subset actually used by Lightroom):

```lua
{
  id = "uuid",
  title = "Preset Name",
  Exposure = 0.5,
  Contrast = 1.2,
  Saturation = -20,
  settings = {
    -- nested settings (not used for basic presets)
  }
}
```

**Parser strategy**: Regex-based extraction (no full Lua parser)

```typescript
// Pattern: key = value (handles strings, numbers, booleans)
const pattern = /(\w+)\s*=\s*(["\']|[\d\-.]|-?true|false)/;
```

**Why not Lua.js or another parser?**
- Lightroom only uses a tiny subset (assignments, strings, numbers, booleans, ignore tables)
- A regex-based approach is 100x smaller and just as robust
- If a preset uses exotic Lua syntax, it silently fails (graceful degradation)

## Parameter Mapping Reference

### Single-Field Mappings (Straightforward)

```
Exposure2012/Exposure → exposure (×100 scale)
Contrast2012 → contrast (×100 scale)
Highlights2012 → highlights (×100 scale)
... (simple 1:1 conversions with clamp)
```

### Range-Converting Mappings (Rescale)

**Temperature** is the most complex example:

| LR Range | SL Range | Conversion |
|---|---|---|
| 2000–50000 K | -100 to +100 | `(kelvin - 6500) / 65` |
| 5500 K (cool) | -15.4 | |
| 6500 K (neutral) | 0 | |
| 7500 K (warm) | 15.4 | |

Other examples: Exposure (-5..+5 EV → -200..+200), Saturation (-100..+100 → -100..+100).

### Multi-Field Mappings (Special Cases)

#### HSL Adjustments

Lightroom encodes 8 channels × 3 properties (hue, saturation, luminance).

```
HueAdjustmentRed → hsl.hue.red
SaturationAdjustmentRed → hsl.saturation.red
GrayMixerRed → hsl.luminance.red
... (repeat for Orange, Yellow, Green, Aqua, Blue, Purple, Magenta)
```

SafeLight has the exact same structure, so the mapping is direct.

#### Vignette

Lightroom has: VignetteAmount, VignetteMidpoint, VignetteRoundness  
SafeLight has: amount, midpoint, roundness, feather, highlights

Mapping: Transfer available fields, use SafeLight defaults for missing ones.

#### Grain

Lightroom: GrainAmount, GrainSize, GrainFrequency  
SafeLight: amount, size, roughness, color

Mapping: Transfer available fields; GrainFrequency ≈ roughness.

### Unsupported Parameters

These LR parameters have no SafeLight equivalent:

- **CameraProfile** — No profile system yet (issue #21)
- **LensProfile** — Lens correction planned but not implemented
- **AutoLateralCA** — Automatic chromatic aberration correction
- **ColorGradeGlobalHue** — Partially supported via ColorGrading (skipped for now)
- **SplitToning*** — No 1:1 mapping to ColorGrading wheels
- **ProcessVersion** — Lightroom internal
- **CameraModelRestriction** — Lightroom internal

These are silently skipped with no error. See `getUnsupportedKeys()` in mapping-table.ts.

## Adding New Parameter Mappings

### 1. Identify the Lightroom Key

Find it in a sample .xmp or .lrtemplate file. For example: `Temperature`, `Clarity`, `GrainAmount`.

### 2. Identify the SafeLight Target

Check `src/types.ts` (mirrors `src/catalog/types.ts` from Safelight) for the exact field name and type.

### 3. Define the Transform Function

Create a transform that handles value conversion:

```typescript
// Simple clamp
function mapNormalized(v: unknown): number | null {
  const n = asNumber(v);
  if (n === null) return null;
  return clamp(n, -100, 100);
}

// Range conversion
function mapTemperature(v: unknown): number | null {
  const n = asNumber(v);
  if (n === null) return null;
  const kelvin = clamp(n, 2000, 50000);
  return clamp((kelvin - 6500) / 65, -100, 100);
}
```

### 4. Add to Mapping Table

Edit `src/mappers/mapping-table.ts`:

```typescript
{
  lrKeys: ["MyLRParam", "MyLRParamAlternate"],  // Try these keys in order
  safelightKey: "myParamField",
  transform: myTransformFunction,
  comment: "Describe what this adjustment does",
}
```

### 5. Test

```bash
npm test
```

Write a test case in `src/mappers/param-mapper.test.ts`:

```typescript
it("maps MyLRParam correctly", async () => {
  const preset: LightroomPreset = {
    name: "Test",
    settings: { MyLRParam: 50 },
  };
  const result = await mapLightroomToDevelopParams(preset);
  expect(result?.params.myParamField).toBe(expectedValue);
});
```

## Testing Strategy

### Unit Tests (Vitest)

- **Parser tests**: Parse fixture files, verify structure extraction
- **Mapper tests**: Map known preset objects, verify output ranges
- **Utility tests**: Clamp, scale, numeric parsing edge cases

Run:
```bash
npm test
```

### Integration Tests (Manual)

1. Create a test preset in Lightroom: `.xmp` + `.lrtemplate` files
2. Import via PresetsPanel UI
3. Apply to a photo in Develop module
4. Visually compare: Lightroom original vs. SafeLight imported

### Regression Testing

Keep sample Lightroom preset files in `test/fixtures/`:
- `simple.xmp` — basic tone adjustments
- `hsl-mixer.lrtemplate` — 8-band HSL test
- `vignette-grain.xmp` — post-processing effects
- `complex.lrtemplate` — comprehensive multi-param preset

Run fixtures through parser + mapper on each build to catch regressions.

## Common Issues & Fixes

### Issue: "Preset imports but adjustments are off"

**Cause**: SafeLight's rendering pipeline differs from Lightroom's. Tone curves, color spaces, defaults are different.

**Fix**: Document as expected behavior in README. Some users may need to tweak imported presets manually.

### Issue: "Temperature conversion seems backwards"

**Cause**: Temperature scale differences.
- Lightroom: Absolute Kelvin (6500 = neutral)
- SafeLight: Relative adjustment (-100 to +100)

**Fix**: Double-check the conversion formula. For debug, add console.log in the transform:

```typescript
function mapTemperature(v: unknown): number | null {
  const n = asNumber(v);
  console.log("[LR import] Temperature:", n, "K");
  const kelvin = clamp(n, 2000, 50000);
  const relative = clamp((kelvin - 6500) / 65, -100, 100);
  console.log("[LR import] → Safelight:", relative);
  return relative;
}
```

### Issue: "Some parameters aren't mapping"

**Cause**: Missing entry in mapping-table.ts or Lightroom key name mismatch.

**Fix**: 
1. Check browser console for unsupported parameter warnings
2. Add a new mapping entry
3. Look up the exact LR key name in the source preset file

## Build & Deployment

### Build for Distribution

```bash
npm run build
```

Creates `dist/index.js` — a single ESM file ready for SafeLight.

> **Important:** `dist/index.js` must be **committed** to the repo. SafeLight's
> "Install from GitHub" flow downloads the repo source tarball and looks for the
> entry bundle named in `safelight.json` (`main: "dist/index.js"`). If `dist/` is
> git-ignored, installs fail with `Entry bundle "dist/index.js" not found in repo`.
> Always run `npm run build` and commit the result before pushing a release.

### Install from GitHub (Extensions store)

In SafeLight, install by `owner/repo` (optionally `owner/repo#branch`). SafeLight
fetches the tarball for that ref and copies the committed files — including
`dist/index.js` — into the plugins directory. No build runs on install, so the
bundle has to already be in the repo.

### For manual / local installation

Copy the entire extension folder (with a built `dist/`) to SafeLight's plugins directory:

**macOS**: `~/Library/Application Support/SafeLight/plugins/`  
**Windows**: `C:\Users\<user>\AppData\Roaming\SafeLight\plugins\`  
**Linux**: `~/.config/SafeLight/plugins/`

Then restart SafeLight or reload extensions.

### Version Bump

1. Update `safelight.json`: `version` field
2. Update `package.json`: `version` field
3. Update `README.md`: **Version** footer
4. `npm run build` and commit `dist/index.js`
5. Commit & tag: `git tag v1.0.1`, then push (`git push && git push --tags`)

## Extending the Importer

### Adding Support for Another Format

Example: Add DNG sidecar XMP support.

1. Create `src/parsers/dng-xmp-parser.ts`
2. Implement `parseDngXmpPreset(file: File): Promise<LightroomPreset | null>`
3. Register in `src/index.ts`:

```typescript
api.registerPresetImporter({
  id: "dng-xmp-importer",
  label: "DNG sidecar XMP",
  extensions: [".xmp"],  // or a new extension
  parse: async (file) => {
    if (isDngSidecar(file)) {
      const preset = await parseDngXmpPreset(file);
      return preset ? await mapLightroomToDevelopParams(preset) : null;
    }
    return null;
  },
});
```

### Adding Support for Another App

Example: Adobe Lightroom CC (cloud) presets.

1. Research LR CC's preset format
2. Create `src/parsers/lr-cc-parser.ts`
3. Implement parser + mapping adjustments
4. Register as a separate importer with its own id/label

This keeps concerns separate and lets each importer fail independently.

## Performance Considerations

- **File size**: Expect .xmp and .lrtemplate files to be < 10 KB
- **Parse time**: Regex-based parsing is instant (< 10 ms)
- **Map time**: Transformation is O(n) in number of mappings, typically < 5 ms
- **Total**: End-to-end import should take < 50 ms (not noticeable to user)

No optimization needed for typical use cases.

## Security

- **No network requests** — Files are parsed locally
- **No eval()** — String-based regex parsing only
- **No file write** — Importer is read-only (SafeLight manages saves)
- **File.text()** — Uses browser Blob API, safe for UTF-8 text

No security concerns for this use case.

## Debugging

### Enable Console Logging

In `src/index.ts`:

```typescript
parse: async (file: File) => {
  console.log("[LR import] Parsing:", file.name);
  const lower = file.name.toLowerCase();

  if (lower.endsWith(".xmp")) {
    const lrPreset = await parseXmpPreset(file);
    console.log("[LR import] Parsed XMP:", lrPreset);
    ...
  }
}
```

Then open DevTools in SafeLight (`Cmd+Opt+I` on Mac, `Ctrl+Shift+I` on Windows) and check the Console tab during import.

### Inspect Parsed Settings

In the browser console after importing a preset:

```javascript
// In PresetsPanel or develop module
window.safelight?.stores?.usePresetsStore?.getState()?.presets
  .slice(-1)[0]  // Last imported preset
```

You can see the exact `params` that were imported.

## Contributing Guidelines

1. **Add tests** for any new mapper or parser
2. **Document edge cases** in comments
3. **Update README** if changing user-visible behavior
4. **Follow TypeScript strict mode** (strict: true in tsconfig)
5. **Use meaningful names** — `mapExposure` not `m1`
6. **Comment why, not what** — the code shows what, comments explain why

## Related Issues

- SafeLight #21: Camera profiles & lens correction
- SafeLight #XX: Color grading wheels UI (would enable better split-toning mapping)

---

**Last updated**: 2024  
**Maintainer**: Anthony
