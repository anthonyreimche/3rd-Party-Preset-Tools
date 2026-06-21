import { parseXmpPreset } from "./parsers/xmp-parser";
import { parseLrTemplatePreset } from "./parsers/lrtemplate-parser";
import { mapLightroomToDevelopParams } from "./mappers/param-mapper";

interface SafelightAPI {
  version: number;
  extensionId: string;
  registerPresetImporter(c: {
    id: string;
    label: string;
    extensions: string[];
    parse(file: File): Promise<{
      name: string;
      params: Record<string, unknown>;
    } | null>;
  }): void;
}

declare global {
  interface Window {
    safelight?: SafelightAPI;
  }
}

export function activate(api: SafelightAPI): void {
  api.registerPresetImporter({
    id: "lightroom-preset-importer",
    label: "Lightroom preset (.xmp, .lrtemplate)",
    extensions: [".xmp", ".lrtemplate"],
    parse: async (file: File) => {
      const lower = file.name.toLowerCase();

      if (lower.endsWith(".xmp")) {
        const lrPreset = await parseXmpPreset(file);
        if (!lrPreset) return null;
        return await mapLightroomToDevelopParams(lrPreset);
      }

      if (lower.endsWith(".lrtemplate")) {
        const lrPreset = await parseLrTemplatePreset(file);
        if (!lrPreset) return null;
        return await mapLightroomToDevelopParams(lrPreset);
      }

      return null;
    },
  });
}

export function deactivate(): void {
}
