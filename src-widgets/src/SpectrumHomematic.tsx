import React from 'react';

import type { RxRenderWidgetProps, RxWidgetInfo } from '@iobroker/types-vis-2';

import Generic, { type GenericState } from './Generic';
import { clamp, hsvToRgb, isTrue, type Rgb, toNumber } from './Components/color';
import { type ColorTheme, HueBar, PanelButton, Popup, Swatch } from './Components/Controls';

interface SpectrumHomematicRxData {
    'color-oid'?: string;
    inline?: boolean;
}

interface SpectrumHomematicState extends GenericState {
    /** The value of the open panel, 0..200 */
    draft?: number | null;
}

/** The value a Homematic light takes for white */
const WHITE = 200;

/** 0..199 is the hue of the colour circle, 200 and above is white */
export function homematicToRgb(value: number): Rgb {
    if (value >= WHITE) {
        return { r: 255, g: 255, b: 255 };
    }
    return hsvToRgb({ h: (clamp(value, 0, 199) / WHITE) * 360, s: 100, v: 100 });
}

/**
 * Hue 0..360 -> 0..199.
 *
 * The end of the bar is kept at 199: the vis-1 widget rounded 359.x up to 200 and turned the light white when the
 * slider was dragged all the way to the right.
 */
export function hueToHomematic(hue: number): number {
    return clamp(Math.round((hue / 360) * WHITE), 0, WHITE - 1);
}

/**
 * `tplSpectrumHomematic` - the colour of a Homematic RGBW light.
 *
 * These lights take one number: 0..199 is the position on the colour circle, 200 is white. The picker is
 * therefore only the hue bar plus a button for white, exactly like the spectrum instance of vis-1, which forced
 * the saturation to 100% and had a palette with a single white entry.
 */
export default class SpectrumHomematic extends Generic<SpectrumHomematicRxData, SpectrumHomematicState> {
    static getWidgetInfo(): RxWidgetInfo {
        return {
            id: 'tplSpectrumHomematic',
            visSet: 'colorpicker',
            visSetLabel: 'set_label',
            visSetColor: '#a13c9a',
            visWidgetLabel: 'widget_homematic',
            visName: 'Homematic spectrum',
            visHelp: 'help_homematic',
            visOrder: 2,
            visAttrs: [
                {
                    name: 'common',
                    fields: [Generic.oidField('color-oid', 'color_oid'), Generic.inlineField()],
                },
            ],
            visDefaultStyle: { width: 60, height: 34 },
            visPrev: 'widgets/vis-2-widgets-colorpicker/img/prev_homematic.png',
        };
    }

    // eslint-disable-next-line class-methods-use-this
    getWidgetInfo(): RxWidgetInfo {
        return SpectrumHomematic.getWidgetInfo();
    }

    /** The value of the light, `null` while the state has none */
    private getValue(): number | null {
        const value = this.getStateValue('color-oid');
        if (value === undefined || value === null || value === '') {
            return null;
        }
        return clamp(toNumber(value, 0), 0, WHITE);
    }

    protected hasStateValue(): boolean {
        return this.getValue() !== null;
    }

    private write(value: number, final: boolean): void {
        this.keepLocal(homematicToRgb(value));
        this.send(() => this.setStateValue('color-oid', value), final);
    }

    private renderPicker(value: number, theme: ColorTheme, live: boolean): React.JSX.Element {
        const hue = value >= WHITE ? 0 : (value / WHITE) * 360;
        const preview = homematicToRgb(value);
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', height: '100%' }}>
                <HueBar
                    hue={hue}
                    onChange={(next, final) => {
                        const converted = hueToHomematic(next);
                        if (live) {
                            this.write(converted, final);
                        } else {
                            this.setState({ draft: converted });
                        }
                    }}
                    style={{ flex: 1, minHeight: 24 }}
                />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <PanelButton
                        theme={theme}
                        onClick={() => (live ? this.write(WHITE, true) : this.setState({ draft: WHITE }))}
                    >
                        {SpectrumHomematic.t('white')}
                    </PanelButton>
                    <div
                        style={{
                            flex: 1,
                            height: 24,
                            borderRadius: 4,
                            border: `1px solid ${theme.border}`,
                            background: `rgb(${preview.r}, ${preview.g}, ${preview.b})`,
                        }}
                    />
                </div>
            </div>
        );
    }

    renderWidgetBody(props: RxRenderWidgetProps): React.JSX.Element | React.JSX.Element[] | null {
        super.renderWidgetBody(props);

        const theme = this.getColorTheme();
        const value = this.getValue();
        const color = this.state.local ?? (value === null ? null : homematicToRgb(value));

        if (isTrue(this.state.rxData.inline)) {
            return (
                <div style={{ width: '100%', height: '100%', position: 'relative', boxSizing: 'border-box' }}>
                    {this.renderPicker(value ?? 0, theme, true)}
                </div>
            );
        }

        const draft = this.state.draft ?? value ?? 0;

        return (
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                <Swatch
                    color={color}
                    theme={theme}
                    onClick={
                        this.isEditMode()
                            ? undefined
                            : () => this.setState({ opened: !this.state.opened, draft: value })
                    }
                />
                {this.state.opened ? (
                    <Popup
                        theme={theme}
                        width={250}
                        onClose={() => this.setState({ opened: false, draft: null })}
                    >
                        <div style={{ height: 80 }}>{this.renderPicker(draft, theme, false)}</div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                            <PanelButton
                                theme={theme}
                                onClick={() => this.setState({ opened: false, draft: null })}
                            >
                                {SpectrumHomematic.t('cancel')}
                            </PanelButton>
                            <PanelButton
                                theme={theme}
                                primary
                                onClick={() => {
                                    this.setState({ opened: false, draft: null });
                                    this.write(draft, true);
                                }}
                            >
                                {SpectrumHomematic.t('choose')}
                            </PanelButton>
                        </div>
                    </Popup>
                ) : null}
            </div>
        );
    }
}
