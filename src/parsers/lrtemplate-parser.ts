import { LightroomPreset } from "./parser-types";
import { asNumber } from "../utils/numeric";

export async function parseLrTemplatePreset(file: File): Promise<LightroomPreset | null> {
  try {
    const text = await file.text();

    const name = extractLuaString(text, "title") || extractLuaString(text, "id") || file.name.replace(/\..+$/, "");

    const settings = extractLuaTable(text);

    if (!settings || Object.keys(settings).length === 0) {
      return null;
    }

    return { name, settings };
  } catch {
    return null;
  }
}

function extractLuaString(text: string, key: string): string | null {
  const pattern = new RegExp(`\\b${key}\\s*=\\s*["\']([^"\']*)["\']`, "i");
  const match = text.match(pattern);
  return match?.[1] || null;
}

function extractLuaTable(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  const numberPattern = /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/;
  const stringPattern = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/;
  const boolPattern = /true|false/;

  const patterns = [
    { regex: new RegExp(`(\\w+)\\s*=\\s*(${stringPattern.source})`, "g"), type: "string" },
    { regex: new RegExp(`(\\w+)\\s*=\\s*(${numberPattern.source})(?![a-zA-Z0-9_])`, "g"), type: "number" },
    { regex: new RegExp(`(\\w+)\\s*=\\s*(${boolPattern.source})(?![a-zA-Z0-9_])`, "g"), type: "boolean" },
  ];

  for (const { regex, type } of patterns) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      const key = match[1];
      const valueStr = match[2];

      let value: unknown;
      if (type === "string") {
        value = valueStr.slice(1, -1);
      } else if (type === "number") {
        value = parseFloat(valueStr);
      } else if (type === "boolean") {
        value = valueStr === "true";
      }

      if (!(key in result)) {
        result[key] = value;
      }
    }
  }

  for (const [key, points] of extractPointLists(text)) {
    if (!(key in result)) {
      result[key] = points;
    }
  }

  return result;
}

// Lightroom writes each point curve as a flat x, y, x, y, … list of numbers.
// Pairing them gives curves the same shape the XMP parser does.
function extractPointLists(text: string): Map<string, [number, number][]> {
  const lists = new Map<string, [number, number][]>();
  const listPattern = /(\w+)\s*=\s*\{([^{}]*)\}/g;
  let match;
  while ((match = listPattern.exec(text)) !== null) {
    const numbers = match[2]
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item !== "")
      .map(Number);
    if (numbers.length === 0 || numbers.length % 2 !== 0 || !numbers.every(Number.isFinite)) {
      continue;
    }
    const points: [number, number][] = [];
    for (let i = 0; i < numbers.length; i += 2) {
      points.push([numbers[i], numbers[i + 1]]);
    }
    if (!lists.has(match[1])) {
      lists.set(match[1], points);
    }
  }
  return lists;
}
