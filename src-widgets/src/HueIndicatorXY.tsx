import React from 'react';

import type { RxRenderWidgetProps, RxWidgetInfo } from '@iobroker/types-vis-2';

import Generic from './Generic';
import { rgbToHex } from './Components/color';
import { CHECKERBOARD } from './Components/Controls';
import { floatToRgb, gamutOf, xyToRgbForGamut } from './Components/huepi';
import { parseXy } from './HueColor';

interface HueIndicatorXYRxData {
    'xy-oid'?: string;
    gamut?: string;
}

/**
 * `tplHUEIndicatorXY` - shows the colour a Philips HUE light is set to.
 *
 * It only reads: the `xy` state of the lamp is converted to RGB with the gamut of the lamp and fills the widget.
 * Without a value the widget stays empty instead of showing the white of the middle of the colour field.
 */
export default class HueIndicatorXY extends Generic<HueIndicatorXYRxData> {
    static getWidgetInfo(): RxWidgetInfo {
        return {
            id: 'tplHUEIndicatorXY',
            visSet: 'colorpicker',
            visSetLabel: 'set_label',
            visSetColor: '#a13c9a',
            visWidgetLabel: 'widget_hue_indicator_xy',
            visName: 'Philips HUE XY-Indicator',
            visHelp: 'help_hue_indicator_xy',
            visOrder: 7,
            visAttrs: [
                {
                    name: 'common',
                    fields: [Generic.hueXyField(), Generic.gamutField()],
                },
            ],
            visDefaultStyle: { width: 60, height: 60 },
            visPrev: 'widgets/vis-2-widgets-colorpicker/img/prev_hue_indicator_xy.png',
        };
    }

    // eslint-disable-next-line class-methods-use-this
    getWidgetInfo(): RxWidgetInfo {
        return HueIndicatorXY.getWidgetInfo();
    }

    renderWidgetBody(props: RxRenderWidgetProps): React.JSX.Element | React.JSX.Element[] | null {
        super.renderWidgetBody(props);

        const xy = parseXy(this.getStateValue('xy-oid'));
        const color = xy ? floatToRgb(xyToRgbForGamut(xy.x, xy.y, 1, gamutOf(this.state.rxData.gamut))) : null;

        return (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    background: color ? rgbToHex(color) : CHECKERBOARD,
                }}
            />
        );
    }
}
