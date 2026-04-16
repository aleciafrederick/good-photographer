# Atomic Photographer

Atomic Photographer is a web app for producing consistent image exports for the web. It ships with two tools in a single interface:

- **Headshot Formatter** — batch-align headshots to a shared face-framing template and export them in standard bio formats.
- **Meta Image Generator** — center-crop and resize any image into the standard sizes used in Open Graph and Twitter meta tags.

Upload photos, fill in the per-photo metadata, choose output formats, and download the results as a zip.

The frontend is built with React and Vite. The backend is a FastAPI app that receives uploads, runs a Python/OpenCV processor, zips the generated files, and serves the download.

## How It Works

1. Pick a tool in the left column: **Headshot Formatter** or **Meta Image Generator**.
2. Upload one or more photos.
3. Fill in the required fields for each photo (see below).
4. Choose one or more output formats and optional filename suffixes.
5. Submit. The backend runs the appropriate processor against the uploaded files.
6. The processed files are zipped and downloaded to the browser.

Processing and confirmation both happen inline on the right side of the app, so the tool tabs on the left stay available throughout the flow. Resetting clears only the active tool.

## Headshot Formatter

### Per-photo fields

- First name
- Last name
- Year

### Output formats

- `Website Bio`: `1024 × 683` JPEG
- `Spin Bio`: `510 × 510` JPEG
- `Nucleus Round`: `510 × 510` PNG with a circular mask

Downloaded files use the pattern `FirstName-LastName-Year-Suffix.ext`, with suffix text editable in the UI. Spaces are stripped from all fields.

### Alignment template

Framing is defined in `resources/template.json`. The template includes:

- the output canvas size
- a reference face rectangle (`face_left`, `face_top`, `face_width`, `face_height`)
- per-format export sizing

The processor (`processor/run_processor.py`) detects the face in each uploaded image and warps the image so the detected face matches the template rectangle. Edit `resources/template.json` to adjust framing.

## Meta Image Generator

### Per-photo fields

- Filename (base name used to build each output file, e.g. `homepage-hero`)

### Output formats

- `Facebook Image Post`: `1200 × 630` JPEG (Open Graph landscape)
- `Twitter Post Image`: `1200 × 675` JPEG
- `Square Social Post`: `1200 × 1200` JPEG

Downloaded files use the pattern `filename-Suffix.jpg`. The processor (`processor/run_meta_processor.py`) center-crops to the target aspect ratio and resizes with Lanczos interpolation.

If a source image is smaller than a selected format, the image is still upscaled and cropped to fit, and a soft warning is shown in the UI listing the affected formats.

## Requirements

- `Node.js` 18+
- `Python` 3.10+

## Local Setup

### 1. Install dependencies

```bash
npm install
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
```

### 2. Run the app in development

```bash
npm run dev
```

This starts:

- the Vite frontend at `http://127.0.0.1:5173`
- the FastAPI backend at `http://127.0.0.1:8000`

The Vite dev server proxies `/api` requests to the backend, so use the Vite URL during development.

### 3. Test the production-style app locally

Build the frontend, then serve the built app and API together through FastAPI:

```bash
npm run build
npm run preview
```

Open `http://127.0.0.1:8000`. When `dist/` exists, `backend/app.py` serves the built frontend and the API from the same process, which matches a production deployment more closely than Vite dev mode.

## API Endpoints

- `POST /api/process` — Headshot Formatter. Multipart upload of photo files plus a `metadata` JSON field.
- `POST /api/process-meta` — Meta Image Generator. Same shape, different processor.
- `GET /api/download/:jobId` — Download the zipped result for a finished job.
- `GET /api/health` — Health check.

## Local Processor Testing

To test either Python processor directly:

```bash
python3 processor/run_processor.py /path/to/config.json        # headshots
python3 processor/run_meta_processor.py /path/to/config.json   # meta images
```

The headshot config file should contain `template_path`, `export_dir`, `photos`, and `formats`. The meta config file takes `export_dir`, `photos`, and `formats` (no template).

## Export Behavior

Processed results are downloaded as a zip file, for example:

```text
AtomicPhotographer-YYYY-MM-DD_HHMMSS.zip   # headshots
AtomicMeta-YYYY-MM-DD_HHMMSS.zip           # meta images
```

The backend creates temporary job folders and cleans them up after download or expiration.
