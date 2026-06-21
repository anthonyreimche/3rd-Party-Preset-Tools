import { describe, it, expect } from "vitest";
import { parseXmpPreset } from "./xmp-parser";

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
