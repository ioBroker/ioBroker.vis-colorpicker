/*
 * Stub of the vis-2 runtime, shared by the development page (`index.html`) and the screenshot page
 * (`shots.html`).
 *
 * Importing this module puts `window.visRxWidget` in place. The widgets extend it, so they may only be imported
 * afterwards - both pages load them with a dynamic `import()` after this module.
 */
import React from 'react';

import en from '../src/i18n/en.json';

const WORDS = en as Record<string, string>;

/** A small copy of the MUI theme that vis-2 hands to the widgets in `context.theme` */
export const THEMES = {
    light: {
        palette: {
            mode: 'light',
            text: { primary: 'rgba(0, 0, 0, 0.87)', secondary: 'rgba(0, 0, 0, 0.6)' },
            background: { paper: '#ffffff', default: '#f0f0f0' },
            primary: { main: '#1976d2', contrastText: '#ffffff' },
        },
        typography: { fontFamily: 'Roboto, Helvetica, Arial, sans-serif' },
    },
    dark: {
        palette: {
            mode: 'dark',
            text: { primary: '#ffffff', secondary: 'rgba(255, 255, 255, 0.7)' },
            background: { paper: '#272727', default: '#121212' },
            primary: { main: '#90caf9', contrastText: 'rgba(0, 0, 0, 0.87)' },
        },
        typography: { fontFamily: 'Roboto, Helvetica, Arial, sans-serif' },
    },
};

export function makeContext(themeType: 'light' | 'dark', setValue?: (id: string, value: any) => void): any {
    return {
        themeType,
        theme: THEMES[themeType],
        systemConfig: { common: { isFloatComma: false } },
        setValue: setValue || ((): void => {}),
        socket: {
            getObject: (): Promise<null> => Promise.resolve(null),
        },
    };
}

class VisRxWidgetStub extends React.Component<any, any> {
    constructor(props: any) {
        super(props);
        this.state = {
            rxData: props.rxData || {},
            rxStyle: props.rxStyle || {},
            values: props.values || {},
            editMode: !!props.editMode,
            visible: true,
        };
    }

    /** The values live in the page, not in the widget - this is what feeds them in on every change */
    static getDerivedStateFromProps(props: any, state: any): any {
        if (
            props.values !== state.values ||
            props.rxData !== state.rxData ||
            props.rxStyle !== state.rxStyle ||
            !!props.editMode !== state.editMode
        ) {
            return {
                values: props.values,
                rxData: props.rxData,
                rxStyle: props.rxStyle || {},
                editMode: !!props.editMode,
            };
        }
        return null;
    }

    static getI18nPrefix(): string {
        return '';
    }

    /** The English words of the widget set, so the buttons of the pickers read as they do in vis-2 */
    static t(key: string, ...args: string[]): string {
        const prefix = (this as any).getI18nPrefix ? (this as any).getI18nPrefix() : '';
        const plain = key.startsWith(prefix) ? key.substring(prefix.length) : key;
        let word = WORDS[plain] || plain;
        for (const arg of args) {
            word = word.replace('%s', arg);
        }
        return word;
    }

    componentDidMount(): void {}

    componentWillUnmount(): void {}

    componentDidUpdate(_prevProps: any, _prevState: any): void {}

    renderWidgetBody(_props: any): any {
        return null;
    }

    render(): React.ReactNode {
        return (this as any).renderWidgetBody({ widget: {}, style: {}, className: '', overlayClassNames: [] });
    }
}

(window as any).visRxWidget = VisRxWidgetStub;

/** Fills in the defaults of `getWidgetInfo()`, the way the vis editor does when a widget is created */
export function withDefaults(Widget: any, data: Record<string, any>): Record<string, any> {
    const info = Widget.getWidgetInfo();
    const result: Record<string, any> = {};
    for (const group of info.visAttrs) {
        for (const field of group.fields) {
            if (field.default !== undefined) {
                result[field.name] = field.default;
            }
        }
    }
    return { ...result, ...data };
}

/** Acknowledged states, `{ 'a.b': 1 }` -> `{ 'a.b.val': 1, 'a.b.ack': true, 'a.b.lc': ... }` */
export function states(map: Record<string, any>): Record<string, any> {
    const values: Record<string, any> = {};
    for (const [id, val] of Object.entries(map)) {
        values[`${id}.val`] = val;
        values[`${id}.ack`] = true;
        values[`${id}.lc`] = Date.now();
    }
    return values;
}

/** The size a widget gets in the editor when it is created */
export function defaultSize(Widget: any): { width: number | string; height: number | string } {
    const style = Widget.getWidgetInfo().visDefaultStyle || {};
    return { width: style.width || 200, height: style.height || 200 };
}
