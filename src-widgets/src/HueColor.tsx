import React from 'react';

import type { RxRenderWidgetProps, RxWidgetInfo } from '@iobroker/types-vis-2';

import Generic, { type ColorOptions, type GenericState } from './Generic';
import { clamp, isTrue, type Rgb, rgbToHex, toInt, toNumber } from './Components/color';
import { GradientSlider, PanelButton, Popup, Swatch } from './Components/Controls';
import { GamutPad } from './Components/HuePads';
import { floatToRgb, gamutOf, type Point, xyToRgbForGamut } from './Components/huepi';
import { decodeEntities } from './RgbColor';

interface HueColorRxData {
    'command-oid'?: string;
    'xy-oid'?: string;
    'level-oid'?: string;
    gamut?: string;
    transitionTime?: number;
    pickerWidth?: number;
    pickerHeight?: number;
    pickerBackground?: string;
    buttonName?: string;
    closeButton?: string;
    'red-oid'?: string;
    'green-oid'?: string;
    'blue-oid'?: string;
    divisor?: number;
    decimal?: number;
    'rgb-oid'?: string;
    'hue-oid'?: string;
    'sat-oid'?: string;
    'bri-oid'?: string;
    inline?: boolean;
}

interface HueColorState extends GenericState {
    /** Where the marker and the slider stand while the user drags them */
    draft?: { xy: Point; level: number } | null;
}

/** The point in the middle of the picker, which the vis-1 widget used when the lamp had no colour yet */
const CENTER: Point = { x: 0.5, y: 0.5 };

/** `xy` of a HUE light has four digits - more of them only make the state harder to read */
export function xyText(xy: Point): string {
    return `${xy.x.toFixed(4)},${xy.y.toFixed(4)}`;
}

/** Reads `"0.1234,0.5678"`, the format the `xy` state of a HUE light has */
export function parseXy(value: unknown): Point | null {
    if (typeof value !== 'string') {
        return null;
    }
    const parts = value.split(',');
    if (parts.length !== 2) {
        return null;
    }
    const x = parseFloat(parts[0]);
    const y = parseFloat(parts[1]);
    if (!isFinite(x) || !isFinite(y)) {
        return null;
    }
    return { x: clamp(x, 0, 1), y: clamp(y, 0, 1) };
}

/**
 * `tplHUEjscolor` - the button that opens the CIE picker of a Philips HUE light.
 *
 * The lamp is set with one write into its `command` state, exactly as in vis-1:
 * `{"transitiontime":4,"xy":"0.4,0.4","level":80}`. The brightness is only part of it if a *Level ID* is
 * configured - otherwise a colour change would also set the brightness of the lamp.
 */
export default class HueColor extends Generic<HueColorRxData, HueColorState> {
    static getWidgetInfo(): RxWidgetInfo {
        return {
            id: 'tplHUEjscolor',
            visSet: 'colorpicker',
            visSetLabel: 'set_label',
            visSetColor: '#a13c9a',
            visWidgetLabel: 'widget_hue_color',
            visName: 'Philips HUE',
            visHelp: 'help_hue_color',
            visOrder: 5,
            visAttrs: [
                {
                    name: 'common',
                    fields: [
                        Generic.hueCommandField({ xy: true, level: true, gamut: true }),
                        Generic.hueXyField(),
                        Generic.oidField('level-oid', 'level_oid'),
                        Generic.gamutField(),
                        Generic.transitionTimeField(),
                        Generic.inlineField(),
                    ],
                },
                {
                    name: 'picker',
                    label: 'group_picker',
                    fields: [
                        {
                            name: 'pickerWidth',
                            type: 'number',
                            label: 'picker_width',
                            min: 0,
                            max: 500,
                            step: 1,
                            default: 100,
                            hidden: 'data.inline',
                        },
                        {
                            name: 'pickerHeight',
                            type: 'number',
                            label: 'picker_height',
                            min: 0,
                            max: 500,
                            step: 1,
                            default: 100,
                            hidden: 'data.inline',
                        },
                        { name: 'pickerBackground', type: 'color', label: 'picker_background' },
                        { name: 'buttonName', label: 'button_name', default: 'HUE', hidden: 'data.inline' },
                        { name: 'closeButton', label: 'close_button', default: 'close', hidden: 'data.inline' },
                    ],
                },
                Generic.rgbGroup([
                    { name: 'divisor', type: 'number', label: 'divisor', tooltip: 'factor_tooltip', default: 1 },
                    {
                        name: 'decimal',
                        type: 'slider',
                        label: 'decimal',
                        tooltip: 'decimal_tooltip',
                        min: 0,
                        max: 5,
                        step: 1,
                        default: 0,
                    },
                    Generic.oidField('rgb-oid', 'rgb_oid'),
                ]),
                Generic.hslGroup(),
            ],
            visDefaultStyle: { width: 100, height: 100 },
            visPrev: 'widgets/vis-2-widgets-colorpicker/img/prev_hue_color.png',
        };
    }

    // eslint-disable-next-line class-methods-use-this
    getWidgetInfo(): RxWidgetInfo {
        return HueColor.getWidgetInfo();
    }

    // the vis-1 template of this widget calls the factor of the RGB group `divisor`
    // eslint-disable-next-line class-methods-use-this
    protected getColorOptions(): ColorOptions {
        return { hslMode: 'hsv100', factorAttr: 'divisor' };
    }

    /** The colour point of the lamp: what the user drags, otherwise the `xy` state */
    private getXy(): Point | null {
        if (this.state.local && this.state.draft) {
            return this.state.draft.xy;
        }
        return parseXy(this.getStateValue('xy-oid'));
    }

    /** Brightness 0..1 of the lamp */
    private getLevel(): number {
        if (this.state.local && this.state.draft) {
            return this.state.draft.level;
        }
        const level = this.getStateValue('level-oid');
        return level === undefined || level === null || level === '' ? 1 : clamp(toNumber(level, 100) / 100, 0, 1);
    }

    protected hasStateValue(): boolean {
        return parseXy(this.getStateValue('xy-oid')) !== null || super.hasStateValue();
    }

    /** The colour of a point, always at full brightness - the vis-1 picker showed it the same way */
    private colorOf(xy: Point | null): Rgb | null {
        if (!xy) {
            return null;
        }
        return floatToRgb(xyToRgbForGamut(xy.x, xy.y, 1, gamutOf(this.state.rxData.gamut)));
    }

    /** Sends the colour to the lamp and into the RGB/HSV states of the widget */
    private pick(xy: Point, level: number, final: boolean): void {
        const color = this.colorOf(xy);
        this.setState({ draft: { xy, level } });
        if (color) {
            this.keepLocal(color);
        }

        this.send(() => {
            if (this.getOid('command-oid')) {
                const command: Record<string, any> = {
                    transitiontime: toInt(this.state.rxData.transitionTime, 0),
                    xy: xyText(xy),
                };
                if (this.getOid('level-oid')) {
                    command.level = Math.round(level * 100);
                }
                this.setStateValue('command-oid', JSON.stringify(command));
            }
            if (color) {
                this.writeColorToStates(color);
            }
        }, final);
    }

    private renderPicker(style: React.CSSProperties): React.JSX.Element {
        const xy = this.getXy();
        const level = this.getLevel();
        const color = this.colorOf(xy) || this.getColor();
        const withLevel = !!this.getOid('level-oid');

        return (
            <div style={{ display: 'flex', gap: 8, ...style }}>
                <GamutPad
                    gamut={gamutOf(this.state.rxData.gamut)}
                    x={xy ? xy.x : null}
                    y={xy ? xy.y : null}
                    onPick={(x, y, final) => this.pick({ x, y }, level, final)}
                    style={{ flex: 1, minWidth: 0, borderRadius: 4 }}
                />
                {withLevel ? (
                    <GradientSlider
                        value={level}
                        vertical
                        background={`linear-gradient(to top, #000000, ${color ? rgbToHex(color) : '#ffffff'})`}
                        onChange={(value, final) => this.pick(xy || CENTER, value, final)}
                        style={{ width: 22, flex: '0 0 auto' }}
                    />
                ) : null}
            </div>
        );
    }

    renderWidgetBody(props: RxRenderWidgetProps): React.JSX.Element | React.JSX.Element[] | null {
        super.renderWidgetBody(props);

        const data = this.state.rxData;
        const theme = this.getColorTheme();
        const color = this.colorOf(this.getXy()) || this.getColor();

        if (isTrue(data.inline)) {
            return (
                <div
                    style={{
                        width: '100%',
                        height: '100%',
                        position: 'relative',
                        boxSizing: 'border-box',
                        background: data.pickerBackground,
                    }}
                >
                    {this.renderPicker({ width: '100%', height: '100%' })}
                </div>
            );
        }

        const width = Math.max(40, toInt(data.pickerWidth, 100));
        const height = Math.max(40, toInt(data.pickerHeight, 100));

        return (
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                <Swatch
                    color={color}
                    theme={theme}
                    label={data.buttonName ? decodeEntities(data.buttonName) : ''}
                    onClick={this.isEditMode() ? undefined : () => this.setState({ opened: !this.state.opened })}
                />
                {this.state.opened ? (
                    <Popup
                        theme={theme}
                        onClose={() => this.setState({ opened: false })}
                    >
                        <div style={{ background: data.pickerBackground, borderRadius: 4 }}>
                            {this.renderPicker({ width, height })}
                        </div>
                        {data.closeButton ? (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                                <PanelButton
                                    theme={theme}
                                    onClick={() => this.setState({ opened: false })}
                                >
                                    {decodeEntities(data.closeButton)}
                                </PanelButton>
                            </div>
                        ) : null}
                    </Popup>
                ) : null}
            </div>
        );
    }
}
