/*
 * The two complete pickers: the square with the hue bar (jscolor and spectrum) and the colour wheel (farbtastic).
 */
import React from 'react';

import { clamp, type Hsl, type Hsv } from './color';
import { type ColorTheme, HueBar, Marker, SvPad } from './Controls';
import { useElementSize, usePointerDrag } from './hooks';

/**
 * Saturation/value square with the hue bar next to it - the picker of jscolor and of spectrum.
 *
 * It fills the space it gets, so the same component is the popup of a small swatch and the inline picker of a
 * widget that is as large as the view.
 */
export function ColorPanel(props: {
    hsv: Hsv;
    theme: ColorTheme;
    onChange: (hsv: Hsv, final: boolean) => void;
    style?: React.CSSProperties;
}): React.JSX.Element {
    return (
        <div
            style={{
                display: 'flex',
                gap: 8,
                width: '100%',
                height: '100%',
                minHeight: 0,
                boxSizing: 'border-box',
                ...props.style,
            }}
        >
            <SvPad
                hsv={props.hsv}
                onChange={(s, v, final) => props.onChange({ ...props.hsv, s, v }, final)}
            />
            <HueBar
                hue={props.hsv.h}
                vertical
                onChange={(h, final) => props.onChange({ ...props.hsv, h }, final)}
                style={{ width: 22, flex: '0 0 auto' }}
            />
        </div>
    );
}

/**
 * The colour wheel of farbtastic: a hue ring with a saturation/lightness square inside.
 *
 * The widget may be any size; the wheel is the largest circle that fits and stays centred.
 */
export function ColorWheel(props: {
    hsl: Hsl;
    onChange: (hsl: Hsl, final: boolean) => void;
    style?: React.CSSProperties;
}): React.JSX.Element {
    const ref = React.useRef<HTMLDivElement | null>(null);
    const box = useElementSize(ref);
    const size = Math.max(0, Math.min(box.width, box.height));

    const outer = size / 2;
    const ring = Math.max(6, size * 0.13);
    const inner = outer - ring;
    const square = Math.max(0, inner * 1.41);

    const ringHandlers = usePointerDrag((x, y, final) => {
        const dx = x - 0.5;
        const dy = y - 0.5;
        // the square inside the ring has its own handler; the corners of the hole must not change the hue
        if (Math.sqrt(dx * dx + dy * dy) * size < inner * 0.98) {
            return;
        }
        const hue = (Math.atan2(dx, -dy) * 180) / Math.PI;
        props.onChange({ ...props.hsl, h: (hue + 360) % 360 }, final);
    });

    const squareHandlers = usePointerDrag((x, y, final) =>
        props.onChange({ ...props.hsl, s: clamp(x, 0, 1), l: clamp(1 - y, 0, 1) }, final),
    );

    const angle = (clamp(props.hsl.h, 0, 360) * Math.PI) / 180;
    const markerRadius = (outer + inner) / 2;

    return (
        <div
            ref={ref}
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                ...props.style,
            }}
        >
            <div
                style={{ position: 'relative', width: size, height: size, flex: '0 0 auto' }}
                {...ringHandlers}
            >
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '50%',
                        cursor: 'pointer',
                        touchAction: 'none',
                        background: 'conic-gradient(#ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                        // punches the hole for the square out of the ring
                        WebkitMaskImage: `radial-gradient(circle at 50% 50%, transparent ${inner}px, #000 ${inner + 1}px)`,
                        maskImage: `radial-gradient(circle at 50% 50%, transparent ${inner}px, #000 ${inner + 1}px)`,
                    }}
                />
                {size ? (
                    <Marker
                        x={0.5 + (Math.sin(angle) * markerRadius) / size}
                        y={0.5 - (Math.cos(angle) * markerRadius) / size}
                        color={`hsl(${props.hsl.h}, 100%, 50%)`}
                    />
                ) : null}
                <div
                    {...squareHandlers}
                    style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        width: square,
                        height: square,
                        marginLeft: -square / 2,
                        marginTop: -square / 2,
                        cursor: 'crosshair',
                        touchAction: 'none',
                        borderRadius: 2,
                        background:
                            'linear-gradient(to bottom, #ffffff, rgba(255, 255, 255, 0) 50%, rgba(0, 0, 0, 0) 50%, #000000), ' +
                            `linear-gradient(to right, #808080, hsl(${props.hsl.h}, 100%, 50%))`,
                    }}
                >
                    <Marker
                        x={clamp(props.hsl.s, 0, 1)}
                        y={1 - clamp(props.hsl.l, 0, 1)}
                        size={12}
                    />
                </div>
            </div>
        </div>
    );
}
