import { useEffect, useState } from 'react';

const THUMB_SIZE = 40;
const filePreviewCache = new WeakMap();
const pathPreviewCache = new Map();
let previewQueue = Promise.resolve();

function stripSpaces(value) {
  return String(value).replace(/\s+/g, '');
}

function toFileUrl(filePath) {
  const normalizedPath = String(filePath || '').replace(/\\/g, '/');
  const pathname = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
  return encodeURI(`file://${pathname}`);
}

function schedulePreviewLoad(callback) {
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    const idleId = window.requestIdleCallback(callback, { timeout: 250 });
    return () => window.cancelIdleCallback(idleId);
  }

  const timeoutId = window.setTimeout(callback, 120);
  return () => window.clearTimeout(timeoutId);
}

function enqueuePreviewJob(task) {
  const job = previewQueue.then(task, task);
  previewQueue = job.catch(() => {});
  return job;
}

function drawCoverThumbnail(source, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_SIZE;
  canvas.height = THUMB_SIZE;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const scale = Math.max(THUMB_SIZE / width, THUMB_SIZE / height);
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  const x = (THUMB_SIZE - drawWidth) / 2;
  const y = (THUMB_SIZE - drawHeight) / 2;

  context.drawImage(source, x, y, drawWidth, drawHeight);
  return canvas.toDataURL('image/png');
}

async function createFilePreview(file) {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    try {
      return drawCoverThumbnail(bitmap, bitmap.width, bitmap.height);
    } finally {
      if (bitmap.close) bitmap.close();
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    return await createImagePreviewFromUrl(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function createImagePreviewFromUrl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      resolve(drawCoverThumbnail(img, img.naturalWidth || img.width, img.naturalHeight || img.height));
    };
    img.onerror = () => reject(new Error('Could not load thumbnail preview.'));
    img.src = src;
  });
}

function getCachedPreview(photo) {
  if (photo.file instanceof File) {
    return filePreviewCache.get(photo.file) || null;
  }
  if (typeof photo.path === 'string' && /[\\/]/.test(photo.path)) {
    return pathPreviewCache.get(photo.path) || null;
  }
  return null;
}

function storeCachedPreview(photo, preview) {
  if (!preview) return;
  if (photo.file instanceof File) {
    filePreviewCache.set(photo.file, preview);
    return;
  }
  if (typeof photo.path === 'string' && /[\\/]/.test(photo.path)) {
    pathPreviewCache.set(photo.path, preview);
  }
}

async function createTinyPreview(photo) {
  if (photo.file instanceof File) {
    return createFilePreview(photo.file);
  }

  if (typeof photo.path === 'string' && /[\\/]/.test(photo.path)) {
    return createImagePreviewFromUrl(toFileUrl(photo.path));
  }

  return null;
}

export default function PhotoRow({ photo, onChange, onRemove, valid }) {
  const [previewSrc, setPreviewSrc] = useState(null);

  useEffect(() => {
    const cachedPreview = getCachedPreview(photo);
    if (cachedPreview) {
      setPreviewSrc(cachedPreview);
      return undefined;
    }

    setPreviewSrc(null);
    let cancelled = false;

    const cancelScheduledLoad = schedulePreviewLoad(() => {
      if (cancelled) return;

      enqueuePreviewJob(() => createTinyPreview(photo))
        .then((preview) => {
          if (cancelled || !preview) return;
          storeCachedPreview(photo, preview);
          setPreviewSrc(preview);
        })
        .catch(() => {});
    });

    return () => {
      cancelled = true;
      cancelScheduledLoad();
    };
  }, [photo.file, photo.path]);

  return (
    <div className={`photo-row ${valid ? '' : 'invalid'}`}>
      <div className="field field-first">
        <label>First Name*</label>
        <input
          value={photo.firstName}
          onChange={(e) => onChange({ firstName: stripSpaces(e.target.value) })}
          placeholder="First name"
        />
      </div>
      <div className="field field-last">
        <label>Last Name*</label>
        <input
          value={photo.lastName}
          onChange={(e) => onChange({ lastName: stripSpaces(e.target.value) })}
          placeholder="Last name"
        />
      </div>
      <div className="field field-year">
        <label>Year*</label>
        <input
          value={photo.year}
          onChange={(e) => onChange({ year: stripSpaces(e.target.value) })}
          placeholder="YYYY"
          maxLength={4}
        />
      </div>
      <div className="field field-filename">
        <label>Filename</label>
        <div className="filename-display" title={photo.name}>
          {previewSrc ? (
            <img src={previewSrc} alt="" className="filename-thumb" loading="lazy" decoding="async" />
          ) : (
            <div className="filename-thumb filename-thumb-placeholder" aria-hidden="true" />
          )}
          <span className="filename-text">
            <span className="filename-base">{getBaseName(photo.name)}</span>
            <span className="filename-ext">{getExtension(photo.name)}</span>
          </span>
        </div>
      </div>
      <button
        type="button"
        className="btn btn-outline delete-btn"
        onClick={onRemove}
        aria-label="Remove photo"
        title="Remove photo"
      >
        <svg
          className="delete-icon"
          viewBox="0 0 16 16"
          width="14"
          height="14"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M3 3 L13 13 M13 3 L3 13"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="square"
          />
        </svg>
      </button>
    </div>
  );
}

function getBaseName(name) {
  if (!name) return '';
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

function getExtension(name) {
  if (!name) return '';
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot) : '';
}
