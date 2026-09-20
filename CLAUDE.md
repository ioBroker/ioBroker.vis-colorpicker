# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

`iobroker.vis-colorpicker` is a **widget set for ioBroker.vis and vis-2**, not a running adapter.
`io-package.json` declares `"mode": "none"`, `"onlyWWW": true`, `"type": "visualization-widgets"` — there is **no
Node.js runtime code**. Everything ships in `widgets/` and runs in the browser inside vis.

Nine widgets exist **twice**, with the same widget ids and the same attribute names:

| | vis (vis-1) | vis-2 |
|---|---|---|
| source | `widgets/colorpicker.html` + `widgets/colorpicker/` (hand-maintained) | `src-widgets/src/*.tsx` |
| libraries | spectrum, jscolor, farbtastic, huepi — vendored under `widgets/colorpicker/js/`, loaded as globals | none; CSS gradients plus one canvas, the CIE maths ported to `src/Components/huepi.ts` |
| technique | EJS templates, jQuery | React + TypeScript |
| shipped as | the same files | `widgets/vis-2-widgets-colorpicker/` (generated) |

| tpl id | class | what it is |
|---|---|---|
| `tplRGBSpectrum` | `Spectrum` | colour box + saturation square with hue bar (was spectrum) |
| `tplSpectrumHomematic` | `SpectrumHomematic` | one number 0…199 on the colour circle, 200 = white |
| `tplRGBFarbtastic` | `Farbtastic` | the colour wheel |
| `tplJscolor` | `RgbColor` | label + colour box (was jscolor) |
| `tplHUEjscolor` | `HueColor` | HUE button with the CIE field and a level slider |
| `tplHUEPickerXY` | `HuePickerXY` | the CIE field alone |
| `tplHUEIndicatorXY` | `HueIndicatorXY` | shows the colour of `xy` |
| `tplHUEPickerCT` | `HuePickerCT` | colour temperature bar |
| `tplHUEIndicatorCT` | `HueIndicatorCT` | shows the colour of `ct` |

vis-2 loads both sets and **a React widget replaces the EJS widget of the same id** (`visWidgetsCatalog.tsx`:
an EJS `<script type="text/ejs">` is skipped when `VisWidgetsCatalog.rxWidgets[id]` exists and its `visAttrs` is
not a string). That is the whole migration mechanism, and it only works while three things hold:

1. `getWidgetInfo().id` equals the vis-1 `<script id="tpl…">`.
2. `getWidgetInfo().visSet` is `'colorpicker'`.
3. Every attribute name of the vis-1 template still exists — widget data is stored per attribute name, so a
   renamed field silently drops the user's setting.

`npm run check-widgets` enforces all three; see below.

## Commands

```bash
npm run build          # npm i in src-widgets + tsc + vite build + copy to widgets/vis-2-widgets-colorpicker
npm run tsc            # type-check src-widgets only
npm run check-widgets  # validate the widget declarations against the vis-1 templates and the translations
npm run preview        # vite dev server with a stub of vis-2 - shows all widgets without an ioBroker
npm run screenshots    # render docs/img/*.png and src-widgets/public/img/prev_*.png with a headless Chrome
npm run lint           # eslint with @iobroker/eslint-config
npm test               # mocha --exit -> test/testPackageFiles.js (package/io-package validation)
npm run npm            # install in root and src-widgets
npm run release-patch  # release-script; runs lint before the check and build before the commit
```

`npm run build` must not be replaced by a plain vite build: `tasks.js` deletes **only**
`widgets/vis-2-widgets-colorpicker` and `src-widgets/build`, never the whole `widgets/` folder — the vis-1 set
lives there and is maintained by hand.

Scripts of `src-widgets` have to be called with `npx` (`cd src-widgets && npx vite …`): `npm run` only puts the
`node_modules/.bin` of the **root** on the PATH.

### Version and copyright

The version lives in `package.json` and `io-package.json` (both handled by `release-script`) plus the header
comment of `widgets/colorpicker.html` and the `version:` field of `vis.binds.colorpicker` in the same file.
`tasks.js` rewrites the latter two by regex from `package.json` on every build and also moves the copyright year
of that header to the current year (`node tasks --version` does only that), so keep those literals in a shape the
regexes still match.

### `npm run check-widgets`

`src-widgets/checkWidgets.mjs` bundles the widget sources for node, stubs `window.visRxWidget`, calls every
`getWidgetInfo()` and checks the three migration invariants above, that every `label`/`tooltip`/select option
exists in `src/i18n/en.json`, that every other language has exactly the keys of English, and that every `visPrev`
image is in `src-widgets/public/`. Dropping an attribute of a vis-1 template is an error; adding one is only
reported (`| new: …`).

## Architecture of the vis-2 widget set (`src-widgets/`)

Vite + `@module-federation/vite`, federation name `visColorpicker`, remote entry `customWidgets.js`. The exposed
component names and the URL are repeated in `io-package.json` under `common.visWidgets.visColorpicker` — adding a
widget means touching `vite.config.ts` (`exposes`), that block, `WIDGETS` in `checkWidgets.mjs` and
`preview/widgets.ts`.

`moduleFederationShared(pack)` from `@iobroker/types-vis-2` filters the shared modules by the dependencies in
`src-widgets/package.json`. React and `react/jsx-runtime` must stay shared, otherwise vis-2's
`visWidgetSetCompatibility.ts` refuses to load the set. There is no MUI and no picker library in the
dependencies.

`@swc/core` is pinned to `1.15.30` via `overrides` — `vite-plugin-top-level-await` fails on 1.16.

### Widget classes

Every widget extends `Generic` (`src/Generic.tsx`), which extends `window.visRxWidget` and returns
`vis_colorpicker_` from `getI18nPrefix()`. `Generic` holds what all pickers share:

- `readColorFromStates()` / `writeColorToStates()` — the three groups of states (`rgb-oid`, the three channels,
  the hue/saturation/brightness triple). Reading takes the first group that has a value, writing writes them all.
- `getColorOptions()` — per widget: `hslMode` (`hsv100` for the jscolor widgets, `hsl01` for spectrum and the
  wheel) and which attribute holds the factor (`factor`, `divisor` in `tplHUEjscolor`).
- `send(write, final)` — not more than one write per 200 ms while a pointer moves, always one on release.
- `keepLocal(color)` — shows the picked colour for 1.5 s, so the marker does not jump back before the states
  answer. The widgets combine it with their own `draft` in the state: `(this.state.local && this.state.draft)`
  keeps the markers where the user put them even when the colour has no hue of its own (grey, black).
- the shared editor groups (`rgbGroup`, `hslGroup`, `extraGroup`, `inlineField`, `gamutField`,
  `transitionTimeField`, `hueCommandField`, `hueXyField`). `hueCommandField`/`hueXyField` fill the fields next to
  them from the lamp (`xy`, `level`, `ct`, the gamut from `native.modelid`) — the counterpart of the
  `changedHUE…` handlers of the vis-1 set.

`Components/`:

- `color.ts` — RGB/HSV/HSL conversions, `parseColor()` for everything a state may hold, and the coercions
  (`isTrue`, `toNumber`, `toInt`, `round`), because **attribute values arrive as strings**.
- `huepi.ts` — the CIE maths of the HUE widgets, ported from `widgets/colorpicker/js/huepiHelper.js` one to one
  (verified against the original; only `y = 0` no longer gives an undefined colour). `gamutOf()` also accepts the
  gamut letters `A`, `B`, `C`, which the vis-1 helper never did although its tooltip promised them.
- `hooks.ts` — `useElementSize` and `usePointerDrag` (pointer capture, so a finger that leaves the picker keeps
  dragging; `final` marks the release).
- `Controls.tsx` — `Marker`, `SvPad`, `HueBar`, `GradientSlider`, `Swatch`, `PanelButton` and `Popup`. The popup
  hangs under the widget, pushes itself back into the window and closes on Escape or a click outside.
- `Pickers.tsx` — `ColorPanel` (square + hue bar) and `ColorWheel` (ring with a mask plus the HSL square).
- `HuePads.tsx` — `GamutPad` (the only canvas of the set, computed once at 160 x 160 and scaled by the browser)
  and `CtBar` (a CSS gradient of 16 stops).

### Conventions

- **An empty field means the default**, and `0` for a factor means 1 — as in the vis-1 set.
- The colour of a widget without a value is `null`, and the widget shows a chequerboard instead of white.
- The two spectrum widgets write on **Choose**, everything else writes while dragging. That is the behaviour of
  the vis-1 libraries and it is documented, so do not "fix" it.
- `editMode` disables opening a panel, so clicking a widget in the editor selects it.
- Colours of the panel come from the vis-2 theme (`getColorTheme()`); the colour areas themselves never change.

## `src-widgets/preview/`

`npm run preview` (port 4173) renders all widgets against `preview/stub.tsx`, a stub of `VisRxWidget` including
`t()` from `en.json` and a `setValue` that feeds the page back — writing a colour updates the states, so the
widgets follow each other and a HUE `command` fills `xy`, `level` and `ct` as the adapter would.

`shots.html` / `shots.tsx` holds fixed scenes. `npm run screenshots` (`preview/screenshots.mjs`) starts its own
vite on port 4175, drives a local Chrome over the DevTools protocol (node 22 `WebSocket`, no puppeteer) and saves
every `<section data-shot="name">` as `docs/img/name.png` at 2x, then `shots.html?prev=1` with a transparent
background as `public/img/prev_<name>.png` (the palette previews, `visPrev`). `npm run screenshots -- spectrum ct`
renders only those, `-- --prev` only the previews. The `Open` component of the scenes clicks the element with
`data-colorpicker="swatch"`, which is how a screenshot shows an open panel. After changing how a widget looks,
re-render the images and check `docs/en/README.md` and `docs/de/README.md` — both describe every setting of every
widget.

A blank preview page usually means a second vite is running on the same cache — the config uses `strictPort` and
its own `cacheDir` to avoid it.

## The vis-1 widget set (`widgets/`)

Still shipped and still maintained by hand; only touch it for fixes that vis (vis-1) users need.

- `widgets/colorpicker.html` — the `systemDictionary` of the attribute labels, `vis.binds.colorpicker` and one
  `<script type="text/ejs" class="vis-tpl" id="tpl…">` per widget. The `data-vis-attrs*` mini-DSL defines the
  editor fields (`;`-separated, `group.x` opens a group, `[default]`, `/type`).
- `widgets/colorpicker/js/` holds the vendored third-party libraries, excluded from CodeQL.
- `tplHUEIndicatorCT` carries `data-vis-2-ignore="true"`; no vis-2 version evaluates that attribute.

Known bugs of the vis-1 code that the React widgets do **not** reproduce — they are listed in "Differences to
vis-1" of the user documentation: the hue/saturation/brightness binding of the wheel threw a `ReferenceError`,
the spectrum rounded saturation and lightness of `0…1` to whole numbers when reading, `tplHUEjscolor` read
`factor` although its field is called `divisor`, and the hue was written as text.

## Changelog

`README.md` carries the changelog; the release script moves the `### **WORK IN PROGRESS**` section into
`io-package.json` `common.news` with translations. Add entries as `* (author) description`.
