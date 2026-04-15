import json
import shutil
import subprocess
import sys
import tempfile
import time
import uuid
import zipfile
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.background import BackgroundTask


ROOT_DIR = Path(__file__).resolve().parents[1]
DIST_DIR = ROOT_DIR / 'dist'
PROCESSOR_SCRIPT = ROOT_DIR / 'processor' / 'run_processor.py'
TEMPLATE_PATH = ROOT_DIR / 'resources' / 'template.json'
JOBS_ROOT = Path(tempfile.gettempdir()) / 'good-photographer-jobs'
JOBS_ROOT.mkdir(parents=True, exist_ok=True)
PROCESSOR_TIMEOUT_SECONDS = 300
JOB_TTL_SECONDS = 60 * 60

app = FastAPI(title='GoodPhotographer API')
jobs = {}


def cleanup_job(job_id):
    job = jobs.pop(job_id, None)
    if not job:
        return
    shutil.rmtree(job['temp_dir'], ignore_errors=True)


def cleanup_temp_dir(temp_dir):
    shutil.rmtree(temp_dir, ignore_errors=True)


def purge_expired_jobs():
    now = time.time()
    expired_job_ids = [
        job_id
        for job_id, job in jobs.items()
        if now - job['created_at'] > JOB_TTL_SECONDS
    ]
    for job_id in expired_job_ids:
        cleanup_job(job_id)


def parse_processor_errors(stdout_text, stderr_text, exit_code):
    errors = []
    for line in stdout_text.splitlines():
        if line.startswith('ERROR:'):
            errors.append(line[6:].strip())

    if exit_code != 0:
        stderr_excerpt = stderr_text.strip()
        if stderr_excerpt:
            tail_lines = '\n'.join(stderr_excerpt.splitlines()[-8:])
            errors.append(f'Processor exit {exit_code}: {tail_lines}')
        elif not errors:
            errors.append(f'Processor exited with code {exit_code}.')
    return errors


def build_download_filename():
    now = time.localtime()
    return time.strftime('GoodPhotographer-%Y-%m-%d_%H%M%S.zip', now)


def create_zip_file(export_dir, zip_path):
    with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zip_file:
        for file_path in sorted(export_dir.iterdir()):
            if file_path.is_file():
                zip_file.write(file_path, arcname=file_path.name)


def save_upload_file(upload, destination):
    with destination.open('wb') as output_file:
        shutil.copyfileobj(upload.file, output_file)


@app.get('/api/health')
def healthcheck():
    return {'ok': True}


@app.post('/api/process')
async def process_images(
    metadata: str = Form(...),
    files: list[UploadFile] = File(...),
):
    purge_expired_jobs()

    try:
        data = json.loads(metadata)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f'Invalid metadata JSON: {exc.msg}') from exc

    photos = data.get('photos') or []
    formats = data.get('formats') or []
    if not photos:
        raise HTTPException(status_code=400, detail='At least one photo is required.')
    if not files:
        raise HTTPException(status_code=400, detail='No uploaded files were provided.')
    if len(files) != len(photos):
        raise HTTPException(status_code=400, detail='Uploaded files do not match photo metadata.')
    if not formats:
        raise HTTPException(status_code=400, detail='At least one output format is required.')
    if not PROCESSOR_SCRIPT.exists():
        raise HTTPException(status_code=500, detail='Processor script is missing.')
    if not TEMPLATE_PATH.exists():
        raise HTTPException(status_code=500, detail='Template file is missing.')

    temp_dir = Path(tempfile.mkdtemp(prefix='goodphotographer-', dir=JOBS_ROOT))
    uploads_dir = temp_dir / 'uploads'
    export_dir = temp_dir / 'export'
    uploads_dir.mkdir(parents=True, exist_ok=True)
    export_dir.mkdir(parents=True, exist_ok=True)

    try:
        processor_photos = []
        for index, (photo_meta, upload) in enumerate(zip(photos, files), start=1):
            original_name = Path(upload.filename or f'photo-{index}.jpg').name
            suffix = Path(original_name).suffix or '.jpg'
            saved_path = uploads_dir / f'{index:03d}{suffix.lower()}'
            save_upload_file(upload, saved_path)
            processor_photos.append(
                {
                    'path': str(saved_path),
                    'firstName': str(photo_meta.get('firstName', '')).strip(),
                    'lastName': str(photo_meta.get('lastName', '')).strip(),
                    'year': str(photo_meta.get('year', '')).strip(),
                }
            )

        config_path = temp_dir / 'config.json'
        config_path.write_text(
            json.dumps(
                {
                    'template_path': str(TEMPLATE_PATH),
                    'export_dir': str(export_dir),
                    'photos': processor_photos,
                    'formats': formats,
                }
            ),
            encoding='utf-8',
        )

        completed = subprocess.run(
            [sys.executable, str(PROCESSOR_SCRIPT), str(config_path)],
            cwd=str(PROCESSOR_SCRIPT.parent),
            capture_output=True,
            text=True,
            timeout=PROCESSOR_TIMEOUT_SECONDS,
            check=False,
        )
        errors = parse_processor_errors(completed.stdout, completed.stderr, completed.returncode)

        output_files = [path for path in export_dir.iterdir() if path.is_file()]
        if not output_files:
            cleanup_temp_dir(temp_dir)
            return JSONResponse(
                {
                    'success': False,
                    'errors': errors or ['No files were generated.'],
                    'downloadUrl': None,
                    'downloadFilename': None,
                }
            )

        zip_name = build_download_filename()
        zip_path = temp_dir / zip_name
        create_zip_file(export_dir, zip_path)

        job_id = uuid.uuid4().hex
        jobs[job_id] = {
            'created_at': time.time(),
            'temp_dir': temp_dir,
            'zip_path': zip_path,
            'download_filename': zip_name,
        }

        return {
            'success': completed.returncode == 0,
            'errors': errors,
            'downloadUrl': f'/api/download/{job_id}',
            'downloadFilename': zip_name,
        }
    except subprocess.TimeoutExpired as exc:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=504, detail='Processing timed out on the server.') from exc
    except Exception:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise
    finally:
        for upload in files:
            await upload.close()


@app.get('/api/download/{job_id}')
def download_results(job_id: str):
    purge_expired_jobs()
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail='Download not found or has expired.')

    zip_path = job['zip_path']
    if not Path(zip_path).exists():
        cleanup_job(job_id)
        raise HTTPException(status_code=404, detail='Download file is no longer available.')

    return FileResponse(
        path=zip_path,
        filename=job['download_filename'],
        media_type='application/zip',
        background=BackgroundTask(cleanup_job, job_id),
    )


if DIST_DIR.exists():
    assets_dir = DIST_DIR / 'assets'
    if assets_dir.exists():
        app.mount('/assets', StaticFiles(directory=assets_dir), name='assets')

    @app.get('/')
    def serve_index():
        return FileResponse(DIST_DIR / 'index.html')

    @app.get('/{path:path}')
    def serve_spa(path: str):
        if path.startswith('api/'):
            raise HTTPException(status_code=404, detail='Not found')

        requested_path = DIST_DIR / path
        if requested_path.exists() and requested_path.is_file():
            return FileResponse(requested_path)
        return FileResponse(DIST_DIR / 'index.html')
else:
    @app.get('/')
    def root():
        return {'message': 'GoodPhotographer API is running. Build the frontend to serve the web app from this process.'}
