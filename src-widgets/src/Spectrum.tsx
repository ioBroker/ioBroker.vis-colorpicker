import React from 'react';

import type { RxRenderWidgetProps, RxWidgetInfo } from '@iobroker/types-vis-2';

import Generic, { type ColorOptions, type GenericState } from './Generic';
import { type Hsv, hsvToRgb, isTrue, rgbToHsv } from './Components/color';
import { PanelButton, Popup, Swatch } from './Components/Controls';
import { ColorPanel } from './Components/Pickers';

interface SpectrumRxData {
    'rgb-oid'?: string;
    'red-oid'?: string;
    'green-oid'?: string;
    'blue-oid'?: string;
    'hue-oid'?: string;
    'sat-oid'?: string;
    'bri-oid'?: string;
    factor?: number;
    decimal?: number;
    inline?: boolean;
}

interface SpectrumState extends GenericState {
    /** The colour of the open panel, applied to the states when "Choose" is pressed */
    draft?: Hsv | null;
}

/** The colour a picker starts from if none of the states has a value yet */
export const DEFAULT_HSV: Hsv = { h: 0, s: 100, v: 100 };

/**
 * `tplRGBSpectrum` - the widget that was drawn by spectrum in vis-1.
 *
 * A swatch that opens the picker, or the picker itself if *Picker in the widget* is set. As in vis-1 the colour
 * is written when "Choose" is pressed, not while dragging - a lamp does not follow every intermediate colour.
 */
export default class Spectrum extends Generic<SpectrumRxData, SpectrumState> {
    static getWidgetInfo(): RxWidgetInfo {
        return {
            id: 'tplRGBSpectrum',
            visSet: 'colorpicker',
            visSetLabel: 'set_label',
            visSetColor: '#a13c9a',
            visWidgetLabel: 'widget_spectrum',
            visName: 'RGB spectrum',
            visHelp: 'help_spectrum',
            visOrder: 1,
            visAttrs: [
                {
                    name: 'common',
                    fields: [Generic.oidField('rgb-oid', 'rgb_oid'), Generic.inlineField()],
                },
                Generic.rgbGroup(),
                Generic.hslGroup(),
                Generic.extraGroup(),
            ],
            visDefaultStyle: { width: 60, height: 34 },
            visPrev: 'widgets/vis-2-widgets-colorpicker/img/prev_spectrum.png',
        };
    }

    // eslint-disable-next-line class-methods-use-this
    getWidgetInfo(): RxWidgetInfo {
        return Spectrum.getWidgetInfo();
    }

    // spectrum reported its colour as HSL with saturation and lightness between 0 and 1
    // eslint-disable-next-line class-methods-use-this
    protected getColorOptions(): ColorOptions {
        return { hslMode: 'hsl01', factorAttr: 'factor' };
    }

    renderWidgetBody(props: RxRenderWidgetProps): React.JSX.Element | React.JSX.Element[] | null {
        super.renderWidgetBody(props);

        const theme = this.getColorTheme();
        const color = this.getColor();
        const hsv = color ? rgbToHsv(color) : DEFAULT_HSV;

        if (isTrue(this.state.rxData.inline)) {
            return (
                <div style={{ width: '100%', height: '100%', position: 'relative', boxSizing: 'border-box' }}>
                    <ColorPanel
                        // while dragging the markers stay where the user put them, even if the colour has no
                        // saturation of its own to go back to
                        hsv={(this.state.local && this.state.draft) || hsv}
                        theme={theme}
                        onChange={(next, final) => {
                            this.setState({ draft: next });
                            this.setColor(hsvToRgb(next), final);
                        }}
                    />
                </div>
            );
        }

        return (
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                <Swatch
                    color={color}
                    theme={theme}
                    onClick={
                        this.isEditMode() ? undefined : () => this.setState({ opened: !this.state.opened, draft: hsv })
                    }
                />
                {this.state.opened ? (
                    <Popup
                        theme={theme}
                        width={250}
                        onClose={() => this.setState({ opened: false, draft: null })}
                    >
                        <div style={{ height: 150 }}>
                            <ColorPanel
                                hsv={this.state.draft ?? hsv}
                                theme={theme}
                                onChange={next => this.setState({ draft: next })}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                            <PanelButton
                                theme={theme}
                                onClick={() => this.setState({ opened: false, draft: null })}
                            >
                                {Spectrum.t('cancel')}
                            </PanelButton>
                            <PanelButton
                                theme={theme}
                                primary
                                onClick={() => {
                                    const draft = this.state.draft;
                                    this.setState({ opened: false, draft: null });
                                    if (draft) {
                                        this.setColor(hsvToRgb(draft), true);
                                    }
                                }}
                            >
                                {Spectrum.t('choose')}
                            </PanelButton>
                        </div>
                    </Popup>
                ) : null}
            </div>
        );
    }
}
