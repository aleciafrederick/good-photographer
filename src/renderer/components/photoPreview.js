const THUMB_SIZE = 40;
const filePreviewCache = new WeakMap();
const pathPreviewCache = new Map();
let previewQueue = Promise.resolve();

function toFileUrl(filePath) {
  const normalizedPath = String(filePath || '').replace(/\\/g, '/');
  const pathname = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
  return encodeURI(`file://${pathname}`);
}

export function schedulePreviewLoad(callback) {
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    const idleId = window.requestIdleCallback(callback, { timeout: 250 });
    return () => window.cancelIdleCallback(idleId);
  }

  const timeoutId = window.setTimeout(callback, 120);
  return () => window.clearTimeout(timeoutId);
}

export function enqueuePreviewJob(task) {
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

function buildPreview(source, width, height) {
  const dataUrl = drawCoverThumbnail(source, width, height);
  if (!dataUrl) return null;
  return { dataUrl, width, height };
}

async function createFilePreview(file) {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    try {
      return buildPreview(bitmap, bitmap.width, bitmap.height);
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
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      resolve(buildPreview(img, width, height));
    };
    img.onerror = () => reject(new Error('Could not load thumbnail preview.'));
    img.src = src;
  });
}

export function getCachedPreview(photo) {
  if (photo.file instanceof File) {
    return filePreviewCache.get(photo.file) || null;
  }
  if (typeof photo.path === 'string' && /[\\/]/.test(photo.path)) {
    return pathPreviewCache.get(photo.path) || null;
  }
  return null;
}

export function storeCachedPreview(photo, preview) {
  if (!preview) return;
  if (photo.file instanceof File) {
    filePreviewCache.set(photo.file, preview);
    return;
  }
  if (typeof photo.path === 'string' && /[\\/]/.test(photo.path)) {
    pathPreviewCache.set(photo.path, preview);
  }
}

export async function createTinyPreview(photo) {
  if (photo.file instanceof File) {
    return createFilePreview(photo.file);
  }

  if (typeof photo.path === 'string' && /[\\/]/.test(photo.path)) {
    return createImagePreviewFromUrl(toFileUrl(photo.path));
  }

  return null;
}
