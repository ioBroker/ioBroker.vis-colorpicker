/*
 * The development page: all nine widgets against a stub of vis-2, without an ioBroker.
 *
 *     npm run preview     (in the root) -> http://localhost:4173
 *
 * The states live in this page. Writing a colour updates them, so the widgets follow each other: the picker
 * writes `demo.0.rgb`, and the indicator next to it shows the same colour. The `command` state of the HUE
 * widgets is interpreted the way the hue adapter would - it fills `xy`, `level` and `ct` again.
 *
 * Not part of the widget set - excluded from lint and never built into `widgets/`.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';

// puts the stub of `window.visRxWidget` in place - before the widgets are imported below
import { makeContext, states, withDefaults } from './stub';
import { WIDGETS } from './widgets';

const START = {
    'demo.0.rgb': '#ff8800',
    'demo.0.red': 255,
    'demo.0.green': 136,
    'demo.0.blue': 0,
    'demo.0.hue': 32,
    'demo.0.sat': 1,
    'demo.0.bri': 0.5,
    'demo.0.hmColor': 60,
    'demo.0.command': '',
    'demo.0.xy': '0.45,0.41',
    'demo.0.level': 80,
    'demo.0.ct': 370,
};

/** The settings of every widget on the page */
const DATA: Record<string, Record<string, any>> = {
    spectrum: { 'rgb-oid': 'demo.0.rgb' },
    homematic: { 'color-oid': 'demo.0.hmColor' },
    farbtastic: { 'rgb-oid': 'demo.0.rgb' },
    rgb_color: { 'rgb-oid': 'demo.0.rgb', title: 'RGB:' },
    hue_color: {
        'command-oid': 'demo.0.command',
        'xy-oid': 'demo.0.xy',
        'level-oid': 'demo.0.level',
        gamut: 'B',
    },
    hue_picker_xy: { 'command-oid': 'demo.0.command', 'xy-oid': 'demo.0.xy', gamut: 'B' },
    hue_indicator_xy: { 'xy-oid': 'demo.0.xy', gamut: 'B' },
    hue_picker_ct: { 'command-oid': 'demo.0.command', 'ct-oid': 'demo.0.ct' },
    hue_indicator_ct: { 'ct-oid': 'demo.0.ct' },
};

/** The sizes the widgets get on this page - larger than the default, to see what the pickers do */
const SIZE: Record<string, { width: number; height: number }> = {
    spectrum: { width: 80, height: 34 },
    homematic: { width: 80, height: 34 },
    farbtastic: { width: 200, height: 200 },
    rgb_color: { width: 140, height: 34 },
    hue_color: { width: 100, height: 40 },
    hue_picker_xy: { width: 180, height: 180 },
    hue_indicator_xy: { width: 80, height: 80 },
    hue_picker_ct: { width: 220, height: 40 },
    hue_indicator_ct: { width: 80, height: 80 },
};

function App(): React.JSX.Element {
    const [values, setValues] = React.useState<Record<string, any>>(states(START));
    const [dark, setDark] = React.useState(false);
    const [editMode, setEditMode] = React.useState(false);
    const [inline, setInline] = React.useState(false);

    /** What an adapter would do with the written value, so the other widgets see it too */
    const setValue = React.useCallback((id: string, value: any): void => {
        setValues(old => {
            const next = { ...old, [`${id}.val`]: value, [`${id}.ack`]: true, [`${id}.lc`]: Date.now() };
            if (id === 'demo.0.command' && typeof value === 'string' && value.startsWith('{')) {
                try {
                    const command = JSON.parse(value);
                    if (command.xy !== undefined) {
                        next['demo.0.xy.val'] = command.xy;
                    }
                    if (command.level !== undefined) {
                        next['demo.0.level.val'] = command.level;
                    }
                    if (command.ct !== undefined) {
                        next['demo.0.ct.val'] = parseInt(command.ct, 10);
                    }
                } catch {
                    // a command that is not JSON is simply shown as it is
                }
            }
            return next;
        });
    }, []);

    const context = React.useMemo(() => makeContext(dark ? 'dark' : 'light', setValue), [dark, setValue]);

    return (
        <div
            style={{
                minHeight: '100vh',
                padding: 16,
                background: dark ? '#121212' : '#f0f0f0',
                color: dark ? '#dfe3e8' : '#333',
                fontFamily: 'Roboto, Helvetica, Arial, sans-serif',
            }}
        >
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                <label>
                    <input
                        type="checkbox"
                        checked={dark}
                        onChange={e => setDark(e.target.checked)}
                    />{' '}
                    dark theme
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={inline}
                        onChange={e => setInline(e.target.checked)}
                    />{' '}
                    picker in the widget
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={editMode}
                        onChange={e => setEditMode(e.target.checked)}
                    />{' '}
                    edit mode
                </label>
                <button
                    type="button"
                    onClick={() => setValues(states(START))}
                >
                    reset states
                </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 24 }}>
                {WIDGETS.map(widget => {
                    const Type = widget.type as any;
                    const size = SIZE[widget.name];
                    const data = withDefaults(Type, {
                        ...DATA[widget.name],
                        ...(inline ? { inline: true } : {}),
                    });
                    const box = inline && size.height < 100 ? { width: 240, height: 180 } : size;
                    return (
                        <div
                            key={widget.name}
                            style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
                        >
                            <code style={{ fontSize: 12, opacity: 0.75 }}>{widget.name}</code>
                            <div style={{ ...box, position: 'relative' }}>
                                <Type
                                    context={context}
                                    editMode={editMode}
                                    view="view"
                                    id={`w_${widget.name}`}
                                    refParent={{ current: null }}
                                    values={values}
                                    rxStyle={{}}
                                    rxData={data}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            <pre style={{ marginTop: 24, fontSize: 12, opacity: 0.8 }}>
                {Object.keys(START)
                    .map(id => `${id} = ${JSON.stringify(values[`${id}.val`])}`)
                    .join('\n')}
            </pre>
        </div>
    );
}

createRoot(document.getElementById('root')!).render(<App />);
