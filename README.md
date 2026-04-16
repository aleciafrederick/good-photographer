# GoodPhotographer

GoodPhotographer is a web app for batch-processing headshots so they share the same framing and export in standard formats. Upload photos, enter each person’s name and year, choose the output formats you want, and download the results as a zip file.

The frontend is built with React and Vite. The backend is a FastAPI app that receives uploads, runs the Python/OpenCV processor, zips the generated files, and serves the finished download. This repo is now web-only and is intended to be deployed on Railway.

## How It Works

1. Upload one or more photos in the browser.
2. Fill in first name, last name, and year for each photo.
3. Choose one or more output formats and optional filename suffix text.
4. Submit the job.
5. The backend runs `processor/run_processor.py` against the uploaded files.
6. The processed files are zipped and downloaded to the browser.

## Output Formats

- `Website Bio`: `1024 x 683` JPEG
- `Spin Bio`: `510 x 510` JPEG
- `Nucleus Round`: `510 x 510` PNG with a circular mask

Downloaded files use the pattern `LastName-FirstName-Year-Suffix.ext`, with suffix text editable in the UI.

## Alignment Template

Framing is defined in `resources/template.json`.

The template includes:

- the output canvas size
- a reference face rectangle using `face_left`, `face_top`, `face_width`, and `face_height`
- per-format export sizing

The processor detects the face in each uploaded image and warps the image so the detected face matches the template face rectangle. Update `resources/template.json` when you want to adjust framing.

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

The Vite dev server proxies `/api` requests to the backend, so you use the app through the Vite URL during development.

### 3. Test the production-style app locally

Build the frontend:

```bash
npm run build
```

Then serve the built app and API together through FastAPI:

```bash
npm run preview
```

Open `http://127.0.0.1:8000`.

When `dist/` exists, `backend/app.py` serves the built frontend and the API from the same process, which matches production more closely than Vite dev mode.

## Railway Deployment

Railway should build the frontend first, then start the FastAPI app.

Recommended commands:

- Build command: `npm install && python3 -m pip install -r requirements.txt && npm run build`
- Start command: `npm run start`

The start script runs:

```bash
python3 -m uvicorn backend.app:app --host 0.0.0.0 --port ${PORT:-8000}
```

Because `backend/app.py` serves `dist/` when it exists, one Railway service can host both:

- the frontend
- the `/api/process` upload endpoint
- the `/api/download/:jobId` download endpoint

## Local Processor Testing

If you need to test the Python processor directly, run:

```bash
python3 processor/run_processor.py /path/to/config.json
```

The config file should contain:

- `template_path`
- `export_dir`
- `photos`
- `formats`

## Export Behavior

Processed results are downloaded as a zip file such as:

```text
GoodPhotographer-YYYY-MM-DD_HHMMSS.zip
```

The backend creates temporary job folders and cleans them up after download or expiration.
