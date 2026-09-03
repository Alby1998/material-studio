# Material Studio

Browser-based material assignment for architectural models, built to sit between CAD export and final rendering.

Load a model from ArchiCAD (or any GLB/FBX/OBJ/3DS), assign PBR materials to hundreds of meshes, then export a **structured brief for an AI design chat**: six orthographic views plus a Markdown file with measured surfaces, material breakdown and solar context.

No install, no account, no backend. Everything runs client-side in the browser.

**[▶ Live demo](https://alby1998.github.io/material-studio/)** · Italiano / English

---

## Why it exists

Real-time viewers (Enscape, Twinmotion, D5) are built to produce **images**. AI interior-design tools are built to restyle **photos**. Neither produces what an LLM actually needs to reason about a space: measurements, material areas, and orientation, in text.

Material Studio does that. You pick materials on the real geometry, group the meshes into a "section" (a room, a façade), and export:

- a **PNG contact sheet** — plan cut at 1.6 m, four orthographic elevations (N/S/E/W), one perspective
- a **Markdown brief** — L×W×H, floor area, volume, element count, per-material surface area with percentages, latitude/longitude, solar date and time, north rotation

Drop both into a chat with Claude or ChatGPT and it can discuss the space concretely instead of guessing from a render. That is the part no other tool does.

It is deliberately **not** a renderer. It does not chase photorealism and does not replace Lumen — it is the material-decision step before the model goes to Unreal Engine 5.

## Features

**Model loading** — GLB/GLTF/FBX/OBJ/3DS via drag & drop. Box-projected UVs are generated automatically for meshes exported without texture coordinates, a common CAD failure.

**Non-destructive material import** — materials already in the file are imported as "original" entries and the scene stays visually identical until you change something. First edit flips a material to "modified", with a one-click revert.

**PBR editing** — colour, metalness, roughness, opacity, U/V tiling, normal scale. Albedo / normal / roughness / metalness / AO / alpha maps from a searchable texture library. PNG, JPG, WEBP and TGA (decoded in-browser) are supported.

**Outliner built for large models** — rows grouped by name prefix, collapsed by default, multi-word AND filtering, per-row and per-group visibility, hide / isolate / show-all. Clicking a material's usage badge selects every mesh using it.

**Geographic sun** — NOAA solar position (declination, equation of time, longitude and timezone correction), validated numerically against Verona: 67.7° at summer solstice against 68.1° expected, 21.1° against 21.2° at winter solstice. City presets or free lat/lon, day-of-year and time sliders. Four lighting presets plus equirectangular HDRI loading.

**Undo/redo** — `Ctrl+Z` / `Ctrl+Y` across material assignments, visibility and sections.

**Persistence** — autosave to IndexedDB, optional live autosave to a `.json` on disk via the File System Access API, plus manual JSON export/import.

**Bilingual UI** — Italian and English, switchable at runtime; the exported brief is localised too.

## Running it locally

`index.html` uses ES modules, so `file://` will not work — browsers block module loading over it, and IndexedDB needs a stable origin. Serve the folder over HTTP:

```bash
git clone https://github.com/alby1998/material-studio.git
cd material-studio
python -m http.server 8000
```

Then open `http://localhost:8000`.

Three.js r160 is loaded from a CDN via import map; there is no build step and no `npm install`.

## Keyboard

| Key | Action |
|---|---|
| `W A S D` | move in the direction you are looking |
| `Q` / `E` | down / up on the world vertical axis |
| Right drag | look around in place · Left drag: pan · Wheel: zoom |
| `F` / double click | frame the selection |
| `H` / `I` / `U` | hide · isolate · show all |
| `M` / `T` | material library · texture library |
| `Ctrl+Z` / `Ctrl+Y` | undo · redo |
| `Tab` | move through the outliner by keyboard |

## Architecture

Four files, no framework, no bundler:

```
index.html   page structure and panels
style.css    appearance
app.js       all logic — three.js, materials, environment, sections, persistence
i18n.js      IT/EN dictionary + T() / applyI18n() / setLang()
```

`app.js` is intentionally a single file. State (`P`, `ENV`, `sel`, `meshes`, `curMat`) is shared and tightly coupled across the viewport, the outliner and the material editor; splitting it into ES modules would be a rewrite with real regression risk and little practical gain at this size. That is a considered trade-off, not unpaid debt.

Every user-visible string goes through `i18n.js` — `T('key')` at runtime, `data-i18n` attributes in markup.

## Known limits

- Section quality depends on how the CAD export named and grouped meshes. If ArchiCAD exported by element type ("Walls" as one blob) rather than by zone, a single room cannot be isolated — fix it upstream in the export.
- Per-material areas are sampled above 60k triangles: roughly ±5%. Good for a brief, not for a bill of quantities.
- Live autosave to disk needs the File System Access API (Chromium browsers).
- GLB is the recommended interchange format. FBX and 3DS frequently lose UVs and materials; BIMx is proprietary and cannot be parsed on the web.

## License

MIT — see [LICENSE](LICENSE).
