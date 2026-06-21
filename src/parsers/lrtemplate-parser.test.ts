import { describe, it, expect } from "vitest";
import { parseLrTemplatePreset } from "./lrtemplate-parser";

describe("LRTemplate Parser", () => {
  it("parses basic key-value pairs", async () => {
    const content = `{
  title = "My Preset",
  Exposure = 0.5,
  Saturation = -20,
  Clarity = 15,
}`;

    const file = new File([content], "test.lrtemplate");
    const result = await parseLrTemplatePreset(file);

    expect(result).not.toBeNull();
    expect(result?.name).toBe("My Preset");
    expect(result?.settings.Exposure).toBe(0.5);
    expect(result?.settings.Saturation).toBe(-20);
    expect(result?.settings.Clarity).toBe(15);
  });

  it("parses string values with quotes", async () => {
    const content = `{
  title = "Preset Name",
  id = 'UUID123',
}`;

    const file = new File([content], "test.lrtemplate");
    const result = await parseLrTemplatePreset(file);

    expect(result?.name).toBe("Preset Name");
    expect(result?.settings.id).toBe("UUID123");
  });

  it("parses boolean values", async () => {
    const content = `{
  title = "Bool Test",
  EnableSharpening = true,
  EnableVignette = false,
}`;

    const file = new File([content], "test.lrtemplate");
    const result = await parseLrTemplatePreset(file);

    expect(result?.settings.EnableSharpening).toBe(true);
    expect(result?.settings.EnableVignette).toBe(false);
  });

  it("parses negative numbers", async () => {
    const content = `{
  title = "Negative Test",
  Saturation = -50,
  Exposure = -1.5,
  Dehaze = -100,
}`;

    const file = new File([content], "test.lrtemplate");
    const result = await parseLrTemplatePreset(file);

    expect(result?.settings.Saturation).toBe(-50);
    expect(result?.settings.Exposure).toBe(-1.5);
    expect(result?.settings.Dehaze).toBe(-100);
  });

  it("returns null for empty or invalid files", async () => {
    const content = "{ }";
    const file = new File([content], "test.lrtemplate");
    const result = await parseLrTemplatePreset(file);

    expect(result).toBeNull();
  });

  it("uses filename as fallback when title is missing", async () => {
    const content = `{
  Exposure = 0.5,
}`;

    const file = new File([content], "my-preset.lrtemplate");
    const result = await parseLrTemplatePreset(file);

    expect(result?.name).toBe("my-preset");
  });

  it("prefers title over id for preset name", async () => {
    const content = `{
  id = "UUID123",
  title = "My Preset",
  Exposure = 0.5,
}`;

    const file = new File([content], "fallback.lrtemplate");
    const result = await parseLrTemplatePreset(file);

    expect(result?.name).toBe("My Preset");
  });

  it("handles numbers in scientific notation", async () => {
    const content = `{
  title = "Scientific",
  SmallValue = 1.5e-2,
  LargeValue = 1.2e3,
}`;

    const file = new File([content], "test.lrtemplate");
    const result = await parseLrTemplatePreset(file);

    expect(result?.settings.SmallValue).toBe(0.015);
    expect(result?.settings.LargeValue).toBe(1200);
  });
});
