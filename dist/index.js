
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
		const descriptions = elementsByLocalName(doc, "Description").filter((desc) => desc.parentElement?.localName === "RDF");
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
				if (!isCrsQualifiedName(child.nodeName)) continue;
				if (child.children.length === 0) {
					const text = child.textContent?.trim();
					if (text) {
						settings[localPart(child.nodeName)] = parseXmlValue(text);
					}
					continue;
				}
				const points = readPointSeq(child);
				if (points) {
					settings[localPart(child.nodeName)] = points;
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
	if (/^true$/i.test(str)) return true;
	if (/^false$/i.test(str)) return false;
	const num = asNumber(str);
	return num !== null ? num : str;
}
function readPointSeq(el) {
	const seq = elementsByLocalName(el, "Seq")[0];
	if (!seq) return null;
	const points = [];
	for (const li of elementsByLocalName(seq, "li")) {
		const match = li.textContent?.match(/^\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*$/);
		if (!match) return null;
		points.push([parseFloat(match[1]), parseFloat(match[2])]);
	}
	return points.length > 0 ? points : null;
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
function within(min, max) {
	return (value) => {
		const n = asNumber(value);
		return n === null ? null : clamp(n, min, max);
	};
}
const SLIDER = within(-100, 100);
const AMOUNT = within(0, 100);
function kelvin(value) {
	const n = asNumber(value);
	return n === null || n < 2000 ? null : Math.min(n, 50000);
}
const MAPPING_TABLE = [{
	lrKeys: ["Exposure2012", "Exposure"],
	safelightKey: "exposure",
	transform: within(-5, 5)
}, {
	lrKeys: ["Contrast2012"],
	safelightKey: "contrast",
	transform: SLIDER
}, {
	lrKeys: ["Highlights2012"],
	safelightKey: "highlights",
	transform: SLIDER
}, {
	lrKeys: ["Shadows2012"],
	safelightKey: "shadows",
	transform: SLIDER
}, {
	lrKeys: ["Whites2012"],
	safelightKey: "whites",
	transform: SLIDER
}, {
	lrKeys: ["Blacks2012"],
	safelightKey: "blacks",
	transform: SLIDER
}, {
	lrKeys: ["Texture"],
	safelightKey: "texture",
	transform: SLIDER
}, {
	lrKeys: ["Clarity2012", "Clarity"],
	safelightKey: "clarity",
	transform: SLIDER
}, {
	lrKeys: ["Dehaze"],
	safelightKey: "dehaze",
	transform: SLIDER
}, {
	lrKeys: ["Vibrance"],
	safelightKey: "vibrance",
	transform: SLIDER
}, {
	lrKeys: ["Saturation"],
	safelightKey: "saturation",
	transform: SLIDER
}, {
	lrKeys: ["Temperature"],
	safelightKey: "temperature",
	transform: kelvin
}, {
	lrKeys: ["Tint"],
	safelightKey: "tint",
	transform: within(-150, 150)
}, {
	lrKeys: ["Sharpness"],
	safelightKey: "sharpening",
	transform: AMOUNT
}, {
	lrKeys: ["SharpenRadius"],
	safelightKey: "sharpenRadius",
	transform: within(1, 3)
}, {
	lrKeys: ["SharpenDetail"],
	safelightKey: "sharpenDetail",
	transform: AMOUNT
}, {
	lrKeys: ["SharpenEdgeMasking"],
	safelightKey: "sharpenMasking",
	transform: AMOUNT
}, {
	lrKeys: ["LuminanceSmoothing"],
	safelightKey: "luminanceNR",
	transform: AMOUNT
}, {
	lrKeys: ["LuminanceNoiseReductionDetail"],
	safelightKey: "luminanceNRDetail",
	transform: AMOUNT
}, {
	lrKeys: ["LuminanceNoiseReductionContrast"],
	safelightKey: "luminanceNRContrast",
	transform: AMOUNT
}, {
	lrKeys: ["ColorNoiseReduction"],
	safelightKey: "colorNR",
	transform: AMOUNT
}, {
	lrKeys: ["ColorNoiseReductionDetail"],
	safelightKey: "colorNRDetail",
	transform: AMOUNT
}, {
	lrKeys: ["ColorNoiseReductionSmoothness"],
	safelightKey: "colorNRSmoothness",
	transform: AMOUNT
},];

//#endregion
//#region src/mappers/param-mapper.ts
async function mapLightroomToDevelopParams(lrPreset) {
	const params = {};
	const lr = lrPreset.settings;
	for (const mapping of MAPPING_TABLE) {
		const lrKey = mapping.lrKeys.find((k) => (k in lr));
		if (!lrKey) continue;
		const value = mapping.transform(lr[lrKey]);
		if (value !== null) params[mapping.safelightKey] = value;
	}
	if ("WhiteBalance" in lr && lr.WhiteBalance !== "Custom") {
		delete params.temperature;
		delete params.tint;
	}
	mapHSLAdjustments(params, lr);
	mapToneCurves(params, lr);
	mapColorGrading(params, lr);
	mapVignetteParams(params, lr);
	mapGrainParams(params, lr);
	if (lr.ConvertToGrayscale === true) params.saturation = -100;
	return {
		name: lrPreset.name,
		params
	};
}
function readNumber(lr, key, min, max) {
	const n = asNumber(lr[key]);
	return n === null ? null : clamp(n, min, max);
}
const HSL_CHANNELS = [{
	lr: "Red",
	key: "red"
}, {
	lr: "Orange",
	key: "orange"
}, {
	lr: "Yellow",
	key: "yellow"
}, {
	lr: "Green",
	key: "green"
}, {
	lr: "Aqua",
	key: "aqua"
}, {
	lr: "Blue",
	key: "blue"
}, {
	lr: "Purple",
	key: "purple"
}, {
	lr: "Magenta",
	key: "magenta"
},];
const zeroHSL = () => ({
	red: 0,
	orange: 0,
	yellow: 0,
	green: 0,
	aqua: 0,
	blue: 0,
	purple: 0,
	magenta: 0
});
function mapHSLAdjustments(params, lr) {
	const bands = {
		hue: "HueAdjustment",
		saturation: "SaturationAdjustment",
		luminance: "LuminanceAdjustment"
	};
	const hsl = {
		hue: zeroHSL(),
		saturation: zeroHSL(),
		luminance: zeroHSL()
	};
	let touched = false;
	for (const [band, prefix] of Object.entries(bands)) {
		for (const { lr: channel, key } of HSL_CHANNELS) {
			const n = readNumber(lr, `${prefix}${channel}`, -100, 100);
			if (n === null) continue;
			hsl[band][key] = n;
			touched = true;
		}
	}
	if (touched) params.hsl = hsl;
}
const IDENTITY_CURVE = [{
	x: 0,
	y: 0
}, {
	x: 1,
	y: 1
},];
function readCurve(lr, key) {
	const raw = lr[key];
	if (!Array.isArray(raw)) return null;
	const points = [];
	for (const pair of raw) {
		if (!Array.isArray(pair) || pair.length !== 2) return null;
		const [x, y] = pair.map(asNumber);
		if (x === null || y === null) return null;
		points.push({
			x: clamp(x / 255, 0, 1),
			y: clamp(y / 255, 0, 1)
		});
	}
	return points.length >= 2 ? points : null;
}
function mapToneCurves(params, lr) {
	const curves = {
		rgb: readCurve(lr, "ToneCurvePV2012"),
		red: readCurve(lr, "ToneCurvePV2012Red"),
		green: readCurve(lr, "ToneCurvePV2012Green"),
		blue: readCurve(lr, "ToneCurvePV2012Blue")
	};
	if (!Object.values(curves).some(Boolean)) return;
	params.toneCurve = {
		rgb: curves.rgb ?? IDENTITY_CURVE,
		red: curves.red ?? IDENTITY_CURVE,
		green: curves.green ?? IDENTITY_CURVE,
		blue: curves.blue ?? IDENTITY_CURVE
	};
}
function readGradeRange(lr, range, splitToning) {
	const fallback = (key) => splitToning ? `SplitToning${splitToning}${key}` : null;
	const pick = (gradeKey, splitKey, min, max) => readNumber(lr, gradeKey, min, max) ?? (splitKey ? readNumber(lr, splitKey, min, max) : null);
	const hue = pick(`ColorGrade${range}Hue`, fallback("Hue"), 0, 360);
	const sat = pick(`ColorGrade${range}Sat`, fallback("Saturation"), 0, 100);
	const luma = readNumber(lr, `ColorGrade${range}Lum`, -100, 100);
	if (hue === null && sat === null && luma === null) return null;
	return {
		hue: hue ?? 0,
		sat: sat ?? 0,
		luma: luma ?? 0
	};
}
function mapColorGrading(params, lr) {
	const shadows = readGradeRange(lr, "Shadow", "Shadow");
	const midtones = readGradeRange(lr, "Midtone");
	const highlights = readGradeRange(lr, "Highlight", "Highlight");
	const global = readGradeRange(lr, "Global");
	if (!shadows && !midtones && !highlights && !global) return;
	const neutral = {
		hue: 0,
		sat: 0,
		luma: 0
	};
	params.colorGrading = {
		shadows: shadows ?? neutral,
		midtones: midtones ?? neutral,
		highlights: highlights ?? neutral,
		global: global ?? neutral,
		shadowRange: 50,
		highlightRange: 50
	};
}
function mapVignetteParams(params, lr) {
	const amount = readNumber(lr, "PostCropVignetteAmount", -100, 100);
	const midpoint = readNumber(lr, "PostCropVignetteMidpoint", 0, 100);
	const roundness = readNumber(lr, "PostCropVignetteRoundness", -100, 100);
	const feather = readNumber(lr, "PostCropVignetteFeather", 0, 100);
	const highlights = readNumber(lr, "PostCropVignetteHighlightContrast", 0, 100);
	if ([amount, midpoint, roundness, feather, highlights].every((v) => v === null)) return;
	params.vignette = {
		amount: amount ?? 0,
		midpoint: midpoint ?? 50,
		roundness: roundness ?? 0,
		feather: feather ?? 50,
		highlights: highlights ?? 0
	};
}
function mapGrainParams(params, lr) {
	const amount = readNumber(lr, "GrainAmount", 0, 100);
	const size = readNumber(lr, "GrainSize", 25, 100);
	const roughness = readNumber(lr, "GrainFrequency", 0, 100);
	if (amount === null && size === null && roughness === null) return;
	params.grain = {
		amount: amount ?? 0,
		size: size ?? 25,
		roughness: roughness ?? 50,
		color: 0
	};
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