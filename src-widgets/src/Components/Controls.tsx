/*
 * The parts every picker is built from: the saturation/value pad, the hue bar, a gradient slider, the colour
 * swatch and the popup panel.
 *
 * All of them are plain HTML with CSS gradients - no MUI, no canvas, so they scale to any widget size and stay
 * sharp on a phone. Only the two HUE pickers draw into a canvas, they have their own components.
 */
import React from 'react';

import { clamp, contrastColor, hsvToHex, type Hsv, type Rgb, rgbToHex } from './color';
import { usePointerDrag } from './hooks';

/** The colours a picker takes from the vis-2 theme */
export interface ColorTheme {
    dark: boolean;
    text: string;
    secondary: string;
    paper: string;
    border: string;
    primary: string;
    fontFamily: string;
}

/** Background of the hue bar, from red to red over the full circle */
export const HUE_GRADIENT = (direction: string): string =>
    `linear-gradient(${direction}, #ff0000 0%, #ffff00 16.66%, #00ff00 33.33%, #00ffff 50%, #0000ff 66.66%, #ff00ff 83.33%, #ff0000 100%)`;

/** The grey chequerboard under a colour that is not known yet */
export const CHECKERBOARD =
    'repeating-conic-gradient(rgba(128, 128, 128, 0.45) 0% 25%, rgba(255, 255, 255, 0.45) 0% 50%) 50% / 12px 12px';

/**
 * The round marker of a pad or a slider: a white ring with a dark outline, so it is visible on every colour.
 *
 * `inset` keeps the whole marker inside the element - a slider whose marker may hang over its end would lose
 * half of it in a widget that clips its content.
 */
export function Marker(props: {
    x: number;
    y: number;
    size?: number;
    color?: string;
    inset?: boolean;
}): React.JSX.Element {
    const size = props.size || 14;
    const place = (position: number): string =>
        props.inset ? `calc(${size / 2}px + ${position} * (100% - ${size}px))` : `${position * 100}%`;

    return (
        <div
            style={{
                position: 'absolute',
                left: place(props.x),
                top: place(props.y),
                width: size,
                height: size,
                marginLeft: -size / 2,
                marginTop: -size / 2,
                borderRadius: '50%',
                border: '2px solid #ffffff',
                boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.55), inset 0 0 0 1px rgba(0, 0, 0, 0.35)',
                background: props.color || 'transparent',
                pointerEvents: 'none',
                boxSizing: 'border-box',
            }}
        />
    );
}

/**
 * Saturation and value of one hue: saturation from left to right, value from bottom to top.
 *
 * That is the square of jscolor and of spectrum, drawn with two gradients over the pure hue.
 */
export function SvPad(props: {
    hsv: Hsv;
    onChange: (s: number, v: number, final: boolean) => void;
    style?: React.CSSProperties;
}): React.JSX.Element {
    const handlers = usePointerDrag((x, y, final) => props.onChange(x * 100, (1 - y) * 100, final));

    return (
        <div
            {...handlers}
            style={{
                position: 'relative',
                flex: 1,
                minWidth: 0,
                minHeight: 0,
                cursor: 'crosshair',
                touchAction: 'none',
                borderRadius: 4,
                background:
                    'linear-gradient(to top, #000000, rgba(0, 0, 0, 0)), ' +
                    'linear-gradient(to right, #ffffff, rgba(255, 255, 255, 0)), ' +
                    `hsl(${props.hsv.h}, 100%, 50%)`,
                ...props.style,
            }}
        >
            <Marker
                x={clamp(props.hsv.s, 0, 100) / 100}
                y={1 - clamp(props.hsv.v, 0, 100) / 100}
                color={hsvToHex(props.hsv)}
            />
        </div>
    );
}

/** The hue of the colour, 0..360 */
export function HueBar(props: {
    hue: number;
    vertical?: boolean;
    onChange: (hue: number, final: boolean) => void;
    style?: React.CSSProperties;
}): React.JSX.Element {
    const handlers = usePointerDrag((x, y, final) => props.onChange((props.vertical ? y : x) * 360, final));
    const position = clamp(props.hue, 0, 360) / 360;

    return (
        <div
            {...handlers}
            style={{
                position: 'relative',
                cursor: 'pointer',
                touchAction: 'none',
                borderRadius: 4,
                background: HUE_GRADIENT(props.vertical ? 'to bottom' : 'to right'),
                ...props.style,
            }}
        >
            <Marker
                x={props.vertical ? 0.5 : position}
                y={props.vertical ? position : 0.5}
                color={`hsl(${props.hue}, 100%, 50%)`}
                inset
            />
        </div>
    );
}

/**
 * A slider with a background of its own, for the brightness of a HUE lamp and the lightness of the wheel.
 *
 * Upright it runs from 1 at the top to 0 at the bottom, which is how the brightness slider of the CIE picker of
 * the vis-1 set worked.
 */
export function GradientSlider(props: {
    value: number;
    background: string;
    vertical?: boolean;
    onChange: (value: number, final: boolean) => void;
    style?: React.CSSProperties;
}): React.JSX.Element {
    const handlers = usePointerDrag((x, y, final) => props.onChange(props.vertical ? 1 - y : x, final));
    const position = clamp(props.value, 0, 1);

    return (
        <div
            {...handlers}
            style={{
                position: 'relative',
                cursor: 'pointer',
                touchAction: 'none',
                borderRadius: 4,
                background: props.background,
                ...props.style,
            }}
        >
            <Marker
                x={props.vertical ? 0.5 : position}
                y={props.vertical ? 1 - position : 0.5}
                inset
            />
        </div>
    );
}

/** The box that shows the current colour and opens the picker - the counterpart of the input of the vis-1 set */
export function Swatch(props: {
    color: Rgb | null;
    theme: ColorTheme;
    label?: string;
    onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
    style?: React.CSSProperties;
    children?: React.ReactNode;
}): React.JSX.Element {
    const background = props.color ? rgbToHex(props.color) : CHECKERBOARD;

    return (
        <div
            onClick={props.onClick}
            data-colorpicker="swatch"
            style={{
                width: '100%',
                height: '100%',
                boxSizing: 'border-box',
                border: `1px solid ${props.theme.border}`,
                borderRadius: 4,
                background,
                cursor: props.onClick ? 'pointer' : undefined,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                color: props.color ? contrastColor(props.color) : props.theme.text,
                fontFamily: props.theme.fontFamily,
                ...props.style,
            }}
        >
            {props.children ??
                (props.label ? (
                    <span
                        style={{
                            padding: '0 4px',
                            fontSize: 13,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {props.label}
                    </span>
                ) : null)}
        </div>
    );
}

/** A button of the panel, e.g. "Choose" or "Close" */
export function PanelButton(props: {
    theme: ColorTheme;
    primary?: boolean;
    onClick: () => void;
    children: React.ReactNode;
}): React.JSX.Element {
    return (
        <button
            type="button"
            onClick={props.onClick}
            style={{
                padding: '4px 12px',
                minWidth: 64,
                border: `1px solid ${props.primary ? props.theme.primary : props.theme.border}`,
                borderRadius: 4,
                cursor: 'pointer',
                fontFamily: props.theme.fontFamily,
                fontSize: 13,
                background: props.primary ? props.theme.primary : 'transparent',
                color: props.primary ? '#ffffff' : props.theme.text,
            }}
        >
            {props.children}
        </button>
    );
}

/**
 * The panel of a picker that is not shown inline.
 *
 * It hangs under the widget and closes on a click somewhere else or with Escape, like the popups of jscolor and
 * spectrum did. If it would leave the window it is moved back in - a widget at the right edge of a view would
 * otherwise open its picker outside the screen.
 */
export function Popup(props: {
    theme: ColorTheme;
    onClose: () => void;
    width?: number | string;
    children: React.ReactNode;
}): React.JSX.Element {
    const ref = React.useRef<HTMLDivElement | null>(null);
    const [offset, setOffset] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });

    React.useEffect(() => {
        const onPointerDown = (event: PointerEvent): void => {
            // The panel is a child of the widget, so its parent covers the colour box as well: a press on the box
            // must not close the panel here, otherwise the click that follows would open it again right away.
            const inside = ref.current?.parentElement || ref.current;
            if (inside && !inside.contains(event.target as Node)) {
                props.onClose();
            }
        };
        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') {
                props.onClose();
            }
        };
        // `true`: the panel closes before a widget under it gets the click
        window.document.addEventListener('pointerdown', onPointerDown, true);
        window.document.addEventListener('keydown', onKeyDown);
        return () => {
            window.document.removeEventListener('pointerdown', onPointerDown, true);
            window.document.removeEventListener('keydown', onKeyDown);
        };
    }, [props]);

    React.useLayoutEffect(() => {
        const element = ref.current;
        if (!element) {
            return;
        }
        const box = element.getBoundingClientRect();
        let x = 0;
        let y = 0;
        if (box.right > window.innerWidth - 8) {
            x = Math.max(-box.left + 8, window.innerWidth - 8 - box.right);
        }
        if (box.bottom > window.innerHeight - 8) {
            // above the widget if there is no room under it
            y = Math.max(-box.top + 8, window.innerHeight - 8 - box.bottom);
        }
        setOffset(old => (old.x === x && old.y === y ? old : { x, y }));
    }, []);

    return (
        <div
            ref={ref}
            onClick={event => event.stopPropagation()}
            style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                zIndex: 1300,
                marginTop: 4,
                padding: 8,
                width: props.width,
                boxSizing: 'border-box',
                borderRadius: 4,
                border: `1px solid ${props.theme.border}`,
                background: props.theme.paper,
                color: props.theme.text,
                fontFamily: props.theme.fontFamily,
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
                transform: offset.x || offset.y ? `translate(${offset.x}px, ${offset.y}px)` : undefined,
            }}
        >
            {props.children}
        </div>
    );
}
