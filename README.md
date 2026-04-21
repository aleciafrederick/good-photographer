# Atomic Photographer

Atomic Photographer is a web app for producing consistent image exports for the web. It ships with two tools in a single interface:

- **Headshot Formatter** — batch-align headshots to a shared face-framing template and export them in standard bio formats.
- **Meta Image Generator** — center-crop and resize any image into the standard sizes used in Open Graph and Twitter meta tags.

Upload photos, fill in the per-photo metadata, choose output formats, and download the results as a zip.

**Live app:** <https://atomic-photographer-a962d27c5da0.herokuapp.com/>
**Requirements:** `Node.js` 18+, `Python` 3.10+


## How It Works

React + Vite on the frontend, FastAPI + OpenCV on the backend. The backend accepts uploads, runs a Python processor, zips the outputs, and serves the download. Spaces are stripped from all form fields.

### Headshot Formatter
Downloaded files use the pattern `FirstName-LastName-Year-Suffix.ext`, with suffix text editable in the UI. Spaces are stripped from all fields, and download in the selected output formats: 

- `Website Bio`: `1024 × 683` JPEG
- `Spin Bio`: `510 × 510` JPEG
- `Nucleus Round`: `510 × 510` PNG with a circular mask

Framing is defined in `resources/template.json`. The template includes a reference face rectangle (`face_left`, `face_top`, `face_width`, `face_height`). The processor (`processor/run_processor.py`) detects the face in each uploaded image and warps the image so the detected face matches the template rectangle. Edit `resources/template.json` to adjust framing.

### Meta Image Generator
Downloaded files use the pattern `filename-Suffix.jpg`. The processor (`processor/run_meta_processor.py`) center-crops to the target aspect ratio and resizes with Lanczos interpolation. If a source image is smaller than a selected format, the image is still upscaled and cropped to fit, and a soft warning is shown in the UI listing the affected formats.

- `Facebook Image Post`: `1200 × 630` JPEG (Open Graph landscape)
- `Twitter Post Image`: `1200 × 675` JPEG
- `Square Social Post`: `1200 × 1200` JPEG

## Local Setup

**Install dependencies** — run once after cloning the repo, and again any time dependencies change.

```bash
npm install
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
```

**Dev mode** — use day-to-day while writing code; hot-reloads the UI as you save. Open <http://127.0.0.1:5173>.

```bash
npm run dev
```

**Production build** — use to preview what Heroku will actually serve before deploying. Open <http://127.0.0.1:8000>.

```bash
npm run build && npm run preview
```

## Deployment

Deployed on Heroku under the `atomic-object` team as the app `atomic-photographer`. One dyno hosts both the built frontend and the API — `backend/app.py` serves `dist/` when it exists.

**Config files in the repo:** `Procfile` (start command) and `.python-version` (runtime pin).

**Buildpacks**, in order:

1. `heroku/nodejs` — runs `npm run build`, producing `dist/`.
2. `heroku/python` — installs `requirements.txt`.

**To ship an update:**

```bash
git push origin main    # source of truth
git push heroku main    # triggers Heroku build + release
```

**To tail logs:** `heroku logs --tail --app atomic-photographer`

## API

| Endpoint | Purpose |
|---|---|
| `POST /api/process` | Headshot Formatter — multipart files + `metadata` JSON field |
| `POST /api/process-meta` | Meta Image Generator — same shape, different processor |
| `GET /api/download/:jobId` | Download the zipped result |
| `GET /api/health` | Health check |

To run a processor directly against a config JSON (useful for debugging):

```bash
python3 processor/run_processor.py /path/to/config.json        # headshots
python3 processor/run_meta_processor.py /path/to/config.json   # meta images
```

Headshot configs take `template_path`, `export_dir`, `photos`, and `formats`. Meta configs take `export_dir`, `photos`, and `formats`.

### Things to know

- **30-second request timeout.** Heroku cancels requests whose first bytes aren't returned within 30s. Small batches are fine; very large batches may hit `H12` and need to be split.
- **Ephemeral filesystem.** Dynos restart on deploy and at least once a day. In-memory jobs and temp files are lost at restart — only an issue if someone submits and walks away for a long time.
- **Dyno size.** Eco (512 MB) sleeps after 30 min idle. Upgrade with `heroku ps:resize web=basic` if usage is regular or OpenCV flags memory pressure.
