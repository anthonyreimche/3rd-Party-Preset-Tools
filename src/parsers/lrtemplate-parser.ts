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

type LuaValue = string | { table: string };

// Lightroom writes a preset as `s = { title = …, value = { settings = { … } } }`.
// Only the settings table's own entries are the preset's: a nested table such
// as a Look's Parameters carries the profile's values, which must not stand in
// for the preset's own.
function extractLuaTable(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of tableEntries(settingsBody(text))) {
    if (key in result) continue;
    const parsed = typeof value === "string" ? luaScalar(value) : pointList(value.table);
    if (parsed !== undefined) result[key] = parsed;
  }
  return result;
}

/** The body of the `settings` table, or of the outermost table without one. */
function settingsBody(text: string): string {
  const settings = /\bsettings\s*=\s*\{/.exec(text);
  const open = settings ? settings.index + settings[0].length - 1 : text.indexOf("{");
  return open < 0 ? "" : text.slice(open + 1, matchingBrace(text, open));
}

function skipString(text: string, start: number): number {
  const quote = text[start];
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === "\\") i++;
    else if (text[i] === quote) return i + 1;
  }
  return text.length;
}

function matchingBrace(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; ) {
    const c = text[i];
    if (c === '"' || c === "'") {
      i = skipString(text, i);
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return i;
    i++;
  }
  return text.length;
}

/** A table body's direct `key = value` entries, in order. A nested table's
 *  value is its body; list items, which have no key, are left out. */
function tableEntries(body: string): [string, LuaValue][] {
  const entries: [string, LuaValue][] = [];
  const keyPattern = /\s*(?:(\w+)\s*=\s*)?/y;
  let i = 0;
  while (i < body.length) {
    keyPattern.lastIndex = i;
    const key = keyPattern.exec(body)?.[1];
    i = keyPattern.lastIndex;
    if (i >= body.length) break;

    let value: LuaValue;
    if (body[i] === "{") {
      const close = matchingBrace(body, i);
      value = { table: body.slice(i + 1, close) };
      i = close + 1;
    } else {
      let end = i;
      while (end < body.length && body[end] !== "," && body[end] !== ";") {
        end = body[end] === '"' || body[end] === "'" ? skipString(body, end) : end + 1;
      }
      value = body.slice(i, end).trim();
      i = end;
    }
    if (key) entries.push([key, value]);
    while (i < body.length && /[\s,;]/.test(body[i])) i++;
  }
  return entries;
}

function luaScalar(raw: string): string | number | boolean | undefined {
  if (/^(["'])[\s\S]*\1$/.test(raw)) return raw.slice(1, -1);
  if (raw === "true" || raw === "false") return raw === "true";
  if (/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(raw)) return parseFloat(raw);
  return undefined;
}

// Lightroom writes each point curve as a flat x, y, x, y, … list of numbers.
// Pairing them gives curves the same shape the XMP parser does.
function pointList(body: string): [number, number][] | undefined {
  const numbers = body
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "")
    .map(Number);
  if (numbers.length === 0 || numbers.length % 2 !== 0 || !numbers.every(Number.isFinite)) {
    return undefined;
  }
  const points: [number, number][] = [];
  for (let i = 0; i < numbers.length; i += 2) {
    points.push([numbers[i], numbers[i + 1]]);
  }
  return points;
}
