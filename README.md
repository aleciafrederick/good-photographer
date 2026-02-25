# GoodPhotographer

GoodPhotographer is a desktop app that batch-processes headshots so they all match the same framing and export in standard sizes. You upload photos, enter each person’s name and year, choose which formats to export (Website Bio, Spin Bio, Nucleus Round), and run. 

The app detects the face in each image, aligns it to a template so head position and scale are consistent, and writes a Raw copy plus the selected formats into a timestamped folder in your Downloads with consistent file naming. It’s built for internal use: one installable Mac app.

## From one shot prompt to installable app in 2 hours

This project went from a single ChatGPT prompt to a packaged Mac app in about two hours. Here’s the path we took—useful if you want to repeat the pattern for your own idea.

1. **Define the product in ChatGPT** — In one thread we described the app (batch headshot processor), user flow (upload → pick formats → process → open folder), and inputs/outputs (photos + names/year, timestamped export folder with Raw + Bio/Spin/Nucleus files). No code yet.

2. **Generate a PRD** — We asked ChatGPT to turn that into a Product Requirements Document: screens, validation rules, image processing and alignment requirements, export formats, filenames, and “definition of done.” That PRD became the single source of truth.

3. **Bring the PRD into Cursor** — The PRD was uploaded into Cursor. We reviewed the plan (Electron + React for the app, Python for face detection and alignment), confirmed the stack and that we could ship a single installable app with no API, then said: “Let’s build it.”

4. **Build and iterate in Cursor** — We scaffolded the app (Electron + React + Vite), implemented the three screens (Intake, Processing, Confirmation), added the Python processor (OpenCV for eyes, affine alignment, export formats), and wired everything together. When something broke (e.g. processor path when running from source, or OpenCV’s need for three points for the affine transform), we fixed it in place. We switched the template from “auto-generated from a reference image” to **manually defined** pupil positions in `template.json` so framing could be tuned in Photoshop and never overwritten.

5. **Polish and ship** — We set the template dimensions (1024×683 for the bio), added a custom app icon (PNG → `.icns` via `make-icns`), and ran `npm run dist` to produce the Mac .app and DMG. Result: one installable artifact, no Python or CLI required for the end user.

**Takeaway:** A clear PRD from a chat, then “build it” in Cursor with a concrete stack and a few debug cycles, got us from idea to installable app in about two hours.

---

Batch-process headshots: normalize alignment to a template and export standardized image formats (Website Bio, Spin Bio, Nucleus Round). Raw copy is always saved.

**Alignment template:** All photos are normalized to the same size and face position using **`resources/template.json`**. The template is **manually defined**: it specifies the canvas size (1024×683 for Bio) and a **reference face rectangle** (`face_left`, `face_top`, `face_width`, `face_height`) in pixels. Edit `template.json` to change framing. The reference image `resources/normal-headshot.png` is for visual reference only and is not read by the app.

**How alignment works:** The app detects the face in each photo (OpenCV cascade), then warps the image so the detected face maps to the template face rect—same position and size, uniform scale. No eye detection or margins; face-to-face alignment only. If the template has no face rect, the app falls back to eye-proportion alignment.

**Tech stack:** **Electron** + **React** (Vite) for the desktop UI; **Python** processor with **OpenCV** for face detection and affine alignment; **PyInstaller** to bundle the processor into a single binary; **electron-builder** for the Mac .app and DMG. No cloud APIs; everything runs locally.

## Requirements

- **Node.js** 18+
- **Python 3** with packages in `processor/requirements.txt` (for development; the built app can bundle a Python executable)
- **macOS** for building the desktop app

## Development

### 1. Install dependencies

```bash
npm install
cd processor && pip install -r requirements.txt && cd ..
```

### 2. Test locally (no packaging)

This runs the app with the **built UI** and the **Python script** (no PyInstaller binary). Good for day-to-day testing.

```bash
npm run build
npm run electron
```

Or in one step: **`npm run test`** (same as `npm run build && electron .`).

- Use **Add Photos** → pick images → fill First/Last name and Year → choose formats → **Submit**.
- Exports go to **`~/Downloads/GoodPhotographer/YYYY-MM-DD_HHMMSS/`**.

### 3. Optional: UI dev with live reload

**Terminal 1:** `npx vite`  
**Terminal 2:** `npm run dev` (or `ELECTRON_DEV=1 npx electron .`)

The app loads from `http://localhost:5173` so you can edit React and see changes without rebuilding.

### 4. Test the processor by itself (optional)

From the project root:
```bash
python3 processor/run_processor.py /path/to/_config.json
```
Use a `_config.json` from an export folder (the app writes one when you submit).

## Building the Mac app (single installable)

The app is packaged so users install **one thing**—no separate Python or dependencies.

1. **Build the processor** (single executable via PyInstaller, ~55 MB):
   ```bash
   cd processor
   pip install -r requirements.txt pyinstaller
   pyinstaller -y processor.spec
   cd ..
   ```
   This creates `processor/dist/processor`.

2. **Build the Electron app** (includes the processor binary and template):
   ```bash
   npm run build
   npm run dist
   ```
   Or in one go: `npm run dist` (this runs `build:processor` then builds the app).

3. **Output**
   - `dist/GoodPhotographer.app` — double-click to run
   - `dist/GoodPhotographer-0.1.0.dmg` (or similar) — drag to Applications to install

Users only need to install the **.app** or **.dmg**; Python is not required.

**Build installs:** **`npm run dist:all`** builds arm64, x64, and Universal DMGs and copies them to `release/`. Or run **`npm run dist:arm64`**, **`npm run dist:x64`**, or **`npm run dist:universal`** for a single target (each copies its DMG to `release/`). The `dist/` and `release/` folders are gitignored; share installers from `release/` outside the repo.

## Export location

Files are written to:
`~/Downloads/GoodPhotographer/YYYY-MM-DD_HHMMSS/`

## Output formats

- **Raw** (always): `LastName-FirstName-YYYYRaw.jpg`
- **Website Bio**: 1024×683 JPEG – `…Bio.jpg`
- **Spin Bio**: 510×510 JPEG – `…Spin.jpg`
- **Nucleus Round**: 510×510 PNG, circular mask – `…Nucleus.png`
