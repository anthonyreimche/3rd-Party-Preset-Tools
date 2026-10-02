import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { parseXmpPreset } from "./xmp-parser";

const fixture = (name: string): File =>
  new File([readFileSync(resolve(__dirname, "../__fixtures__", name))], name);

describe("XMP Parser: Lightroom Classic preset", () => {
  it("reads the preset's name from crs:Name", async () => {
    const result = await parseXmpPreset(fixture("warm-matte.xmp"));
    expect(result?.name).toBe("Warm Matte");
  });

  it("reads tone curves from their rdf:Seq point lists", async () => {
    const result = await parseXmpPreset(fixture("warm-matte.xmp"));
    expect(result?.settings.ToneCurvePV2012).toEqual([
      [0, 24],
      [64, 60],
      [192, 200],
      [255, 245],
    ]);
    expect(result?.settings.ToneCurvePV2012Red).toEqual([
      [0, 0],
      [255, 255],
    ]);
  });

  // A preset embeds its profile (crs:Look), whose own parameters describe the
  // profile's rendering rather than the preset's adjustments.
  it("ignores settings nested inside the embedded profile", async () => {
    const result = await parseXmpPreset(fixture("warm-matte.xmp"));
    expect(result?.settings.ProcessVersion).toBe(15.4);
    expect(result?.settings).not.toHaveProperty("LookTable");
    expect(result?.settings).not.toHaveProperty("Amount");
  });

  it("reads Lightroom's capitalised booleans", async () => {
    const result = await parseXmpPreset(fixture("warm-matte.xmp"));
    expect(result?.settings.ConvertToGrayscale).toBe(false);
    expect(result?.settings.HasSettings).toBe(true);
  });
});

describe("XMP Parser", () => {
  it("parses valid XMP with camera raw settings", async () => {
    const xmlContent = `<?xml version="1.0"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="test-preset"
      xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"
      crs:Exposure="0.5"
      crs:Saturation="-20"
      crs:Clarity="15"
    />
  </rdf:RDF>
</x:xmpmeta>`;

    const file = new File([xmlContent], "test.xmp", { type: "text/xml" });
    const result = await parseXmpPreset(file);

    expect(result).not.toBeNull();
    expect(result?.name).toBe("test-preset");
    expect(result?.settings.Exposure).toBe(0.5);
    expect(result?.settings.Saturation).toBe(-20);
    expect(result?.settings.Clarity).toBe(15);
  });

  it("returns null for invalid XML", async () => {
    const xmlContent = `<?xml version="1.0"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="test"
      MISSING CLOSE TAG`;

    const file = new File([xmlContent], "test.xmp", { type: "text/xml" });
    const result = await parseXmpPreset(file);

    expect(result).toBeNull();
  });

  it("returns null if no crs: attributes found", async () => {
    const xmlContent = `<?xml version="1.0"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="test" />
  </rdf:RDF>
</x:xmpmeta>`;

    const file = new File([xmlContent], "test.xmp", { type: "text/xml" });
    const result = await parseXmpPreset(file);

    expect(result).toBeNull();
  });

  it("parses numeric and boolean values correctly", async () => {
    const xmlContent = `<?xml version="1.0"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description
      xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"
      crs:Exposure="1.5"
      crs:Temperature="6500"
      crs:ClarityEnabled="true"
    />
  </rdf:RDF>
</x:xmpmeta>`;

    const file = new File([xmlContent], "test.xmp", { type: "text/xml" });
    const result = await parseXmpPreset(file);

    expect(result?.settings.Exposure).toBe(1.5);
    expect(result?.settings.Temperature).toBe(6500);
    expect(result?.settings.ClarityEnabled).toBe(true);
  });

  it("uses filename as fallback when preset name is empty", async () => {
    const xmlContent = `<?xml version="1.0"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"
      crs:Exposure="0.5"
    />
  </rdf:RDF>
</x:xmpmeta>`;

    const file = new File([xmlContent], "my-preset.xmp", { type: "text/xml" });
    const result = await parseXmpPreset(file);

    expect(result?.name).toBe("my-preset");
  });
});
