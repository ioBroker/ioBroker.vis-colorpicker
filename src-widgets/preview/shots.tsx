/*
 * Scenes for the screenshots of the documentation (`docs/img/*.png`) and for the previews in the widget palette
 * (`public/img/prev_*.png`).
 *
 * Every `<section data-shot="name">` becomes `docs/img/name.png`, every `<section data-prev="name">` (page
 * `shots.html?prev=1`) becomes `public/img/prev_name.png` with a transparent background. `screenshots.mjs` opens
 * the page in a headless Chrome and cuts the sections out. All values are fixed, so the images only change when
 * a widget changes.
 *
 * Not part of the widget set - excluded from lint and never built into `widgets/`.
 */
import React, { type CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';

// puts the stub of `window.visRxWidget` in place - before the widgets are imported below
import { makeContext, states, withDefaults } from './stub';
import {
    Farbtastic,
    HueColor,
    HueIndicatorCT,
    HueIndicatorXY,
    HuePickerCT,
    HuePickerXY,
    RgbColor,
    Spectrum,
    SpectrumHomematic,
} from './widgets';

const PREV = new URLSearchParams(window.location.search).get('prev') === '1';

const CONTEXT = {
    light: makeContext('light'),
    dark: makeContext('dark'),
};

/** Dark theme of the current section */
const DarkTheme = React.createContext(false);

const V = states({
    'demo.0.rgb': '#ff8800',
    'demo.0.rgbBlue': '#2f6df6',
    'demo.0.red': 255,
    'demo.0.green': 136,
    'demo.0.blue': 0,
    'demo.0.hue': 32,
    'demo.0.sat': 1,
    'demo.0.bri': 0.5,
    'demo.0.hmColor': 60,
    'demo.0.hmWhite': 200,
    'demo.0.command': '',
    'demo.0.xy': '0.45,0.41',
    'demo.0.xyGreen': '0.3,0.55',
    'demo.0.level': 80,
    'demo.0.ct': 370,
    'demo.0.ctCold': 180,
});

/** One widget with the attributes the vis editor would store for it */
function W(props: {
    type: any;
    data: Record<string, any>;
    values?: Record<string, any>;
    style?: Record<string, any>;
}): React.JSX.Element {
    const dark = React.useContext(DarkTheme);
    const Type = props.type;
    return (
        <Type
            context={dark ? CONTEXT.dark : CONTEXT.light}
            editMode={false}
            view="view"
            id="w1"
            refParent={{ current: null }}
            values={props.values || V}
            rxStyle={props.style || {}}
            rxData={withDefaults(Type, props.data)}
        />
    );
}

/**
 * Opens the picker of the widget inside, so the popup is part of the image.
 *
 * `w`/`h` are the size of the widget itself; the panel hangs under it into the rest of the `Item`. The panel
 * closes on a `pointerdown` somewhere else, so a `click` on the colour box only opens it.
 */
function Open(props: { w: number; h: number; children: React.ReactNode }): React.JSX.Element {
    const ref = React.useRef<HTMLDivElement | null>(null);
    React.useEffect(() => {
        const swatch = ref.current?.querySelector('[data-colorpicker="swatch"]');
        swatch?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }, []);
    return (
        <div
            ref={ref}
            style={{ width: props.w, height: props.h, position: 'relative' }}
        >
            {props.children}
        </div>
    );
}

/** One screenshot */
function Shot(props: {
    name: string;
    dark?: boolean;
    style?: CSSProperties;
    children: React.ReactNode;
}): React.JSX.Element {
    return (
        <DarkTheme.Provider value={!!props.dark}>
            <section
                data-shot={props.name}
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'flex-start',
                    gap: 16,
                    width: 'max-content',
                    maxWidth: 1500,
                    padding: 16,
                    boxSizing: 'border-box',
                    background: props.dark ? '#121212' : '#f0f0f0',
                    color: props.dark ? '#dfe3e8' : '#333',
                    ...props.style,
                }}
            >
                {props.children}
            </section>
        </DarkTheme.Provider>
    );
}

/** Room for one widget, with the setting that makes the difference under it */
function Item(props: { w: number; h: number; caption?: string; children: React.ReactNode }): React.JSX.Element {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: props.w, height: props.h, position: 'relative' }}>{props.children}</div>
            {props.caption ? (
                <code
                    style={{
                        fontSize: 12,
                        opacity: 0.75,
                        marginTop: 6,
                        whiteSpace: 'pre',
                        textAlign: 'center',
                        maxWidth: props.w + 60,
                    }}
                >
                    {props.caption}
                </code>
            ) : null}
        </div>
    );
}

/** A palette preview: the bare widget on a transparent background */
function Prev(props: { name: string; w: number; h: number; children: React.ReactNode }): React.JSX.Element {
    return (
        <section
            data-prev={props.name}
            style={{ width: props.w, height: props.h, position: 'relative', padding: 2 }}
        >
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>{props.children}</div>
        </section>
    );
}

// ------------------------------------------------------------------------------------------------ scenes

function Overview(): React.JSX.Element {
    return (
        <Shot
            name="overview"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 210px)', gap: 16 }}
        >
            <Item
                w={200}
                h={150}
                caption="RGB spectrum"
            >
                <W
                    type={Spectrum}
                    data={{ 'rgb-oid': 'demo.0.rgb', inline: true }}
                />
            </Item>
            <Item
                w={200}
                h={150}
                caption="Homematic spectrum"
            >
                <W
                    type={SpectrumHomematic}
                    data={{ 'color-oid': 'demo.0.hmColor', inline: true }}
                />
            </Item>
            <Item
                w={150}
                h={150}
                caption="Color wheel"
            >
                <W
                    type={Farbtastic}
                    data={{ 'rgb-oid': 'demo.0.rgb' }}
                />
            </Item>
            <Item
                w={200}
                h={150}
                caption="RGB color"
            >
                <W
                    type={RgbColor}
                    data={{ 'rgb-oid': 'demo.0.rgb', title: 'RGB:', inline: true }}
                />
            </Item>
            <Item
                w={150}
                h={150}
                caption="Philips HUE"
            >
                <W
                    type={HueColor}
                    data={{
                        'command-oid': 'demo.0.command',
                        'xy-oid': 'demo.0.xy',
                        'level-oid': 'demo.0.level',
                        gamut: 'B',
                        inline: true,
                    }}
                />
            </Item>
            <Item
                w={150}
                h={150}
                caption="HUE XY picker"
            >
                <W
                    type={HuePickerXY}
                    data={{ 'command-oid': 'demo.0.command', 'xy-oid': 'demo.0.xy', gamut: 'B' }}
                />
            </Item>
            <Item
                w={100}
                h={100}
                caption="HUE XY indicator"
            >
                <W
                    type={HueIndicatorXY}
                    data={{ 'xy-oid': 'demo.0.xy', gamut: 'B' }}
                />
            </Item>
            <Item
                w={200}
                h={40}
                caption="HUE CT picker"
            >
                <W
                    type={HuePickerCT}
                    data={{ 'command-oid': 'demo.0.command', 'ct-oid': 'demo.0.ct' }}
                />
            </Item>
            <Item
                w={100}
                h={100}
                caption="HUE CT indicator"
            >
                <W
                    type={HueIndicatorCT}
                    data={{ 'ct-oid': 'demo.0.ct' }}
                />
            </Item>
        </Shot>
    );
}

function SpectrumScenes(): React.JSX.Element {
    return (
        <Shot name="spectrum">
            <Item
                w={80}
                h={34}
                caption="the widget"
            >
                <W
                    type={Spectrum}
                    data={{ 'rgb-oid': 'demo.0.rgb' }}
                />
            </Item>
            <Item
                w={270}
                h={240}
                caption="after a click"
            >
                <Open
                    w={80}
                    h={34}
                >
                    <W
                        type={Spectrum}
                        data={{ 'rgb-oid': 'demo.0.rgb' }}
                    />
                </Open>
            </Item>
            <Item
                w={240}
                h={170}
                caption="inline = true"
            >
                <W
                    type={Spectrum}
                    data={{ 'rgb-oid': 'demo.0.rgb', inline: true }}
                />
            </Item>
        </Shot>
    );
}

function HomematicScenes(): React.JSX.Element {
    return (
        <Shot name="homematic">
            <Item
                w={80}
                h={34}
                caption="0...199"
            >
                <W
                    type={SpectrumHomematic}
                    data={{ 'color-oid': 'demo.0.hmColor' }}
                />
            </Item>
            <Item
                w={80}
                h={34}
                caption="200 = white"
            >
                <W
                    type={SpectrumHomematic}
                    data={{ 'color-oid': 'demo.0.hmWhite' }}
                />
            </Item>
            <Item
                w={270}
                h={180}
                caption="after a click"
            >
                <Open
                    w={80}
                    h={34}
                >
                    <W
                        type={SpectrumHomematic}
                        data={{ 'color-oid': 'demo.0.hmColor' }}
                    />
                </Open>
            </Item>
            <Item
                w={240}
                h={100}
                caption="inline = true"
            >
                <W
                    type={SpectrumHomematic}
                    data={{ 'color-oid': 'demo.0.hmColor', inline: true }}
                />
            </Item>
        </Shot>
    );
}

function WheelScenes(): React.JSX.Element {
    return (
        <Shot name="farbtastic">
            <Item
                w={196}
                h={196}
                caption="196 x 196"
            >
                <W
                    type={Farbtastic}
                    data={{ 'rgb-oid': 'demo.0.rgb' }}
                />
            </Item>
            <Item
                w={120}
                h={120}
                caption="120 x 120"
            >
                <W
                    type={Farbtastic}
                    data={{ 'rgb-oid': 'demo.0.rgbBlue' }}
                />
            </Item>
            <Item
                w={260}
                h={160}
                caption="wider than high"
            >
                <W
                    type={Farbtastic}
                    data={{ 'rgb-oid': 'demo.0.rgb' }}
                />
            </Item>
        </Shot>
    );
}

function RgbColorScenes(): React.JSX.Element {
    return (
        <Shot name="rgb_color">
            <Item
                w={140}
                h={34}
                caption="title = RGB:"
            >
                <W
                    type={RgbColor}
                    data={{ 'rgb-oid': 'demo.0.rgb', title: 'RGB:' }}
                />
            </Item>
            <Item
                w={270}
                h={240}
                caption="after a click"
            >
                <Open
                    w={140}
                    h={34}
                >
                    <W
                        type={RgbColor}
                        data={{ 'rgb-oid': 'demo.0.rgb', title: 'RGB:' }}
                    />
                </Open>
            </Item>
            <Item
                w={240}
                h={180}
                caption="inline = true"
            >
                <W
                    type={RgbColor}
                    data={{ 'rgb-oid': 'demo.0.rgb', title: 'Light', inline: true }}
                />
            </Item>
        </Shot>
    );
}

function HueColorScenes(): React.JSX.Element {
    const hue = { 'command-oid': 'demo.0.command', 'xy-oid': 'demo.0.xy', 'level-oid': 'demo.0.level', gamut: 'B' };
    return (
        <Shot name="hue_color">
            <Item
                w={100}
                h={40}
                caption="buttonName = HUE"
            >
                <W
                    type={HueColor}
                    data={hue}
                />
            </Item>
            <Item
                w={270}
                h={230}
                caption="after a click"
            >
                <Open
                    w={100}
                    h={40}
                >
                    <W
                        type={HueColor}
                        data={hue}
                    />
                </Open>
            </Item>
            <Item
                w={180}
                h={180}
                caption="inline = true"
            >
                <W
                    type={HueColor}
                    data={{ ...hue, inline: true }}
                />
            </Item>
        </Shot>
    );
}

function GamutScenes(): React.JSX.Element {
    return (
        <Shot name="gamut">
            {['', 'A', 'B', 'C'].map(gamut => (
                <Item
                    key={gamut || 'all'}
                    w={150}
                    h={150}
                    caption={gamut ? `gamut = ${gamut}` : 'gamut empty'}
                >
                    <W
                        type={HuePickerXY}
                        data={{ 'command-oid': 'demo.0.command', 'xy-oid': 'demo.0.xy', gamut }}
                    />
                </Item>
            ))}
        </Shot>
    );
}

function CtScenes(): React.JSX.Element {
    return (
        <Shot name="ct">
            <Item
                w={240}
                h={40}
                caption="2000...6500 K"
            >
                <W
                    type={HuePickerCT}
                    data={{ 'command-oid': 'demo.0.command', 'ct-oid': 'demo.0.ct' }}
                />
            </Item>
            <Item
                w={240}
                h={40}
                caption="ctMin = 2700, ctMax = 4000"
            >
                <W
                    type={HuePickerCT}
                    data={{ 'command-oid': 'demo.0.command', 'ct-oid': 'demo.0.ct', ctMin: 2700, ctMax: 4000 }}
                />
            </Item>
            <Item
                w={240}
                h={100}
                caption="a tall widget"
            >
                <W
                    type={HuePickerCT}
                    data={{ 'command-oid': 'demo.0.command', 'ct-oid': 'demo.0.ctCold' }}
                />
            </Item>
        </Shot>
    );
}

function IndicatorScenes(): React.JSX.Element {
    return (
        <Shot name="indicators">
            <Item
                w={90}
                h={90}
                caption="xy = 0.45,0.41"
            >
                <W
                    type={HueIndicatorXY}
                    data={{ 'xy-oid': 'demo.0.xy', gamut: 'B' }}
                />
            </Item>
            <Item
                w={90}
                h={90}
                caption="xy = 0.3,0.55"
            >
                <W
                    type={HueIndicatorXY}
                    data={{ 'xy-oid': 'demo.0.xyGreen', gamut: 'B' }}
                />
            </Item>
            <Item
                w={90}
                h={90}
                caption="ct = 370 mired"
            >
                <W
                    type={HueIndicatorCT}
                    data={{ 'ct-oid': 'demo.0.ct' }}
                />
            </Item>
            <Item
                w={90}
                h={90}
                caption="ct = 180 mired"
            >
                <W
                    type={HueIndicatorCT}
                    data={{ 'ct-oid': 'demo.0.ctCold' }}
                />
            </Item>
            <Item
                w={90}
                h={90}
                caption="without a value"
            >
                <W
                    type={HueIndicatorCT}
                    data={{ 'ct-oid': 'demo.0.unknown' }}
                />
            </Item>
        </Shot>
    );
}

function DarkScene(): React.JSX.Element {
    return (
        <Shot
            name="dark-theme"
            dark
        >
            <Item
                w={240}
                h={170}
                caption="RGB spectrum"
            >
                <W
                    type={Spectrum}
                    data={{ 'rgb-oid': 'demo.0.rgb', inline: true }}
                />
            </Item>
            <Item
                w={270}
                h={240}
                caption="RGB color"
            >
                <Open
                    w={140}
                    h={34}
                >
                    <W
                        type={RgbColor}
                        data={{ 'rgb-oid': 'demo.0.rgb', title: 'RGB:' }}
                    />
                </Open>
            </Item>
            <Item
                w={150}
                h={150}
                caption="Color wheel"
            >
                <W
                    type={Farbtastic}
                    data={{ 'rgb-oid': 'demo.0.rgbBlue' }}
                />
            </Item>
        </Shot>
    );
}

// --------------------------------------------------------------------------------------- palette previews

function Previews(): React.JSX.Element {
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' }}>
            <Prev
                name="spectrum"
                w={120}
                h={90}
            >
                <W
                    type={Spectrum}
                    data={{ 'rgb-oid': 'demo.0.rgb', inline: true }}
                />
            </Prev>
            <Prev
                name="homematic"
                w={120}
                h={90}
            >
                <W
                    type={SpectrumHomematic}
                    data={{ 'color-oid': 'demo.0.hmColor', inline: true }}
                />
            </Prev>
            <Prev
                name="farbtastic"
                w={110}
                h={110}
            >
                <W
                    type={Farbtastic}
                    data={{ 'rgb-oid': 'demo.0.rgb' }}
                />
            </Prev>
            <Prev
                name="rgb_color"
                w={120}
                h={40}
            >
                <W
                    type={RgbColor}
                    data={{ 'rgb-oid': 'demo.0.rgb', title: 'RGB:' }}
                />
            </Prev>
            <Prev
                name="hue_color"
                w={110}
                h={90}
            >
                <W
                    type={HueColor}
                    data={{
                        'command-oid': 'demo.0.command',
                        'xy-oid': 'demo.0.xy',
                        'level-oid': 'demo.0.level',
                        gamut: 'B',
                        inline: true,
                    }}
                />
            </Prev>
            <Prev
                name="hue_picker_xy"
                w={100}
                h={100}
            >
                <W
                    type={HuePickerXY}
                    data={{ 'command-oid': 'demo.0.command', 'xy-oid': 'demo.0.xy', gamut: 'B' }}
                />
            </Prev>
            <Prev
                name="hue_indicator_xy"
                w={90}
                h={90}
            >
                <W
                    type={HueIndicatorXY}
                    data={{ 'xy-oid': 'demo.0.xy', gamut: 'B' }}
                />
            </Prev>
            <Prev
                name="hue_picker_ct"
                w={120}
                h={30}
            >
                <W
                    type={HuePickerCT}
                    data={{ 'command-oid': 'demo.0.command', 'ct-oid': 'demo.0.ct' }}
                />
            </Prev>
            <Prev
                name="hue_indicator_ct"
                w={90}
                h={90}
            >
                <W
                    type={HueIndicatorCT}
                    data={{ 'ct-oid': 'demo.0.ct' }}
                />
            </Prev>
        </div>
    );
}

function App(): React.JSX.Element {
    React.useEffect(() => {
        // Ready once the widgets measured themselves, drew their canvas and opened their panels
        const timer = setTimeout(() => {
            (window as any).__shotsReady = true;
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

    if (PREV) {
        document.body.style.background = 'transparent';
        return <Previews />;
    }

    return (
        <div
            style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'flex-start',
                gap: 24,
                padding: 24,
                width: 1800,
            }}
        >
            <Overview />
            <SpectrumScenes />
            <HomematicScenes />
            <WheelScenes />
            <RgbColorScenes />
            <HueColorScenes />
            <GamutScenes />
            <CtScenes />
            <IndicatorScenes />
            <DarkScene />
        </div>
    );
}

createRoot(document.getElementById('root')!).render(<App />);
