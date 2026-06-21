
//#region src/utils/numeric.ts
function asNumber(value) {
	if (typeof value === "number") return value;
	if (typeof value === "string") {
		const n = parseFloat(value);
		return isNaN(n) ? null : n;
	}
	return null;
}
function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

//#endregion
//#region src/parsers/xmp-parser.ts
async function parseXmpPreset(file) {
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
		const settings = {};
		for (const desc of descriptions) {
			for (const attr of Array.from(desc.attributes)) {
				if (isCrsQualifiedName(attr.name)) {
					settings[localPart(attr.name)] = parseXmlValue(attr.value);
				}
			}
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
		return {
			name,
			settings
		};
	} catch {
		return null;
	}
}
function parseXmlValue(str) {
	if (str === "true") return true;
	if (str === "false") return false;
	const num = asNumber(str);
	return num !== null ? num : str;
}
function extractPresetName(doc, fileName) {
	const nameEl = elementsByLocalName(doc, "Name")[0];
	if (nameEl) {
		const li = elementsByLocalName(nameEl, "li")[0];
		const text = (li ?? nameEl).textContent?.trim();
		if (text) {
			return text;
		}
	}
	for (const desc of elementsByLocalName(doc, "Description")) {
		const about = attributeByLocalName(desc, "about");
		if (about) {
			return about;
		}
	}
	return fileName.replace(/\.xmp$/i, "");
}
function elementsByLocalName(root, localName) {
	return Array.from(root.getElementsByTagName("*")).filter((el) => el.localName === localName);
}
function isCrsQualifiedName(qualifiedName) {
	return qualifiedName.startsWith("crs:");
}
function localPart(qualifiedName) {
	const i = qualifiedName.indexOf(":");
	return i >= 0 ? qualifiedName.slice(i + 1) : qualifiedName;
}
function attributeByLocalName(el, localName) {
	for (const attr of Array.from(el.attributes)) {
		if (attr.localName === localName && attr.value) {
			return attr.value;
		}
	}
	return null;
}

//#endregion
//#region src/parsers/lrtemplate-parser.ts
async function parseLrTemplatePreset(file) {
	try {
		const text = await file.text();
		const name = extractLuaString(text, "title") || extractLuaString(text, "id") || file.name.replace(/\..+$/, "");
		const settings = extractLuaTable(text);
		if (!settings || Object.keys(settings).length === 0) {
			return null;
		}
		return {
			name,
			settings
		};
	} catch {
		return null;
	}
}
function extractLuaString(text, key) {
	const pattern = new RegExp(`\\b${key}\\s*=\\s*["\']([^"\']*)["\']`, "i");
	const match = text.match(pattern);
	return match?.[1] || null;
}
function extractLuaTable(text) {
	const result = {};
	const numberPattern = /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/;
	const stringPattern = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/;
	const boolPattern = /true|false/;
	const patterns = [{
		regex: new RegExp(`(\\w+)\\s*=\\s*(${stringPattern.source})`, "g"),
		type: "string"
	}, {
		regex: new RegExp(`(\\w+)\\s*=\\s*(${numberPattern.source})(?![a-zA-Z0-9_])`, "g"),
		type: "number"
	}, {
		regex: new RegExp(`(\\w+)\\s*=\\s*(${boolPattern.source})(?![a-zA-Z0-9_])`, "g"),
		type: "boolean"
	},];
	for (const { regex, type } of patterns) {
		let match;
		while ((match = regex.exec(text)) !== null) {
			const key = match[1];
			const valueStr = match[2];
			let value;
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
	return result;
}

//#endregion
//#region src/mappers/mapping-table.ts
function mapExposure(v) {
	const n = asNumber(v);
	if (n === null) return null;
	return clamp(n * 100, -200, 200);
}
function mapNormalized(v) {
	const n = asNumber(v);
	if (n === null) return null;
	return clamp(n, -100, 100);
}
function mapNormalizedPercent(v) {
	const n = asNumber(v);
	if (n === null) return null;
	return clamp(n * 100, -100, 100);
}
function mapPercent0To100(v) {
	const n = asNumber(v);
	if (n === null) return null;
	return clamp(n, 0, 100);
}
function mapTemperature(v) {
	const n = asNumber(v);
	if (n === null) return null;
	const kelvin = clamp(n, 2000, 50000);
	return clamp((kelvin - 6500) / 65, -100, 100);
}
const MAPPING_TABLE = [{
	lrKeys: ["Exposure2012", "Exposure"],
	safelightKey: "exposure",
	transform: mapExposure,
	comment: "Exposure adjustment"
}, {
	lrKeys: ["Contrast2012", "Contrast"],
	safelightKey: "contrast",
	transform: mapNormalizedPercent,
	comment: "Contrast adjustment"
}, {
	lrKeys: ["Highlights2012", "Highlights"],
	safelightKey: "highlights",
	transform: mapNormalizedPercent,
	comment: "Highlights adjustment"
}, {
	lrKeys: ["Shadows2012", "Shadows"],
	safelightKey: "shadows",
	transform: mapNormalizedPercent,
	comment: "Shadows adjustment"
}, {
	lrKeys: ["Whites2012", "Whites"],
	safelightKey: "whites",
	transform: mapNormalizedPercent,
	comment: "Whites/Highlights adjustment"
}, {
	lrKeys: ["Blacks2012", "Blacks"],
	safelightKey: "blacks",
	transform: mapNormalizedPercent,
	comment: "Blacks/Shadows adjustment"
}, {
	lrKeys: ["Texture"],
	safelightKey: "texture",
	transform: mapNormalizedPercent,
	comment: "Texture adjustment"
}, {
	lrKeys: ["Clarity2012", "Clarity"],
	safelightKey: "clarity",
	transform: mapNormalizedPercent,
	comment: "Clarity adjustment"
}, {
	lrKeys: ["Dehaze"],
	safelightKey: "dehaze",
	transform: mapNormalizedPercent,
	comment: "Dehaze adjustment"
}, {
	lrKeys: ["Vibrance"],
	safelightKey: "vibrance",
	transform: mapNormalized,
	comment: "Vibrance adjustment"
}, {
	lrKeys: ["Saturation"],
	safelightKey: "saturation",
	transform: mapNormalized,
	comment: "Saturation adjustment"
}, {
	lrKeys: ["Temperature"],
	safelightKey: "temperature",
	transform: mapTemperature,
	comment: "Color temperature in Kelvin"
}, {
	lrKeys: ["Tint"],
	safelightKey: "tint",
	transform: mapNormalized,
	comment: "Tint adjustment (magenta/green)"
}, {
	lrKeys: ["Sharpening"],
	safelightKey: "sharpening",
	transform: mapPercent0To100,
	comment: "Sharpening amount"
}, {
	lrKeys: ["SharpenRadius"],
	safelightKey: "sharpenRadius",
	transform: (v) => {
		const n = asNumber(v);
		if (n === null) return null;
		return clamp(n, 1, 3);
	},
	comment: "Sharpening radius"
}, {
	lrKeys: ["SharpenDetail"],
	safelightKey: "sharpenDetail",
	transform: mapPercent0To100,
	comment: "Sharpening detail/edge detection"
}, {
	lrKeys: ["SharpenMasking"],
	safelightKey: "sharpenMasking",
	transform: mapPercent0To100,
	comment: "Sharpening edge masking"
}, {
	lrKeys: ["LuminanceSmoothing"],
	safelightKey: "luminanceNR",
	transform: mapPercent0To100,
	comment: "Luminance noise reduction"
}, {
	lrKeys: ["LuminanceDetail"],
	safelightKey: "luminanceNRDetail",
	transform: mapPercent0To100,
	comment: "Luminance NR detail preservation"
}, {
	lrKeys: ["LuminanceContrast"],
	safelightKey: "luminanceNRContrast",
	transform: mapPercent0To100,
	comment: "Luminance NR contrast preservation"
}, {
	lrKeys: ["LuminanceNoiseShadows"],
	safelightKey: "luminanceNRShadows",
	transform: mapPercent0To100,
	comment: "Luminance NR shadow weight"
}, {
	lrKeys: ["LuminanceNoiseHighlights"],
	safelightKey: "luminanceNRHighlights",
	transform: mapPercent0To100,
	comment: "Luminance NR highlight protection"
}, {
	lrKeys: ["ColorNoiseReduction"],
	safelightKey: "colorNR",
	transform: mapPercent0To100,
	comment: "Color (chroma) noise reduction"
}, {
	lrKeys: ["ColorNoiseDetail"],
	safelightKey: "colorNRDetail",
	transform: mapPercent0To100,
	comment: "Color NR detail preservation"
}, {
	lrKeys: ["ColorNoiseSmoothness"],
	safelightKey: "colorNRSmoothness",
	transform: mapPercent0To100,
	comment: "Color NR smoothness"
},];

//#endregion
//#region src/mappers/param-mapper.ts
async function mapLightroomToDevelopParams(lrPreset) {
	const params = {};
	for (const mapping of MAPPING_TABLE) {
		const lrKey = mapping.lrKeys.find((k) => (k in lrPreset.settings));
		if (!lrKey) continue;
		const lrValue = lrPreset.settings[lrKey];
		let safelightValue;
		if (mapping.transform) {
			safelightValue = mapping.transform(lrValue);
		} else {
			safelightValue = null;
		}
		if (safelightValue === null) continue;
		params[mapping.safelightKey] = safelightValue;
	}
	mapHSLAdjustments(params, lrPreset.settings);
	mapVignetteParams(params, lrPreset.settings);
	mapGrainParams(params, lrPreset.settings);
	return {
		name: lrPreset.name,
		params
	};
}
function mapHSLAdjustments(params, lrSettings) {
	const hsl = {};
	const channels = ["Red", "Orange", "Yellow", "Green", "Aqua", "Blue", "Purple", "Magenta"];
	const channelKeys = ["red", "orange", "yellow", "green", "aqua", "blue", "purple", "magenta"];
	for (let i = 0; i < channels.length; i++) {
		const channel = channels[i];
		const key = channelKeys[i];
		const hueKey = `HueAdjustment${channel}`;
		const satKey = `SaturationAdjustment${channel}`;
		const lumKey = `GrayMixer${channel}`;
		const hasAny = hueKey in lrSettings || satKey in lrSettings || lumKey in lrSettings;
		if (!hasAny) continue;
		if (hueKey in lrSettings) {
			if (!hsl.hue) hsl.hue = {};
			const n = parseFloat(String(lrSettings[hueKey]));
			hsl.hue[key] = isNaN(n) ? 0 : Math.max(-180, Math.min(180, n));
		}
		if (satKey in lrSettings) {
			if (!hsl.saturation) hsl.saturation = {};
			const n = parseFloat(String(lrSettings[satKey]));
			hsl.saturation[key] = isNaN(n) ? 0 : Math.max(-100, Math.min(100, n));
		}
		if (lumKey in lrSettings) {
			if (!hsl.luminance) hsl.luminance = {};
			const n = parseFloat(String(lrSettings[lumKey]));
			hsl.luminance[key] = isNaN(n) ? 0 : Math.max(-100, Math.min(100, n));
		}
	}
	if (Object.keys(hsl).length > 0) {
		const defaultHSL = {
			hue: {
				red: 0,
				orange: 0,
				yellow: 0,
				green: 0,
				aqua: 0,
				blue: 0,
				purple: 0,
				magenta: 0
			},
			saturation: {
				red: 0,
				orange: 0,
				yellow: 0,
				green: 0,
				aqua: 0,
				blue: 0,
				purple: 0,
				magenta: 0
			},
			luminance: {
				red: 0,
				orange: 0,
				yellow: 0,
				green: 0,
				aqua: 0,
				blue: 0,
				purple: 0,
				magenta: 0
			}
		};
		params.hsl = {
			hue: {
				...defaultHSL.hue,
				...hsl.hue ?? {}
			},
			saturation: {
				...defaultHSL.saturation,
				...hsl.saturation ?? {}
			},
			luminance: {
				...defaultHSL.luminance,
				...hsl.luminance ?? {}
			}
		};
	}
}
function mapVignetteParams(params, lrSettings) {
	const vignette = {};
	const amountKey = "VignetteAmount";
	const midpointKey = "VignetteMidpoint";
	const roundnessKey = "VignetteRoundness";
	if (amountKey in lrSettings) {
		const n = parseFloat(String(lrSettings[amountKey]));
		vignette.amount = isNaN(n) ? 0 : Math.max(-100, Math.min(100, n));
	}
	if (midpointKey in lrSettings) {
		const n = parseFloat(String(lrSettings[midpointKey]));
		vignette.midpoint = isNaN(n) ? 50 : Math.max(0, Math.min(100, n));
	}
	if (roundnessKey in lrSettings) {
		const n = parseFloat(String(lrSettings[roundnessKey]));
		vignette.roundness = isNaN(n) ? 0 : Math.max(-100, Math.min(100, n));
	}
	if (Object.keys(vignette).length > 0) {
		params.vignette = {
			amount: vignette.amount ?? 0,
			midpoint: vignette.midpoint ?? 50,
			roundness: vignette.roundness ?? 0,
			feather: 50,
			highlights: 0
		};
	}
}
function mapGrainParams(params, lrSettings) {
	const grain = {};
	const amountKey = "GrainAmount";
	const sizeKey = "GrainSize";
	const roughnessKey = "GrainFrequency";
	if (amountKey in lrSettings) {
		const n = parseFloat(String(lrSettings[amountKey]));
		grain.amount = isNaN(n) ? 0 : Math.max(0, Math.min(100, n));
	}
	if (sizeKey in lrSettings) {
		const n = parseFloat(String(lrSettings[sizeKey]));
		grain.size = isNaN(n) ? 25 : Math.max(25, Math.min(100, n * 25));
	}
	if (roughnessKey in lrSettings) {
		const n = parseFloat(String(lrSettings[roughnessKey]));
		grain.roughness = isNaN(n) ? 50 : Math.max(0, Math.min(100, n * 100));
	}
	if (Object.keys(grain).length > 0) {
		params.grain = {
			amount: grain.amount ?? 0,
			size: grain.size ?? 25,
			roughness: grain.roughness ?? 50,
			color: 0
		};
	}
}

//#endregion
//#region src/index.ts
function activate(api) {
	api.registerPresetImporter({
		id: "lightroom-preset-importer",
		label: "Lightroom preset (.xmp, .lrtemplate)",
		extensions: [".xmp", ".lrtemplate"],
		parse: async (file) => {
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
		}
	});
}
function deactivate() {}

//#endregion
export { activate, deactivate };