/*
 * Colour conversions.
 *
 * The vis-1 widget set got these from its four libraries (jscolor, spectrum, farbtastic and the jQuery colour
 * picker), each with its own ranges. Here they exist once, with the ranges the widgets store in ioBroker:
 *
 * - RGB: 0..255 per channel
 * - HSV: hue 0..360, saturation and value 0..100 (the ranges of jscolor)
 * - HSL: hue 0..360, saturation and lightness 0..1 (the ranges of spectrum)
 */

/** Red, green and blue, 0..255 */
export interface Rgb {
    r: number;
    g: number;
    b: number;
}

/** Hue 0..360, saturation and value 0..100 */
export interface Hsv {
    h: number;
    s: number;
    v: number;
}

/** Hue 0..360, saturation and lightness 0..1 */
export interface Hsl {
    h: number;
    s: number;
    l: number;
}

export function clamp(value: number, min: number, max: number): number {
    return value < min ? min : value > max ? max : value;
}

/** `true`, `'true'` and `1` are true; everything else is false */
export function isTrue(value: unknown): boolean {
    return value === true || value === 'true' || value === 1 || value === '1';
}

/** `undefined`, `null` and `''` all mean "the user did not set this attribute" */
export function isSet(value: unknown): boolean {
    return value !== undefined && value !== null && value !== '';
}

/** Parses a value that may be a number, a numeric string or empty. Returns `defaultValue` when it is not a number */
export function toNumber(value: unknown, defaultValue = 0): number {
    if (typeof value === 'number') {
        return isFinite(value) ? value : defaultValue;
    }
    if (typeof value !== 'string' || value === '') {
        return defaultValue;
    }
    const parsed = parseFloat(value.replace(',', '.'));
    return isFinite(parsed) ? parsed : defaultValue;
}

/** Same as `toNumber`, but rounds to an integer - the counterpart of the `parseInt(x, 10) || d` of the vis-1 set */
export function toInt(value: unknown, defaultValue = 0): number {
    const parsed = toNumber(value, NaN);
    return isNaN(parsed) ? defaultValue : Math.round(parsed);
}

/** Rounds to `digits` places after the comma, the way the vis-1 set wrote its values (`parseFloat(x.toFixed(d))`) */
export function round(value: number, digits: number): number {
    return parseFloat(value.toFixed(clamp(Math.round(digits), 0, 10)));
}

function hex2(value: number): string {
    const text = Math.round(clamp(value, 0, 255)).toString(16);
    return text.length === 1 ? `0${text}` : text;
}

/** `#rrggbb`, lower case - the format the widgets write into an RGB state */
export function rgbToHex(rgb: Rgb): string {
    return `#${hex2(rgb.r)}${hex2(rgb.g)}${hex2(rgb.b)}`;
}

/**
 * Anything the widgets may find in a state: `#rgb`, `#rrggbb`, `rgb(…)`, `rgba(…)`, `hsl(…)`, `hsv(…)` and the few
 * colour names the palettes of the vis-1 set used. Returns `null` if it is none of them.
 */
export function parseColor(value: unknown): Rgb | null {
    if (typeof value !== 'string' && typeof value !== 'number') {
        return null;
    }
    const text = `${value}`.trim().toLowerCase();
    if (!text) {
        return null;
    }

    if (text === 'white') {
        return { r: 255, g: 255, b: 255 };
    }
    if (text === 'black') {
        return { r: 0, g: 0, b: 0 };
    }

    const hex = text.startsWith('#') ? text.substring(1) : /^[0-9a-f]{3}$|^[0-9a-f]{6}$/.test(text) ? text : '';
    if (hex.length === 3) {
        return {
            r: parseInt(hex[0] + hex[0], 16),
            g: parseInt(hex[1] + hex[1], 16),
            b: parseInt(hex[2] + hex[2], 16),
        };
    }
    if (hex.length === 6) {
        return {
            r: parseInt(hex.substring(0, 2), 16),
            g: parseInt(hex.substring(2, 4), 16),
            b: parseInt(hex.substring(4, 6), 16),
        };
    }

    const func = text.match(/^(rgba?|hsla?|hsva?|hsba?)\s*\(([^)]*)\)$/);
    if (func) {
        const parts = func[2].split(',').map(part => parseFloat(part.replace(',', '.')));
        if (parts.length < 3 || parts.some(part => !isFinite(part))) {
            return null;
        }
        if (func[1].startsWith('rgb')) {
            return { r: clamp(parts[0], 0, 255), g: clamp(parts[1], 0, 255), b: clamp(parts[2], 0, 255) };
        }
        // percent values of hsl()/hsv() are written with a `%`, which parseFloat drops - both are 0..100 anyway
        if (func[1].startsWith('hsl')) {
            return hslToRgb({ h: parts[0], s: parts[1] / 100, l: parts[2] / 100 });
        }
        return hsvToRgb({ h: parts[0], s: parts[1], v: parts[2] });
    }

    return null;
}

/** RGB 0..255 -> HSV (0..360, 0..100, 0..100) */
export function rgbToHsv(rgb: Rgb): Hsv {
    const r = clamp(rgb.r, 0, 255) / 255;
    const g = clamp(rgb.g, 0, 255) / 255;
    const b = clamp(rgb.b, 0, 255) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let h = 0;
    if (delta) {
        if (max === r) {
            h = 60 * (((g - b) / delta) % 6);
        } else if (max === g) {
            h = 60 * ((b - r) / delta + 2);
        } else {
            h = 60 * ((r - g) / delta + 4);
        }
    }
    if (h < 0) {
        h += 360;
    }

    return { h, s: max ? (delta / max) * 100 : 0, v: max * 100 };
}

/** HSV (0..360, 0..100, 0..100) -> RGB 0..255 */
export function hsvToRgb(hsv: Hsv): Rgb {
    const h = ((hsv.h % 360) + 360) % 360;
    const s = clamp(hsv.s, 0, 100) / 100;
    const v = clamp(hsv.v, 0, 100) / 100;

    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;

    let rgb: [number, number, number];
    if (h < 60) {
        rgb = [c, x, 0];
    } else if (h < 120) {
        rgb = [x, c, 0];
    } else if (h < 180) {
        rgb = [0, c, x];
    } else if (h < 240) {
        rgb = [0, x, c];
    } else if (h < 300) {
        rgb = [x, 0, c];
    } else {
        rgb = [c, 0, x];
    }

    return {
        r: Math.round((rgb[0] + m) * 255),
        g: Math.round((rgb[1] + m) * 255),
        b: Math.round((rgb[2] + m) * 255),
    };
}

/** RGB 0..255 -> HSL (0..360, 0..1, 0..1) */
export function rgbToHsl(rgb: Rgb): Hsl {
    const r = clamp(rgb.r, 0, 255) / 255;
    const g = clamp(rgb.g, 0, 255) / 255;
    const b = clamp(rgb.b, 0, 255) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const l = (max + min) / 2;

    let h = 0;
    if (delta) {
        if (max === r) {
            h = 60 * (((g - b) / delta) % 6);
        } else if (max === g) {
            h = 60 * ((b - r) / delta + 2);
        } else {
            h = 60 * ((r - g) / delta + 4);
        }
    }
    if (h < 0) {
        h += 360;
    }

    return { h, s: delta ? delta / (1 - Math.abs(2 * l - 1)) : 0, l };
}

/** HSL (0..360, 0..1, 0..1) -> RGB 0..255 */
export function hslToRgb(hsl: Hsl): Rgb {
    const h = ((hsl.h % 360) + 360) % 360;
    const s = clamp(hsl.s, 0, 1);
    const l = clamp(hsl.l, 0, 1);

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;

    let rgb: [number, number, number];
    if (h < 60) {
        rgb = [c, x, 0];
    } else if (h < 120) {
        rgb = [x, c, 0];
    } else if (h < 180) {
        rgb = [0, c, x];
    } else if (h < 240) {
        rgb = [0, x, c];
    } else if (h < 300) {
        rgb = [x, 0, c];
    } else {
        rgb = [c, 0, x];
    }

    return {
        r: Math.round((rgb[0] + m) * 255),
        g: Math.round((rgb[1] + m) * 255),
        b: Math.round((rgb[2] + m) * 255),
    };
}

export function hsvToHex(hsv: Hsv): string {
    return rgbToHex(hsvToRgb(hsv));
}

/** Black or white, whichever is readable on that colour - for the text of a swatch */
export function contrastColor(rgb: Rgb): string {
    // Rec. 709 luma
    return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b > 150 ? '#000000' : '#ffffff';
}

export function sameRgb(a: Rgb | null, b: Rgb | null): boolean {
    if (!a || !b) {
        return a === b;
    }
    return (
        Math.round(a.r) === Math.round(b.r) &&
        Math.round(a.g) === Math.round(b.g) &&
        Math.round(a.b) === Math.round(b.b)
    );
}
