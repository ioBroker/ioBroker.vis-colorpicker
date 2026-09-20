/*
 * The two hooks every picker needs: its own size and the position of the finger or the mouse on it.
 */
import React from 'react';

import { clamp } from './color';

export interface Size {
    width: number;
    height: number;
}

/** The size of an element, measured with a `ResizeObserver` - the widgets draw in the pixels they really have */
export function useElementSize(ref: React.RefObject<HTMLElement | null>): Size {
    const [size, setSize] = React.useState<Size>({ width: 0, height: 0 });

    React.useEffect(() => {
        const element = ref.current;
        if (!element) {
            return;
        }
        const apply = (): void => {
            const box = element.getBoundingClientRect();
            setSize(old =>
                Math.round(old.width) === Math.round(box.width) && Math.round(old.height) === Math.round(box.height)
                    ? old
                    : { width: box.width, height: box.height },
            );
        };
        apply();
        const observer = new ResizeObserver(apply);
        observer.observe(element);
        return () => observer.disconnect();
    }, [ref]);

    return size;
}

export interface DragHandlers {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void;
}

/**
 * Turns pointer events into a position on the element, `0..1` from its top left corner.
 *
 * The pointer is captured on the first event, so a finger or a mouse that leaves the picker while dragging keeps
 * moving the marker - that is what the vis-1 pickers did with their document-wide `mousemove` handlers.
 *
 * `final` is true for the last call of a gesture, so a widget can send the value it writes throttled one last
 * time when the user lets go.
 */
export function usePointerDrag(onPick: (x: number, y: number, final: boolean) => void): DragHandlers {
    const dragging = React.useRef(false);

    const position = (event: React.PointerEvent<HTMLElement>): { x: number; y: number } => {
        const box = event.currentTarget.getBoundingClientRect();
        return {
            x: box.width ? clamp((event.clientX - box.left) / box.width, 0, 1) : 0,
            y: box.height ? clamp((event.clientY - box.top) / box.height, 0, 1) : 0,
        };
    };

    return {
        onPointerDown: (event: React.PointerEvent<HTMLElement>): void => {
            // only the left mouse button, but every touch and pen
            if (event.pointerType === 'mouse' && event.button !== 0) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            dragging.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            const { x, y } = position(event);
            onPick(x, y, false);
        },
        onPointerMove: (event: React.PointerEvent<HTMLElement>): void => {
            if (!dragging.current) {
                return;
            }
            event.preventDefault();
            const { x, y } = position(event);
            onPick(x, y, false);
        },
        onPointerUp: (event: React.PointerEvent<HTMLElement>): void => {
            if (!dragging.current) {
                return;
            }
            dragging.current = false;
            event.currentTarget.releasePointerCapture?.(event.pointerId);
            const { x, y } = position(event);
            onPick(x, y, true);
        },
        onPointerCancel: (): void => {
            dragging.current = false;
        },
    };
}
