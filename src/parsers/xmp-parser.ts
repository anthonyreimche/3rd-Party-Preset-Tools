import { LightroomPreset } from "./parser-types";
import { asNumber } from "../utils/numeric";

export async function parseXmpPreset(file: File): Promise<LightroomPreset | null> {
  try {
    const xml = await file.text();
    const doc = new DOMParser().parseFromString(xml, "text/xml");

    if (doc.documentElement.nodeName === "parsererror" || doc.querySelector("parsererror")) {
      return null;
    }

    const descriptions = elementsByLocalName(doc, "Description");
    if (descriptions.length === 0) {
      return null;
    }

    const settings: Record<string, unknown> = {};

    for (const desc of descriptions) {
      // Simple presets store camera-raw settings as crs:* attributes.
      for (const attr of Array.from(desc.attributes)) {
        if (isCrsQualifiedName(attr.name)) {
          settings[localPart(attr.name)] = parseXmlValue(attr.value);
        }
      }

      // Some presets store scalar settings as crs:* child elements instead.
      for (const child of Array.from(desc.children)) {
        if (isCrsQualifiedName(child.nodeName) && child.children.length === 0) {
          const text = child.textContent?.trim();
          if (text) {
            settings[localPart(child.nodeName)] = parseXmlValue(text);
          }
        }
      }
    }

    if (Object.keys(settings).length === 0) {
      return null;
    }

    const name = extractPresetName(doc, file.name);

    return { name, settings };
  } catch {
    return null;
  }
}

function parseXmlValue(str: string): unknown {
  if (str === "true") return true;
  if (str === "false") return false;
  const num = asNumber(str);
  return num !== null ? num : str;
}

function extractPresetName(doc: Document, fileName: string): string {
  // Lightroom stores the human-readable preset name in a localized
  // crs:Name element (<crs:Name><rdf:Alt><rdf:li>Name</rdf:li></rdf:Alt>).
  const nameEl = elementsByLocalName(doc, "Name")[0];
  if (nameEl) {
    const li = elementsByLocalName(nameEl, "li")[0];
    const text = (li ?? nameEl).textContent?.trim();
    if (text) {
      return text;
    }
  }

  // Fall back to rdf:about (often a UUID/URI, but better than nothing).
  for (const desc of elementsByLocalName(doc, "Description")) {
    const about = attributeByLocalName(desc, "about");
    if (about) {
      return about;
    }
  }

  return fileName.replace(/\.xmp$/i, "");
}

// Namespace-prefix-agnostic helpers. We match on localName rather than using
// escaped-namespace CSS selectors (e.g. "rdf\\:Description"), which are
// fragile across XML parsers and break if a preset uses a different prefix.
function elementsByLocalName(root: Document | Element, localName: string): Element[] {
  return Array.from(root.getElementsByTagName("*")).filter((el) => el.localName === localName);
}

function isCrsQualifiedName(qualifiedName: string): boolean {
  return qualifiedName.startsWith("crs:");
}

function localPart(qualifiedName: string): string {
  const i = qualifiedName.indexOf(":");
  return i >= 0 ? qualifiedName.slice(i + 1) : qualifiedName;
}

function attributeByLocalName(el: Element, localName: string): string | null {
  for (const attr of Array.from(el.attributes)) {
    if (attr.localName === localName && attr.value) {
      return attr.value;
    }
  }
  return null;
}
