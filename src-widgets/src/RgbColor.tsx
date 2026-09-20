import React from 'react';

import type { RxRenderWidgetProps, RxWidgetInfo } from '@iobroker/types-vis-2';

import Generic, { type GenericState } from './Generic';
import { type Hsv, hsvToRgb, isTrue, rgbToHsv } from './Components/color';
import { PanelButton, Popup, Swatch } from './Components/Controls';
import { ColorPanel } from './Components/Pickers';
import { DEFAULT_HSV } from './Spectrum';

interface RgbColorRxData {
    title?: string;
    closeText?: string;
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

interface RgbColorState extends GenericState {
    draft?: Hsv | null;
}

/**
 * The title of the vis-1 widget was written into the page as HTML, and its default was `RGB:&nbsp`.
 *
 * The React widget shows it as text - a widget must not put HTML of a project into the page. The few entities a
 * title may carry are decoded, so a title of an old project still reads the way it did.
 */
export function decodeEntities(text: string): string {
    return text
        .replace(/&nbsp;?/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');
}

/**
 * `tplJscolor` - a label with a colour box that opens the picker.
 *
 * This is the widget that was drawn by jscolor in vis-1, and like jscolor it writes while the colour is being
 * dragged, not only when the picker is closed.
 */
export default class RgbColor extends Generic<RgbColorRxData, RgbColorState> {
    static getWidgetInfo(): RxWidgetInfo {
        return {
            id: 'tplJscolor',
            visSet: 'colorpicker',
            visSetLabel: 'set_label',
            visSetColor: '#a13c9a',
            visWidgetLabel: 'widget_rgb_color',
            visName: 'RGBColor',
            visHelp: 'help_rgb_color',
            visOrder: 4,
            visAttrs: [
                {
                    name: 'common',
                    fields: [
                        { name: 'title', label: 'title', default: 'RGB:' },
                        { name: 'closeText', label: 'close_text', default: 'X' },
                        Generic.oidField('rgb-oid', 'rgb_oid'),
                        Generic.inlineField(),
                    ],
                },
                Generic.rgbGroup(),
                Generic.hslGroup(),
                Generic.extraGroup(),
            ],
            visDefaultStyle: { width: 110, height: 34 },
            visPrev: 'widgets/vis-2-widgets-colorpicker/img/prev_rgb_color.png',
        };
    }

    // eslint-disable-next-line class-methods-use-this
    getWidgetInfo(): RxWidgetInfo {
        return RgbColor.getWidgetInfo();
    }

    renderWidgetBody(props: RxRenderWidgetProps): React.JSX.Element | React.JSX.Element[] | null {
        super.renderWidgetBody(props);

        const theme = this.getColorTheme();
        const color = this.getColor();
        const hsv = (this.state.local && this.state.draft) || (color ? rgbToHsv(color) : DEFAULT_HSV);
        const title = this.state.rxData.title ? decodeEntities(this.state.rxData.title) : '';

        const picker = (
            <ColorPanel
                hsv={hsv}
                theme={theme}
                onChange={(next, final) => {
                    this.setState({ draft: next });
                    this.setColor(hsvToRgb(next), final);
                }}
            />
        );

        if (isTrue(this.state.rxData.inline)) {
            return (
                <div
                    style={{
                        width: '100%',
                        height: '100%',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        boxSizing: 'border-box',
                        color: theme.text,
                        fontFamily: theme.fontFamily,
                    }}
                >
                    {title ? <div style={{ flex: '0 0 auto' }}>{title}</div> : null}
                    <div style={{ flex: 1, minHeight: 0 }}>{picker}</div>
                </div>
            );
        }

        return (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    color: theme.text,
                    fontFamily: theme.fontFamily,
                }}
            >
                {title ? <span style={{ whiteSpace: 'nowrap' }}>{title}</span> : null}
                <div style={{ flex: 1, height: '100%', minWidth: 20 }}>
                    <Swatch
                        color={color}
                        theme={theme}
                        onClick={this.isEditMode() ? undefined : () => this.setState({ opened: !this.state.opened })}
                    />
                </div>
                {this.state.opened ? (
                    <Popup
                        theme={theme}
                        width={250}
                        onClose={() => this.setState({ opened: false })}
                    >
                        <div style={{ height: 150 }}>{picker}</div>
                        {this.state.rxData.closeText ? (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                                <PanelButton
                                    theme={theme}
                                    onClick={() => this.setState({ opened: false })}
                                >
                                    {decodeEntities(this.state.rxData.closeText)}
                                </PanelButton>
                            </div>
                        ) : null}
                    </Popup>
                ) : null}
            </div>
        );
    }
}
