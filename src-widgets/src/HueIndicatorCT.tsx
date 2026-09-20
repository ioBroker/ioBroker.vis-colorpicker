import React from 'react';

import type { RxRenderWidgetProps, RxWidgetInfo } from '@iobroker/types-vis-2';

import Generic from './Generic';
import { rgbToHex } from './Components/color';
import { CHECKERBOARD } from './Components/Controls';
import { colorTemperatureToRgb, floatToRgb } from './Components/huepi';
import { type CtRxData, ctToKelvin, ctUnitFields } from './HuePickerCT';

/**
 * `tplHUEIndicatorCT` - shows the white temperature a light is set to.
 *
 * The vis-1 template of this widget is marked with `data-vis-2-ignore` - an attribute today's vis-2 does not
 * evaluate, so it was shown there as an EJS widget. It only reads the `ct` state and fills the widget with the
 * colour of that temperature.
 */
export default class HueIndicatorCT extends Generic<CtRxData> {
    static getWidgetInfo(): RxWidgetInfo {
        return {
            id: 'tplHUEIndicatorCT',
            visSet: 'colorpicker',
            visSetLabel: 'set_label',
            visSetColor: '#a13c9a',
            visWidgetLabel: 'widget_hue_indicator_ct',
            visName: 'Philips HUE CT-Indicator',
            visHelp: 'help_hue_indicator_ct',
            visOrder: 9,
            visAttrs: [
                {
                    name: 'common',
                    fields: [Generic.oidField('ct-oid', 'ct_oid'), ...ctUnitFields()],
                },
            ],
            visDefaultStyle: { width: 60, height: 60 },
            visPrev: 'widgets/vis-2-widgets-colorpicker/img/prev_hue_indicator_ct.png',
        };
    }

    // eslint-disable-next-line class-methods-use-this
    getWidgetInfo(): RxWidgetInfo {
        return HueIndicatorCT.getWidgetInfo();
    }

    renderWidgetBody(props: RxRenderWidgetProps): React.JSX.Element | React.JSX.Element[] | null {
        super.renderWidgetBody(props);

        const kelvin = ctToKelvin(this.getStateValue('ct-oid'), this.state.rxData);
        const color = kelvin === null ? null : floatToRgb(colorTemperatureToRgb(kelvin));

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
