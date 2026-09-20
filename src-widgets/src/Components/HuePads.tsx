/*
 * The two pickers of the Philips HUE widgets: the CIE xy field of a lamp and the colour temperature bar.
 *
 * The xy field is the only drawing of the widget set that needs a canvas - every pixel has its own colour. It is
 * rendered at most `RESOLUTION` pixels wide and stretched by the browser; the vis-1 widget computed one pixel per
 * screen pixel and re-computed the whole image on every state change, which made a large picker slow.
 */
import React from 'react';

import { clamp } from './color';
import { colorTemperatureToRgb, type Gamut, unzoomXY, xyToRgb, xyToRgbForGamut, zoomXY } from './huepi';
import { useElementSize, usePointerDrag } from './hooks';
import { Marker } from './Controls';

/** Edge length of the computed image; the browser scales it up to the size of the widget */
const RESOLUTION = 160;

/**
 * The xy plane of a lamp, zoomed to its gamut.
 *
 * `x`/`y` are CIE coordinates; `null` means the lamp has no colour yet and no marker is drawn.
 */
export function GamutPad(props: {
    gamut: Gamut;
    x: number | null;
    y: number | null;
    background?: string;
    onPick?: (x: number, y: number, final: boolean) => void;
    style?: React.CSSProperties;
}): React.JSX.Element {
    const ref = React.useRef<HTMLDivElement | null>(null);
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const size = useElementSize(ref);
    const { gamut } = props;

    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }
        const width = RESOLUTION;
        const height = RESOLUTION;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }
        const image = ctx.createImageData(width, height);
        for (let px = 0; px < width; px++) {
            for (let py = 0; py < height; py++) {
                const index = (px + py * width) * 4;
                const point = zoomXY(px / width, 1 - py / height, gamut);
                const inside = xyToRgbForGamut(point.x, point.y, 1, gamut);
                const plain = xyToRgb(point.x, point.y, 1);
                // outside the triangle of the lamp the colour was corrected - shown a little darker, so the
                // gamut of the lamp is visible as in the vis-1 picker
                const scale =
                    plain.red !== inside.red || plain.green !== inside.green || plain.blue !== inside.blue ? 240 : 255;
                image.data[index] = inside.red * scale;
                image.data[index + 1] = inside.green * scale;
                image.data[index + 2] = inside.blue * scale;
                image.data[index + 3] = 255;
            }
        }
        ctx.putImageData(image, 0, 0);
    }, [gamut]);

    const handlers = usePointerDrag((x, y, final) => {
        const point = zoomXY(x, 1 - y, gamut);
        props.onPick?.(point.x, point.y, final);
    });

    const marker = props.x === null || props.y === null ? null : unzoomXY(props.x, props.y, gamut);

    return (
        <div
            ref={ref}
            {...(props.onPick ? handlers : {})}
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                touchAction: 'none',
                cursor: props.onPick ? 'crosshair' : undefined,
                background: props.background,
                ...props.style,
            }}
        >
            <canvas
                ref={canvasRef}
                width={RESOLUTION}
                height={RESOLUTION}
                style={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    // the pixels are interpolated, so the field stays smooth at any widget size
                    imageRendering: 'auto',
                }}
            />
            {marker && size.width && size.height ? (
                <Marker
                    x={marker.x}
                    y={1 - marker.y}
                    size={14}
                />
            ) : null}
        </div>
    );
}

/** The stops of the colour temperature gradient, from the warm to the cold end */
function temperatureGradient(min: number, max: number, direction: string): string {
    const stops: string[] = [];
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
        const color = colorTemperatureToRgb(min + ((max - min) * i) / steps);
        const r = Math.round(color.red * 255);
        const g = Math.round(color.green * 255);
        const b = Math.round(color.blue * 255);
        stops.push(`rgb(${r}, ${g}, ${b}) ${(i / steps) * 100}%`);
    }
    return `linear-gradient(${direction}, ${stops.join(', ')})`;
}

/**
 * The colour temperature of a lamp, from `min` to `max` Kelvin.
 *
 * `kelvin` is the current temperature; `null` draws no marker.
 */
export function CtBar(props: {
    kelvin: number | null;
    min: number;
    max: number;
    onPick?: (kelvin: number, final: boolean) => void;
    style?: React.CSSProperties;
}): React.JSX.Element {
    const { min, max } = props;
    const background = React.useMemo(() => temperatureGradient(min, max, 'to right'), [min, max]);

    const handlers = usePointerDrag((x, _y, final) => props.onPick?.(min + (max - min) * x, final));
    const position = props.kelvin === null ? null : clamp((props.kelvin - min) / (max - min), 0, 1);

    return (
        <div
            {...(props.onPick ? handlers : {})}
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                touchAction: 'none',
                cursor: props.onPick ? 'crosshair' : undefined,
                background,
                ...props.style,
            }}
        >
            {position === null ? null : (
                <div
                    style={{
                        position: 'absolute',
                        // the line stays inside the bar, so a temperature at one of its ends is still visible
                        left: `calc(1.5px + ${position} * (100% - 3px))`,
                        top: 0,
                        bottom: 0,
                        width: 3,
                        marginLeft: -1.5,
                        background: '#ffffff',
                        boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.6)',
                        pointerEvents: 'none',
                    }}
                />
            )}
        </div>
    );
}
