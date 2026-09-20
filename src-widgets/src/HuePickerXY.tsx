import React from 'react';

import type { RxRenderWidgetProps, RxWidgetInfo } from '@iobroker/types-vis-2';

import Generic, { type GenericState } from './Generic';
import { toInt } from './Components/color';
import { GamutPad } from './Components/HuePads';
import { floatToRgb, gamutOf, type Point, xyToRgbForGamut } from './Components/huepi';
import { parseXy, xyText } from './HueColor';

interface HuePickerXYRxData {
    'command-oid'?: string;
    'xy-oid'?: string;
    gamut?: string;
    transitionTime?: number;
}

interface HuePickerXYState extends GenericState {
    draft?: Point | null;
}

/**
 * `tplHUEPickerXY` - the colour field of a Philips HUE light, as large as the widget.
 *
 * A click or a drag on the field writes the point into the `command` state of the lamp. The colours outside the
 * triangle of the lamp are drawn a little darker, so the gamut of the lamp is visible - as in vis-1.
 */
export default class HuePickerXY extends Generic<HuePickerXYRxData, HuePickerXYState> {
    static getWidgetInfo(): RxWidgetInfo {
        return {
            id: 'tplHUEPickerXY',
            visSet: 'colorpicker',
            visSetLabel: 'set_label',
            visSetColor: '#a13c9a',
            visWidgetLabel: 'widget_hue_picker_xy',
            visName: 'Philips HUE XY-Picker',
            visHelp: 'help_hue_picker_xy',
            visOrder: 6,
            visAttrs: [
                {
                    name: 'common',
                    fields: [
                        Generic.hueCommandField({ xy: true, gamut: true }),
                        Generic.hueXyField(),
                        Generic.gamutField(),
                        Generic.transitionTimeField(),
                    ],
                },
            ],
            visDefaultStyle: { width: 150, height: 150 },
            visPrev: 'widgets/vis-2-widgets-colorpicker/img/prev_hue_picker_xy.png',
        };
    }

    // eslint-disable-next-line class-methods-use-this
    getWidgetInfo(): RxWidgetInfo {
        return HuePickerXY.getWidgetInfo();
    }

    private getXy(): Point | null {
        if (this.state.local && this.state.draft) {
            return this.state.draft;
        }
        return parseXy(this.getStateValue('xy-oid'));
    }

    protected hasStateValue(): boolean {
        return parseXy(this.getStateValue('xy-oid')) !== null;
    }

    private pick(xy: Point, final: boolean): void {
        this.setState({ draft: xy });
        this.keepLocal(floatToRgb(xyToRgbForGamut(xy.x, xy.y, 1, gamutOf(this.state.rxData.gamut))));

        this.send(() => {
            if (this.getOid('command-oid')) {
                this.setStateValue(
                    'command-oid',
                    JSON.stringify({
                        transitiontime: toInt(this.state.rxData.transitionTime, 0),
                        xy: xyText(xy),
                    }),
                );
            }
        }, final);
    }

    renderWidgetBody(props: RxRenderWidgetProps): React.JSX.Element | React.JSX.Element[] | null {
        super.renderWidgetBody(props);

        const xy = this.getXy();

        return (
            <GamutPad
                gamut={gamutOf(this.state.rxData.gamut)}
                x={xy ? xy.x : null}
                y={xy ? xy.y : null}
                onPick={this.isEditMode() ? undefined : (x, y, final) => this.pick({ x, y }, final)}
            />
        );
    }
}
