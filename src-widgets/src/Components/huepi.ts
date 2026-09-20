/*
 * The colour maths of the Philips HUE widgets.
 *
 * A TypeScript port of `widgets/colorpicker/js/huepiHelper.js` of the vis-1 widget set (huepi, MIT, Kees Lokhorst
 * and contributors), reduced to what the widgets really use: the gamut of a lamp, CIE xy <-> RGB and the colour
 * of a temperature. The numbers are the ones of the original, so a picker draws the same image as in vis-1.
 *
 * Unlike the original, `gamutOf()` also accepts the gamut letters `A`, `B` and `C` - the tooltip of the widget
 * attribute always promised them, but the vis-1 code only knew model ids.
 */
import type { Rgb } from './color';

/** A colour in the ranges of huepi: every channel 0..1 */
export interface RgbFloat {
    red: number;
    green: number;
    blue: number;
}

export interface Point {
    x: number;
    y: number;
}

export interface Gamut {
    red: Point;
    green: Point;
    blue: Point;
}

/** http://www.developers.meethue.com/documentation/supported-lights */
const MODELS: Record<'a' | 'b' | 'c', string[]> = {
    a: ['LST001', 'LLC010', 'LLC011', 'LLC012', 'LLC005', 'LLC006', 'LLC007', 'LLC013', 'LLC014'],
    b: ['LCT001', 'LCT007', 'LCT002', 'LCT003', 'LLM001'],
    c: ['LCT010', 'LCT014', 'LCT015', 'LCT016', 'LCT011', 'LCT012', 'LLC020', 'LST002'],
};

const GAMUTS: Record<'a' | 'b' | 'c' | 'default', Gamut> = {
    a: { red: { x: 0.704, y: 0.296 }, green: { x: 0.2151, y: 0.7106 }, blue: { x: 0.138, y: 0.08 } },
    b: { red: { x: 0.675, y: 0.322 }, green: { x: 0.409, y: 0.518 }, blue: { x: 0.167, y: 0.04 } },
    c: { red: { x: 0.692, y: 0.308 }, green: { x: 0.17, y: 0.7 }, blue: { x: 0.153, y: 0.048 } },
    // the whole xy plane - what the vis-1 helper used for an unknown model
    default: { red: { x: 1, y: 0 }, green: { x: 0, y: 1 }, blue: { x: 0, y: 0 } },
};

/** The gamut of a lamp: by model id (`LCT001`), by gamut letter (`A`, `B`, `C`) or the whole plane */
export function gamutOf(model?: string): Gamut {
    const name = (model || '').trim();
    if (!name) {
        return GAMUTS.default;
    }
    const letter = name.toLowerCase();
    if (letter === 'a' || letter === 'b' || letter === 'c') {
        return GAMUTS[letter];
    }
    const upper = name.toUpperCase();
    for (const key of ['a', 'b', 'c'] as const) {
        if (MODELS[key].includes(upper)) {
            return GAMUTS[key];
        }
    }
    return GAMUTS.default;
}

/**
 * The point itself if it lies inside the triangle of the gamut, otherwise the closest point on its edge.
 *
 * A lamp cannot produce a colour outside its triangle; sending one anyway gives a colour that does not match what
 * the picker showed.
 */
export function gamutXY(px: number, py: number, gamut: Gamut): Point {
    const { red, green, blue } = gamut;

    const vbr = { x: red.x - blue.x, y: red.y - blue.y }; // blue to red
    const vrg = { x: green.x - red.x, y: green.y - red.y }; // red to green
    const vgb = { x: blue.x - green.x, y: blue.y - green.y }; // green to blue

    const gbr = (green.x - blue.x) * vbr.y - (green.y - blue.y) * vbr.x;
    const brg = (blue.x - red.x) * vrg.y - (blue.y - red.y) * vrg.x;
    const rgb = (red.x - green.x) * vgb.y - (red.y - green.y) * vgb.x;

    const vbp = { x: px - blue.x, y: py - blue.y };
    const vrp = { x: px - red.x, y: py - red.y };
    const vgp = { x: px - green.x, y: py - green.y };

    const pbr = vbp.x * vbr.y - vbp.y * vbr.x;
    const prg = vrp.x * vrg.y - vrp.y * vrg.x;
    const pgb = vgp.x * vgb.y - vgp.y * vgb.x;

    if (gbr * pbr >= 0 && brg * prg >= 0 && rgb * pgb >= 0) {
        return { x: px, y: py };
    }

    // outside: the closest point on the edge it is outside of, or the vertex behind its end
    const onEdge = (from: Point, vector: Point, point: Point, to: Point): Point => {
        const normDot =
            ((point.x - from.x) * vector.x + (point.y - from.y) * vector.y) /
            (vector.x * vector.x + vector.y * vector.y);
        if (normDot < 0) {
            return { x: from.x, y: from.y };
        }
        if (normDot > 1) {
            return { x: to.x, y: to.y };
        }
        return { x: from.x + normDot * vector.x, y: from.y + normDot * vector.y };
    };

    if (gbr * pbr <= 0) {
        return onEdge(blue, vbr, { x: px, y: py }, red);
    }
    if (brg * prg <= 0) {
        return onEdge(red, vrg, { x: px, y: py }, green);
    }
    return onEdge(green, vgb, { x: px, y: py }, blue);
}

/** The corners of the drawn area: the gamut plus 0.05 on every side, clipped to the xy plane */
function zoomBox(gamut: Gamut): { x0: number; x1: number; y0: number; y1: number } {
    return {
        x0: Math.max(0, gamut.blue.x - 0.05),
        x1: Math.min(1, gamut.red.x + 0.05),
        y0: Math.max(0, gamut.blue.y - 0.05),
        y1: Math.min(1, gamut.green.y + 0.05),
    };
}

/** Position in the picker (0..1 from the lower left corner) -> CIE xy */
export function zoomXY(px: number, py: number, gamut: Gamut): Point {
    const box = zoomBox(gamut);
    return { x: px * (box.x1 - box.x0) + box.x0, y: py * (box.y1 - box.y0) + box.y0 };
}

/** CIE xy -> position in the picker (0..1 from the lower left corner) */
export function unzoomXY(x: number, y: number, gamut: Gamut): Point {
    const box = zoomBox(gamut);
    return {
        x: Math.max(0, Math.min(1, (x - box.x0) / (box.x1 - box.x0))),
        y: Math.max(0, Math.min(1, (y - box.y0) / (box.y1 - box.y0))),
    };
}

/** CIE xy plus a brightness 0..1 -> RGB, every channel 0..1 (Wide RGB D65, as Philips documents it) */
export function xyToRgb(x: number, y: number, brightness = 1): RgbFloat {
    const bri = brightness;
    const z = 1 - x - y;
    const capY = bri;
    const capX = y === 0 ? 0 : (capY / y) * x;
    const capZ = y === 0 ? 0 : (capY / y) * z;

    let red = capX * 1.656492 - capY * 0.354851 - capZ * 0.255038;
    let green = -capX * 0.707196 + capY * 1.655397 + capZ * 0.036152;
    let blue = capX * 0.051713 - capY * 0.121364 + capZ * 1.01153;

    const limit = (): void => {
        if (red > blue && red > green && red > 1) {
            green /= red;
            blue /= red;
            red = 1;
        }
        if (red < 0) {
            red = 0;
        }
        if (green > blue && green > red && green > 1) {
            red /= green;
            blue /= green;
            green = 1;
        }
        if (green < 0) {
            green = 0;
        }
        if (blue > red && blue > green && blue > 1) {
            red /= blue;
            green /= blue;
            blue = 1;
        }
        if (blue < 0) {
            blue = 0;
        }
    };

    limit();

    // reverse gamma correction
    const gamma = (value: number): number => (value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055);
    red = gamma(red);
    green = gamma(green);
    blue = gamma(blue);

    limit();

    return { red, green, blue };
}

/** The same, but the point is pulled into the gamut of the lamp first */
export function xyToRgbForGamut(x: number, y: number, brightness: number, gamut: Gamut): RgbFloat {
    const point = gamutXY(x, y, gamut);
    return xyToRgb(point.x, point.y, brightness);
}

/** RGB, every channel 0..1 -> CIE xy */
export function rgbToXy(red: number, green: number, blue: number): Point {
    const gamma = (value: number): number => (value > 0.04045 ? ((value + 0.055) / 1.055) ** 2.4 : value / 12.92);
    const r = gamma(red);
    const g = gamma(green);
    const b = gamma(blue);

    const x = r * 0.664511 + g * 0.154324 + b * 0.162028;
    const y = r * 0.283881 + g * 0.668433 + b * 0.047685;
    const z = r * 0.000088 + g * 0.07231 + b * 0.986039;

    if (x + y + z === 0) {
        return { x: 0, y: 0 };
    }
    return { x: x / (x + y + z), y: y / (x + y + z) };
}

/** Colour of a black body radiator, 1000..66000 K -> RGB, every channel 0..1 */
export function colorTemperatureToRgb(kelvin: number): RgbFloat {
    // http://www.tannerhelland.com/4435/convert-temperature-rgb-algorithm-code/, with the red of huepi, which
    // keeps the warm end at a lamp-like orange instead of a saturated red
    const temperature = kelvin / 100;
    let red: number;
    let green: number;
    let blue: number;

    if (temperature <= 66) {
        red = 165 + 90 * (temperature / 66);
    } else {
        red = Math.min(255, Math.max(0, 329.698727466 * (temperature - 60) ** -0.1332047592));
    }

    if (temperature <= 66) {
        green = Math.min(255, Math.max(0, 99.4708025861 * Math.log(temperature) - 161.1195681661));
    } else {
        green = Math.min(255, Math.max(0, 288.1221695283 * (temperature - 60) ** -0.0755148492));
    }

    if (temperature >= 66) {
        blue = 255;
    } else if (temperature <= 19) {
        blue = 0;
    } else {
        blue = Math.min(255, Math.max(0, 138.5177312231 * Math.log(temperature - 10) - 305.0447927307));
    }

    return { red: red / 255, green: green / 255, blue: blue / 255 };
}

export function floatToRgb(color: RgbFloat): Rgb {
    return {
        r: Math.round(color.red * 255),
        g: Math.round(color.green * 255),
        b: Math.round(color.blue * 255),
    };
}

/** Mired (the unit of the `ct` state of a HUE lamp) -> Kelvin */
export function miredToKelvin(mired: number): number {
    return mired ? 1e6 / mired : 0;
}

/** Kelvin -> mired */
export function kelvinToMired(kelvin: number): number {
    return kelvin ? 1e6 / kelvin : 0;
}
