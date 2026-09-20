import React from 'react';

import type { RxRenderWidgetProps, RxWidgetInfo } from '@iobroker/types-vis-2';

import Generic, { type ColorOptions, type GenericState } from './Generic';
import { type Hsl, hslToRgb, rgbToHsl } from './Components/color';
import { ColorWheel } from './Components/Pickers';

interface FarbtasticRxData {
    'rgb-oid'?: string;
    'red-oid'?: string;
    'green-oid'?: string;
    'blue-oid'?: string;
    'hue-oid'?: string;
    'sat-oid'?: string;
    'bri-oid'?: string;
    factor?: number;
    decimal?: number;
}

interface FarbtasticState extends GenericState {
    /** Where the markers stand while dragging - a grey colour has no hue of its own to go back to */
    draft?: Hsl | null;
}

/** Full red, as the wheel of vis-1 started */
const DEFAULT_HSL: Hsl = { h: 0, s: 1, l: 0.5 };

/**
 * `tplRGBFarbtastic` - the colour wheel.
 *
 * The widget is the picker itself: a hue ring with the saturation/lightness square inside, like the farbtastic
 * wheel of vis-1, but drawn with CSS instead of three PNG files - so it is sharp at any size and follows the
 * widget when it is resized.
 */
export default class Farbtastic extends Generic<FarbtasticRxData, FarbtasticState> {
    static getWidgetInfo(): RxWidgetInfo {
        return {
            id: 'tplRGBFarbtastic',
            visSet: 'colorpicker',
            visSetLabel: 'set_label',
            visSetColor: '#a13c9a',
            visWidgetLabel: 'widget_farbtastic',
            visName: 'farbtastic',
            visHelp: 'help_farbtastic',
            visOrder: 3,
            visAttrs: [
                {
                    name: 'common',
                    fields: [Generic.oidField('rgb-oid', 'rgb_oid')],
                },
                Generic.rgbGroup(),
                Generic.hslGroup(),
                Generic.extraGroup(),
            ],
            visDefaultStyle: { width: 196, height: 196 },
            visPrev: 'widgets/vis-2-widgets-colorpicker/img/prev_farbtastic.png',
        };
    }

    // eslint-disable-next-line class-methods-use-this
    getWidgetInfo(): RxWidgetInfo {
        return Farbtastic.getWidgetInfo();
    }

    // the wheel works in HSL, like farbtastic did
    // eslint-disable-next-line class-methods-use-this
    protected getColorOptions(): ColorOptions {
        return { hslMode: 'hsl01', factorAttr: 'factor' };
    }

    renderWidgetBody(props: RxRenderWidgetProps): React.JSX.Element | React.JSX.Element[] | null {
        super.renderWidgetBody(props);

        const color = this.getColor();
        // while the user drags, the position of the markers wins: a colour without saturation would otherwise
        // throw the hue away and the ring marker would jump to red
        const hsl = (this.state.local && this.state.draft) || (color ? rgbToHsl(color) : DEFAULT_HSL);

        return (
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                <ColorWheel
                    hsl={hsl}
                    onChange={(next, final) => {
                        this.setState({ draft: next });
                        this.setColor(hslToRgb(next), final);
                    }}
                />
            </div>
        );
    }
}
