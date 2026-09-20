import type {
    RxWidgetInfoAttributesField,
    RxWidgetInfoGroup,
    VisRxWidgetProps,
    VisRxWidgetState,
} from '@iobroker/types-vis-2';
import type VisRxWidget from '@iobroker/types-vis-2/visRxWidget';

import {
    parseColor,
    type Rgb,
    rgbToHex,
    rgbToHsl,
    rgbToHsv,
    hslToRgb,
    hsvToRgb,
    round,
    toInt,
    toNumber,
} from './Components/color';
import type { ColorTheme } from './Components/Controls';

type Field = RxWidgetInfoAttributesField;

/** How a widget stores hue, saturation and brightness - the two conventions the vis-1 widgets used */
export type HslMode =
    /** hue 0..360, saturation and brightness 0..100, divided by the factor before they are written (jscolor) */
    | 'hsv100'
    /** hue 0..360, saturation and lightness 0..1, multiplied by the factor before they are written (spectrum) */
    | 'hsl01';

export interface ColorOptions {
    hslMode: HslMode;
    /** The vis-1 template of the HUE picker calls the factor `divisor` */
    factorAttr: 'factor' | 'divisor';
}

export interface GenericState extends VisRxWidgetState {
    /** The colour the user is dragging right now - shown until the states report it back */
    local?: Rgb | null;
    /** The picker panel is open */
    opened?: boolean;
}

/** Not more than one write per this many milliseconds while a finger is moving over a picker */
const SEND_INTERVAL = 200;
/** For this long after the last write the picker shows what the user picked, not what the states say */
const LOCAL_GUARD = 1500;

/**
 * Base class of every colour picker widget.
 *
 * `window.visRxWidget` is provided by the vis-2 runtime, so the widget set is built against the react copy of the
 * host instead of shipping its own.
 *
 * Besides the usual helpers it holds what all pickers have in common: reading the current colour out of the
 * configured states, writing a new one into all of them, and the two timers that make dragging smooth - writes
 * are throttled while the pointer moves, and the picked colour is shown until the states have caught up.
 */
export default class Generic<
    RxData extends Record<string, any>,
    State extends GenericState = GenericState,
> extends (window.visRxWidget as typeof VisRxWidget)<RxData, State> {
    private sendTimer: ReturnType<typeof setTimeout> | null = null;

    private localTimer: ReturnType<typeof setTimeout> | null = null;

    private pending: (() => void) | null = null;

    private lastSent = 0;

    constructor(props: VisRxWidgetProps) {
        super(props);
        this.state = { ...this.state, local: null, opened: false };
    }

    static getI18nPrefix(): string {
        return 'vis_colorpicker_';
    }

    componentWillUnmount(): void {
        if (this.sendTimer) {
            clearTimeout(this.sendTimer);
            this.sendTimer = null;
        }
        if (this.localTimer) {
            clearTimeout(this.localTimer);
            this.localTimer = null;
        }
        super.componentWillUnmount();
    }

    // ------------------------------------------------------------------------------------ states and values

    /** The object ID in an attribute, `''` if the field is empty or still holds the placeholder of the editor */
    getOid(attr: string): string {
        const oid: unknown = this.state.rxData[attr];
        if (!oid || typeof oid !== 'string' || oid === 'nothing_selected') {
            return '';
        }
        return oid;
    }

    /** The value of a state, `undefined` if the ID is not set or has no value yet */
    getStateValue(attr: string): any {
        const oid = this.getOid(attr);
        return oid ? this.state.values[`${oid}.val`] : undefined;
    }

    /** Writes a value into a state, if the attribute holds an ID at all */
    setStateValue(attr: string, value: string | number | boolean | null): void {
        const oid = this.getOid(attr);
        if (oid) {
            this.props.context.setValue(oid, value);
        }
    }

    isEditMode(): boolean {
        return !!this.state.editMode;
    }

    /**
     * Sends a write, but not more often than every `SEND_INTERVAL` while a picker is being dragged.
     *
     * `final` (the pointer was released) always writes at once, so the value the user let go of is the one that
     * arrives at the lamp.
     */
    protected send(write: () => void, final: boolean): void {
        const now = Date.now();
        if (this.sendTimer) {
            clearTimeout(this.sendTimer);
            this.sendTimer = null;
        }
        if (final || now - this.lastSent >= SEND_INTERVAL) {
            this.pending = null;
            this.lastSent = now;
            write();
            return;
        }
        this.pending = write;
        this.sendTimer = setTimeout(
            () => {
                this.sendTimer = null;
                const pending = this.pending;
                this.pending = null;
                if (pending) {
                    this.lastSent = Date.now();
                    pending();
                }
            },
            SEND_INTERVAL - (now - this.lastSent),
        );
    }

    /**
     * Shows a colour right away and keeps it for a moment.
     *
     * Without it the picker would jump back to the old value between the write and the answer of the adapter,
     * and with a lamp that reports its colour slightly differently it would jitter while dragging. The local
     * colour is dropped as soon as the states can deliver one again.
     */
    protected keepLocal(color: Rgb | null): void {
        this.setState({ local: color } as any);
        if (this.localTimer) {
            clearTimeout(this.localTimer);
        }
        this.localTimer = setTimeout(() => {
            this.localTimer = null;
            if (this.hasStateValue()) {
                this.setState({ local: null } as any);
            }
        }, LOCAL_GUARD);
    }

    /**
     * Whether the widget could show a colour of its own states again.
     *
     * Only then is the locally shown colour dropped - a widget without a state would otherwise fall back to the
     * chequerboard right after the user picked a colour. Widgets that do not read the colour out of the RGB/HSV
     * states (the HUE widgets, Homematic) override this.
     */
    protected hasStateValue(): boolean {
        return this.readColorFromStates() !== null;
    }

    // ------------------------------------------------------------------------------------------ the colour

    /** How this widget stores hue/saturation/brightness; the pickers of jscolor and spectrum differ here */
    // eslint-disable-next-line class-methods-use-this
    protected getColorOptions(): ColorOptions {
        return { hslMode: 'hsv100', factorAttr: 'factor' };
    }

    /** `factor` of the widget; `0` and an empty field mean 1, as in the vis-1 set */
    protected getFactor(): number {
        const factor = toNumber(this.state.rxData[this.getColorOptions().factorAttr], 1);
        return factor || 1;
    }

    /** Digits after the comma for the written values */
    protected getDecimal(): number {
        return toInt(this.state.rxData.decimal, 0);
    }

    /**
     * The colour of the configured states.
     *
     * A widget may have all three groups filled in; the RGB string wins over the three channels, and those win
     * over hue/saturation/brightness - the same order in which the vis-1 widgets bound their handlers, where the
     * last one decided what the picker showed.
     */
    protected readColorFromStates(): Rgb | null {
        const hex = this.getStateValue('rgb-oid');
        if (hex !== undefined && hex !== null && hex !== '') {
            const rgb = parseColor(hex);
            if (rgb) {
                return rgb;
            }
        }

        const factor = this.getFactor();
        if (this.getOid('red-oid') && this.getOid('green-oid') && this.getOid('blue-oid')) {
            const r = this.getStateValue('red-oid');
            const g = this.getStateValue('green-oid');
            const b = this.getStateValue('blue-oid');
            if (r !== undefined || g !== undefined || b !== undefined) {
                return {
                    r: Math.round(toNumber(r, 0) * factor),
                    g: Math.round(toNumber(g, 0) * factor),
                    b: Math.round(toNumber(b, 0) * factor),
                };
            }
        }

        if (this.getOid('hue-oid') && this.getOid('sat-oid') && this.getOid('bri-oid')) {
            const h = this.getStateValue('hue-oid');
            const s = this.getStateValue('sat-oid');
            const b = this.getStateValue('bri-oid');
            if (h !== undefined || s !== undefined || b !== undefined) {
                const hue = toNumber(h, 0);
                if (this.getColorOptions().hslMode === 'hsl01') {
                    return hslToRgb({ h: hue, s: toNumber(s, 0) / factor, l: toNumber(b, 0) / factor });
                }
                return hsvToRgb({ h: hue, s: toNumber(s, 0) * factor, v: toNumber(b, 0) * factor });
            }
        }

        return null;
    }

    /** Writes the colour into every state the widget has: the RGB string, the three channels and the triple */
    protected writeColorToStates(color: Rgb): void {
        const factor = this.getFactor();
        const decimal = this.getDecimal();

        if (this.getOid('rgb-oid')) {
            this.setStateValue('rgb-oid', rgbToHex(color));
        }

        if (this.getOid('red-oid') && this.getOid('green-oid') && this.getOid('blue-oid')) {
            this.setStateValue('red-oid', round(color.r / factor, decimal));
            this.setStateValue('green-oid', round(color.g / factor, decimal));
            this.setStateValue('blue-oid', round(color.b / factor, decimal));
        }

        if (this.getOid('hue-oid') && this.getOid('sat-oid') && this.getOid('bri-oid')) {
            if (this.getColorOptions().hslMode === 'hsl01') {
                const hsl = rgbToHsl(color);
                this.setStateValue('hue-oid', round(hsl.h, decimal));
                this.setStateValue('sat-oid', round(hsl.s * factor, decimal));
                this.setStateValue('bri-oid', round(hsl.l * factor, decimal));
            } else {
                const hsv = rgbToHsv(color);
                this.setStateValue('hue-oid', round(hsv.h, decimal));
                this.setStateValue('sat-oid', round(hsv.s / factor, decimal));
                this.setStateValue('bri-oid', round(hsv.v / factor, decimal));
            }
        }
    }

    /** The colour to show: what the user is dragging, otherwise what the states say */
    protected getColor(): Rgb | null {
        return this.state.local ?? this.readColorFromStates();
    }

    /** Shows the colour and writes it into the states */
    protected setColor(color: Rgb, final: boolean): void {
        this.keepLocal(color);
        this.send(() => this.writeColorToStates(color), final);
    }

    // ------------------------------------------------------------------------------------------ appearance

    /** The colours of the picker panel, taken from the theme of vis-2 */
    protected getColorTheme(): ColorTheme {
        const theme: any = this.props.context.theme;
        const dark = this.props.context.themeType === 'dark' || theme?.palette?.mode === 'dark';
        return {
            dark,
            text: theme?.palette?.text?.primary || (dark ? '#ffffff' : 'rgba(0, 0, 0, 0.87)'),
            secondary: theme?.palette?.text?.secondary || (dark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)'),
            paper: theme?.palette?.background?.paper || (dark ? '#272727' : '#ffffff'),
            border: dark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.25)',
            primary: theme?.palette?.primary?.main || '#1976d2',
            fontFamily: theme?.typography?.fontFamily || 'Roboto, Helvetica, Arial, sans-serif',
        };
    }

    // ------------------------------------------------------------------------------- shared editor fields

    static oidField(name: string, label: string): Field {
        return { name, type: 'id', label };
    }

    /** The three channels, and for the HUE picker also its divisor and the RGB string */
    static rgbGroup(extra: Field[] = []): RxWidgetInfoGroup {
        return {
            name: 'rgb',
            label: 'group_rgb',
            fields: [
                Generic.oidField('red-oid', 'red_oid'),
                Generic.oidField('green-oid', 'green_oid'),
                Generic.oidField('blue-oid', 'blue_oid'),
                ...extra,
            ],
        };
    }

    /** Hue, saturation and brightness */
    static hslGroup(): RxWidgetInfoGroup {
        return {
            name: 'hue',
            label: 'group_hsl',
            fields: [
                Generic.oidField('hue-oid', 'hue_oid'),
                Generic.oidField('sat-oid', 'sat_oid'),
                Generic.oidField('bri-oid', 'bri_oid'),
            ],
        };
    }

    /** Factor and digits, the two settings that decide how the numbers are written */
    static extraGroup(): RxWidgetInfoGroup {
        return {
            name: 'extra',
            label: 'group_extra',
            fields: [
                { name: 'factor', type: 'number', label: 'factor', tooltip: 'factor_tooltip', default: 1 },
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
            ],
        };
    }

    /** "Show the picker in the widget" - the vis-2 addition to the widgets that only had a small swatch */
    static inlineField(): Field {
        return { name: 'inline', type: 'checkbox', label: 'inline', tooltip: 'inline_tooltip' };
    }

    // --------------------------------------------------------------------------- fields of the HUE widgets

    /** The gamut of the lamp: a model id like `LCT001`, a gamut letter `A`, `B`, `C`, or empty for all colours */
    static gamutField(): Field {
        return { name: 'gamut', label: 'gamut', tooltip: 'gamut_tooltip' };
    }

    /** How long the lamp takes for the change, in tenths of a second - the `transitiontime` of the HUE API */
    static transitionTimeField(): Field {
        return {
            name: 'transitionTime',
            type: 'number',
            label: 'transition_time',
            tooltip: 'transition_time_tooltip',
            min: 0,
            max: 30000,
            step: 1,
            default: 4,
        };
    }

    /**
     * Fills in the fields that belong to a state of a HUE light.
     *
     * Picking `hue.0.lamp.command` takes over `hue.0.lamp.xy`, `hue.0.lamp.level` and the model of the lamp for
     * the gamut - the same help the vis-1 widget set gave with its `changedHUE…` handlers.
     */
    private static async takeOverSiblings(
        oid: string,
        data: Record<string, any>,
        changeData: (newData: Record<string, any>) => void,
        socket: { getObject: (id: string) => Promise<ioBroker.Object | null | undefined> },
        options: { xy?: boolean; level?: boolean; ct?: boolean; gamut?: boolean },
    ): Promise<void> {
        if (!oid || oid === 'nothing_selected' || !oid.includes('.')) {
            return;
        }
        const parent = oid.split('.').slice(0, -1).join('.');
        let changed = false;

        const take = async (suffix: string, attr: string): Promise<void> => {
            if (data[attr]) {
                return;
            }
            const object = await socket.getObject(`${parent}.${suffix}`);
            if (object?.type === 'state') {
                data[attr] = `${parent}.${suffix}`;
                changed = true;
            }
        };

        if (options.xy) {
            await take('xy', 'xy-oid');
        }
        if (options.level) {
            await take('level', 'level-oid');
        }
        if (options.ct) {
            await take('ct', 'ct-oid');
        }
        if (options.gamut && !data.gamut) {
            const light = await socket.getObject(parent);
            const model = (light?.native as Record<string, any> | undefined)?.modelid;
            if (model) {
                data.gamut = model;
                changed = true;
            }
        }

        if (changed) {
            changeData(data);
        }
    }

    /** The command state of a HUE light, with the fields around it filled in by the editor */
    static hueCommandField(options: { xy?: boolean; level?: boolean; ct?: boolean; gamut?: boolean }): Field {
        return {
            name: 'command-oid',
            type: 'id',
            label: 'command_oid',
            tooltip: 'command_oid_tooltip',
            onChange: async (_field, data, changeData, socket): Promise<void> =>
                Generic.takeOverSiblings(data['command-oid'], data, changeData, socket, options),
        };
    }

    /** The `xy` state of a HUE light; picking it takes over the gamut of the lamp */
    static hueXyField(): Field {
        return {
            name: 'xy-oid',
            type: 'id',
            label: 'xy_oid',
            tooltip: 'xy_oid_tooltip',
            onChange: async (_field, data, changeData, socket): Promise<void> =>
                Generic.takeOverSiblings(data['xy-oid'], data, changeData, socket, { gamut: true }),
        };
    }
}
