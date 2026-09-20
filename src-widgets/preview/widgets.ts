/*
 * Loads the nine widgets - after `stub.tsx`, which has to put `window.visRxWidget` in place first.
 *
 * Shared by the development page and the screenshot page, so both always show the same set.
 */

// puts the stub of `window.visRxWidget` on the window - must stay the first import
import './stub';

const [
    { default: Spectrum },
    { default: SpectrumHomematic },
    { default: Farbtastic },
    { default: RgbColor },
    { default: HueColor },
    { default: HuePickerXY },
    { default: HueIndicatorXY },
    { default: HuePickerCT },
    { default: HueIndicatorCT },
] = await Promise.all([
    import('../src/Spectrum'),
    import('../src/SpectrumHomematic'),
    import('../src/Farbtastic'),
    import('../src/RgbColor'),
    import('../src/HueColor'),
    import('../src/HuePickerXY'),
    import('../src/HueIndicatorXY'),
    import('../src/HuePickerCT'),
    import('../src/HueIndicatorCT'),
]);

export {
    Spectrum,
    SpectrumHomematic,
    Farbtastic,
    RgbColor,
    HueColor,
    HuePickerXY,
    HueIndicatorXY,
    HuePickerCT,
    HueIndicatorCT,
};

/** In the order of the palette */
export const WIDGETS = [
    { name: 'spectrum', type: Spectrum },
    { name: 'homematic', type: SpectrumHomematic },
    { name: 'farbtastic', type: Farbtastic },
    { name: 'rgb_color', type: RgbColor },
    { name: 'hue_color', type: HueColor },
    { name: 'hue_picker_xy', type: HuePickerXY },
    { name: 'hue_indicator_xy', type: HueIndicatorXY },
    { name: 'hue_picker_ct', type: HuePickerCT },
    { name: 'hue_indicator_ct', type: HueIndicatorCT },
];
