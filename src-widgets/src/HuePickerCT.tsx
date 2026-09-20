import React from 'react';

import type { RxRenderWidgetProps, RxWidgetInfo, RxWidgetInfoAttributesField } from '@iobroker/types-vis-2';

import Generic, { type GenericState } from './Generic';
import { clamp, toInt, toNumber } from './Components/color';
import { CtBar } from './Components/HuePads';
import { colorTemperatureToRgb, floatToRgb, kelvinToMired, miredToKelvin } from './Components/huepi';

export interface CtRxData {
    'ct-oid'?: string;
    ctUnit?: 'mired' | 'kelvin';
    ctMin?: number;
    ctMax?: number;
}

interface HuePickerCTRxData extends CtRxData {
    'command-oid'?: string;
    transitionTime?: number;
}

interface HuePickerCTState extends GenericState {
    draft?: number | null;
}

/** The range a Philips HUE light can do, in Kelvin - the same numbers the vis-1 widget had built in */
export const DEFAULT_CT_MIN = 2000;
export const DEFAULT_CT_MAX = 6500;

/** Mired is what a HUE light takes; `ct` of other adapters is often in Kelvin */
export function ctUnitFields(): RxWidgetInfoAttributesField[] {
    return [
        {
            name: 'ctUnit',
            type: 'select',
            label: 'ct_unit',
            tooltip: 'ct_unit_tooltip',
            options: [
                { value: 'mired', label: 'ct_unit_mired' },
                { value: 'kelvin', label: 'ct_unit_kelvin' },
            ],
            default: 'mired',
        },
        {
            name: 'ctMin',
            type: 'number',
            label: 'ct_min',
            tooltip: 'ct_min_tooltip',
            min: 1000,
            max: 10000,
            step: 100,
            default: DEFAULT_CT_MIN,
        },
        {
            name: 'ctMax',
            type: 'number',
            label: 'ct_max',
            tooltip: 'ct_max_tooltip',
            min: 1000,
            max: 10000,
            step: 100,
            default: DEFAULT_CT_MAX,
        },
    ] as RxWidgetInfoAttributesField[];
}

/** The two ends of the bar, in Kelvin */
export function ctRange(data: CtRxData): { min: number; max: number } {
    let min = toNumber(data.ctMin, DEFAULT_CT_MIN) || DEFAULT_CT_MIN;
    let max = toNumber(data.ctMax, DEFAULT_CT_MAX) || DEFAULT_CT_MAX;
    if (min > max) {
        [min, max] = [max, min];
    }
    if (min === max) {
        max = min + 100;
    }
    return { min, max };
}

/** The value of the state as Kelvin, `null` while there is none */
export function ctToKelvin(value: unknown, data: CtRxData): number | null {
    if (value === undefined || value === null || value === '') {
        return null;
    }
    const number = toNumber(value, 0);
    if (!number) {
        return null;
    }
    const { min, max } = ctRange(data);
    return clamp(data.ctUnit === 'kelvin' ? number : miredToKelvin(number), min, max);
}

/**
 * `tplHUEPickerCT` - the white temperature of a Philips HUE light.
 *
 * The bar runs from warm to cold, and a click writes the temperature into the `command` state of the lamp, in
 * mired as the HUE API wants it: `{"transitiontime":4,"ct":"370"}`. Lights of other adapters keep their `ct` in
 * Kelvin - *Unit* switches the widget over to those.
 */
export default class HuePickerCT extends Generic<HuePickerCTRxData, HuePickerCTState> {
    static getWidgetInfo(): RxWidgetInfo {
        return {
            id: 'tplHUEPickerCT',
            visSet: 'colorpicker',
            visSetLabel: 'set_label',
            visSetColor: '#a13c9a',
            visWidgetLabel: 'widget_hue_picker_ct',
            visName: 'Philips HUE CT-Picker',
            visHelp: 'help_hue_picker_ct',
            visOrder: 8,
            visAttrs: [
                {
                    name: 'common',
                    fields: [
                        Generic.hueCommandField({ ct: true }),
                        Generic.oidField('ct-oid', 'ct_oid'),
                        Generic.transitionTimeField(),
                        ...ctUnitFields(),
                    ],
                },
            ],
            visDefaultStyle: { width: 200, height: 40 },
            visPrev: 'widgets/vis-2-widgets-colorpicker/img/prev_hue_picker_ct.png',
        };
    }

    // eslint-disable-next-line class-methods-use-this
    getWidgetInfo(): RxWidgetInfo {
        return HuePickerCT.getWidgetInfo();
    }

    private getKelvin(): number | null {
        if (this.state.local && this.state.draft) {
            return this.state.draft;
        }
        return ctToKelvin(this.getStateValue('ct-oid'), this.state.rxData);
    }

    protected hasStateValue(): boolean {
        return ctToKelvin(this.getStateValue('ct-oid'), this.state.rxData) !== null;
    }

    private pick(kelvin: number, final: boolean): void {
        const rounded = Math.round(kelvin);
        this.setState({ draft: rounded });
        this.keepLocal(floatToRgb(colorTemperatureToRgb(rounded)));

        this.send(() => {
            if (this.getOid('command-oid')) {
                // a HUE lamp takes mired, and the vis-1 widget kept it inside the 153..500 the API allows
                const value =
                    this.state.rxData.ctUnit === 'kelvin'
                        ? rounded
                        : clamp(Math.round(kelvinToMired(rounded)), 153, 500);
                this.setStateValue(
                    'command-oid',
                    JSON.stringify({
                        transitiontime: toInt(this.state.rxData.transitionTime, 0),
                        ct: `${value}`,
                    }),
                );
            }
        }, final);
    }

    renderWidgetBody(props: RxRenderWidgetProps): React.JSX.Element | React.JSX.Element[] | null {
        super.renderWidgetBody(props);

        const { min, max } = ctRange(this.state.rxData);

        return (
            <CtBar
                kelvin={this.getKelvin()}
                min={min}
                max={max}
                onPick={this.isEditMode() ? undefined : (kelvin, final) => this.pick(kelvin, final)}
            />
        );
    }
}
