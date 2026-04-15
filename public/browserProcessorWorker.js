const OPENCV_JS_URL = 'https://docs.opencv.org/4.8.0/opencv.js';
const OPENCV_LOAD_TIMEOUT_MS = 120000;
const MAX_DETECTION_DIM = 1600;
const DEFAULT_FORMAT_SUFFIXES = {
  website_bio: 'Bio',
  spin_bio: 'Spin',
  nucleus_round: 'Nucleus',
};
const FORMAT_EXTENSIONS = {
  website_bio: 'jpg',
  spin_bio: 'jpg',
  nucleus_round: 'png',
};

let cvPromise = null;

function postProgress(payload) {
  self.postMessage({ type: 'progress', payload });
}

function getBaseUrl(baseUrl) {
  return baseUrl || './';
}

function sanitize(value) {
  return (value || '')
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .trim() || 'Unknown';
}

function sanitizeFilenamePart(value) {
  return String(value || '')
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .trim();
}

function baseFilename(lastName, firstName, year) {
  return `${sanitize(lastName)}-${sanitize(firstName)}-${String(year).trim()}`;
}

function makeUniqueName(base, ext, used) {
  let name = `${base}.${ext}`;
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  let i = 1;
  while (used.has(`${base}-${i}.${ext}`)) i += 1;
  name = `${base}-${i}.${ext}`;
  used.add(name);
  return name;
}

function normalizeFormats(formats) {
  return (Array.isArray(formats) ? formats : [])
    .map((format) => {
      if (typeof format === 'string') {
        const defaultSuffix = DEFAULT_FORMAT_SUFFIXES[format];
        const ext = FORMAT_EXTENSIONS[format];
        if (!defaultSuffix || !ext) return null;
        return { id: format, suffix: defaultSuffix, ext };
      }

      if (!format || typeof format !== 'object') return null;

      const id = format.id;
      const defaultSuffix = DEFAULT_FORMAT_SUFFIXES[id];
      const ext = FORMAT_EXTENSIONS[id];
      if (!defaultSuffix || !ext) return null;

      const cleanSuffix = sanitizeFilenamePart(format.suffix);
      return {
        id,
        suffix: cleanSuffix || defaultSuffix,
        ext,
      };
    })
    .filter(Boolean);
}

function createProgress(state, extra = {}) {
  return {
    current: state.current,
    total: state.total,
    phase: state.phase,
    phaseLabel: state.phaseLabel,
    step: state.step,
    stepLabel: state.stepLabel,
    imageNumber: state.imageNumber,
    imageName: state.imageName,
    errorCount: state.errorCount || 0,
    ...extra,
  };
}

function updateProgress(state, updates) {
  Object.assign(state, updates);
  postProgress(createProgress(state));
}

function loadOpenCV() {
  if (self.cv?.Mat) return Promise.resolve(self.cv);
  if (cvPromise) return cvPromise;

  cvPromise = new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('OpenCV.js is taking too long to load. Check your network or try again.'));
    }, OPENCV_LOAD_TIMEOUT_MS);

    try {
      self.importScripts(OPENCV_JS_URL);
    } catch (error) {
      clearTimeout(timeoutId);
      reject(new Error(`Failed to load OpenCV.js: ${error.message || error}`));
      return;
    }

    if (!self.cv) {
      clearTimeout(timeoutId);
      reject(new Error('OpenCV.js loaded but the cv object was not created.'));
      return;
    }

    if (self.cv.Mat) {
      clearTimeout(timeoutId);
      resolve(self.cv);
      return;
    }

    self.cv.onRuntimeInitialized = () => {
      clearTimeout(timeoutId);
      resolve(self.cv);
    };
  });

  return cvPromise;
}

async function loadTemplate(baseUrl) {
  const res = await fetch(`${getBaseUrl(baseUrl)}template.json`);
  if (!res.ok) throw new Error('Failed to load template.json');
  return res.json();
}

async function loadCascade(cv, baseUrl) {
  const res = await fetch(`${getBaseUrl(baseUrl)}cascades/haarcascade_frontalface_default.xml`);
  if (!res.ok) throw new Error('Failed to load face cascade');
  const xml = await res.text();
  const name = '/haarcascade_frontalface_default.xml';
  try {
    cv.FS_unlink(name);
  } catch (_) {}
  cv.FS_createDataFile('/', name.slice(1), xml, true, false, false);
  const classifier = new cv.CascadeClassifier();
  classifier.load(name);
  return classifier;
}

function createDetectionMat(cv, srcMat) {
  const maxDim = Math.max(srcMat.cols, srcMat.rows);
  if (maxDim <= MAX_DETECTION_DIM) {
    return {
      mat: srcMat,
      scaleX: 1,
      scaleY: 1,
      dispose() {},
    };
  }

  const scale = MAX_DETECTION_DIM / maxDim;
  const width = Math.max(1, Math.round(srcMat.cols * scale));
  const height = Math.max(1, Math.round(srcMat.rows * scale));
  const resized = new cv.Mat();
  cv.resize(srcMat, resized, new cv.Size(width, height), 0, 0, cv.INTER_AREA);

  return {
    mat: resized,
    scaleX: srcMat.cols / width,
    scaleY: srcMat.rows / height,
    dispose() {
      resized.delete();
    },
  };
}

function scaleFaceRect(faceRect, scaleX, scaleY) {
  const [x, y, w, h] = faceRect;
  return [
    Math.round(x * scaleX),
    Math.round(y * scaleY),
    Math.round(w * scaleX),
    Math.round(h * scaleY),
  ];
}

function detectFace(cv, classifier, gray) {
  const faces = new cv.RectVector();
  try {
    classifier.detectMultiScale(gray, faces, 1.1, 5, 0, new cv.Size(80, 80), new cv.Size(0, 0));
  } catch (_) {
    classifier.detectMultiScale(gray, faces);
  }

  if (faces.size() === 0) {
    faces.delete();
    return null;
  }

  let maxArea = 0;
  let best = null;
  for (let i = 0; i < faces.size(); i += 1) {
    const rect = faces.get(i);
    const area = rect.width * rect.height;
    if (area > maxArea) {
      maxArea = area;
      best = [rect.x, rect.y, rect.width, rect.height];
    }
  }
  faces.delete();
  return best;
}

function affineFaceToFace(srcFace, targetFace) {
  const [sx, sy, sw, sh] = srcFace;
  const [tx, ty, tw, th] = targetFace;
  if (sw <= 0 || sh <= 0 || tw <= 0 || th <= 0) {
    return [1, 0, 0, 0, 1, 0];
  }
  const scale = Math.min(tw / sw, th / sh);
  const srcCx = sx + sw * 0.5;
  const srcCy = sy + sh * 0.5;
  const targetCx = tx + tw * 0.5;
  const targetCy = ty + th * 0.5;
  return [
    scale,
    0,
    targetCx - scale * srcCx,
    0,
    scale,
    targetCy - scale * srcCy,
  ];
}

function alignByFace(cv, srcMat, faceRect, template) {
  const matrixValues = affineFaceToFace(faceRect, [
    template.face_left,
    template.face_top,
    template.face_width,
    template.face_height,
  ]);
  const matrix = cv.matFromArray(2, 3, cv.CV_32FC1, matrixValues);
  const dst = new cv.Mat();
  cv.warpAffine(
    srcMat,
    dst,
    matrix,
    new cv.Size(template.canvas_width, template.canvas_height),
    cv.INTER_LINEAR,
    cv.BORDER_REPLICATE
  );
  matrix.delete();
  return dst;
}

async function fileToMat(cv, file) {
  if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') {
    throw new Error('This browser is missing worker image APIs required for browser processing.');
  }

  const bitmap = await createImageBitmap(file);
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Could not create an offscreen canvas context.');
    context.drawImage(bitmap, 0, 0);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    return cv.matFromImageData(imageData);
  } finally {
    if (bitmap.close) bitmap.close();
  }
}

function matToImageData(mat) {
  return new ImageData(new Uint8ClampedArray(mat.data), mat.cols, mat.rows);
}

async function matToBlob(mat, type, quality) {
  const canvas = new OffscreenCanvas(mat.cols, mat.rows);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create an offscreen canvas context.');
  context.putImageData(matToImageData(mat), 0, 0);
  if (type === 'image/jpeg') {
    return canvas.convertToBlob({ type, quality });
  }
  return canvas.convertToBlob({ type });
}

function convertToGray(cv, src, dst) {
  if (src.channels() === 4) {
    cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY);
    return;
  }
  if (src.channels() === 3) {
    cv.cvtColor(src, dst, cv.COLOR_RGB2GRAY);
    return;
  }
  src.copyTo(dst);
}

async function exportWebsiteBio(cv, aligned, templateFormat) {
  const width = templateFormat.width || 1024;
  const height = templateFormat.height || 683;
  const canvasH = aligned.rows;
  const canvasW = aligned.cols;
  const targetAspect = width / height;
  const canvasAspect = canvasW / canvasH;
  let crop;
  if (canvasAspect >= targetAspect) {
    const cropW = Math.floor(canvasH * targetAspect);
    const x0 = Math.floor((canvasW - cropW) / 2);
    crop = aligned.roi(new cv.Rect(x0, 0, cropW, canvasH));
  } else {
    const cropH = Math.floor(canvasW / targetAspect);
    const y0 = Math.floor((canvasH - cropH) / 2);
    crop = aligned.roi(new cv.Rect(0, y0, canvasW, cropH));
  }

  const resized = new cv.Mat();
  cv.resize(crop, resized, new cv.Size(width, height), 0, 0, cv.INTER_LINEAR);
  if (crop !== aligned) crop.delete();
  try {
    return await matToBlob(resized, 'image/jpeg', 0.92);
  } finally {
    resized.delete();
  }
}

async function exportSpinBio(cv, aligned, templateFormat) {
  const size = templateFormat.width || 510;
  const square = Math.min(aligned.cols, aligned.rows);
  const x0 = Math.floor((aligned.cols - square) / 2);
  const y0 = Math.floor((aligned.rows - square) / 2);
  const crop = aligned.roi(new cv.Rect(x0, y0, square, square));
  const resized = new cv.Mat();
  cv.resize(crop, resized, new cv.Size(size, size), 0, 0, cv.INTER_LINEAR);
  if (crop !== aligned) crop.delete();
  try {
    return await matToBlob(resized, 'image/jpeg', 0.92);
  } finally {
    resized.delete();
  }
}

async function exportNucleusRound(cv, aligned, templateFormat) {
  const size = templateFormat.width || 510;
  const square = Math.min(aligned.cols, aligned.rows);
  const x0 = Math.floor((aligned.cols - square) / 2);
  const y0 = Math.floor((aligned.rows - square) / 2);
  const crop = aligned.roi(new cv.Rect(x0, y0, square, square));
  const resized = new cv.Mat();
  cv.resize(crop, resized, new cv.Size(size, size), 0, 0, cv.INTER_LINEAR);
  if (crop !== aligned) crop.delete();

  const mask = cv.Mat.zeros(size, size, cv.CV_8UC1);
  cv.circle(mask, new cv.Point(Math.floor(size / 2), Math.floor(size / 2)), Math.floor(size / 2), [255], -1);

  const rgba = resized.clone();
  const rgbaData = rgba.data;
  const maskData = mask.data;
  for (let i = 0; i < size * size; i += 1) {
    rgbaData[i * 4 + 3] = maskData[i];
  }

  try {
    return await matToBlob(rgba, 'image/png');
  } finally {
    resized.delete();
    mask.delete();
    rgba.delete();
  }
}

async function processOnePhoto(cv, classifier, template, photo, formats, usedFilenames, state, photoIndex) {
  const imageNumber = photoIndex + 1;
  const imageName = photo.file?.name || photo.path || `Image ${imageNumber}`;
  const base = baseFilename(photo.lastName, photo.firstName, photo.year);
  const results = [];
  const selectedFormats = new Map(formats.map((format) => [format.id, format]));

  let img = null;
  let aligned = null;
  let gray = null;
  let detection = null;

  try {
    updateProgress(state, {
      phase: 'processing',
      phaseLabel: 'Processing photos…',
      step: 'preparing_image',
      stepLabel: 'Preparing image…',
      imageNumber,
      imageName,
    });

    img = await fileToMat(cv, photo.file);
    if (!img || img.empty()) {
      throw new Error(`Could not read image: ${imageName}`);
    }

    detection = createDetectionMat(cv, img);
    gray = new cv.Mat();

    updateProgress(state, {
      phase: 'processing',
      phaseLabel: 'Processing photos…',
      step: 'detecting_face',
      stepLabel: 'Detecting face…',
      imageNumber,
      imageName,
    });

    convertToGray(cv, detection.mat, gray);
    cv.equalizeHist(gray, gray);
    const detected = detectFace(cv, classifier, gray);
    if (!detected) {
      return { results, error: `No face detected in ${imageName} (${photo.firstName} ${photo.lastName})` };
    }

    updateProgress(state, {
      phase: 'processing',
      phaseLabel: 'Processing photos…',
      step: 'aligning_image',
      stepLabel: 'Aligning image…',
      imageNumber,
      imageName,
    });

    aligned = alignByFace(cv, img, scaleFaceRect(detected, detection.scaleX, detection.scaleY), template);

    const templateFormats = template.formats || {};
    if (selectedFormats.has('website_bio')) {
      const format = selectedFormats.get('website_bio');
      updateProgress(state, {
        phase: 'processing',
        phaseLabel: 'Processing photos…',
        step: 'exporting_website_bio',
        stepLabel: 'Exporting Website Bio…',
        imageNumber,
        imageName,
      });
      results.push({
        name: makeUniqueName(base + format.suffix, format.ext, usedFilenames),
        blob: await exportWebsiteBio(cv, aligned, templateFormats.website_bio || {}),
      });
    }

    if (selectedFormats.has('spin_bio')) {
      const format = selectedFormats.get('spin_bio');
      updateProgress(state, {
        phase: 'processing',
        phaseLabel: 'Processing photos…',
        step: 'exporting_spin_bio',
        stepLabel: 'Exporting Spin Bio…',
        imageNumber,
        imageName,
      });
      results.push({
        name: makeUniqueName(base + format.suffix, format.ext, usedFilenames),
        blob: await exportSpinBio(cv, aligned, templateFormats.spin_bio || {}),
      });
    }

    if (selectedFormats.has('nucleus_round')) {
      const format = selectedFormats.get('nucleus_round');
      updateProgress(state, {
        phase: 'processing',
        phaseLabel: 'Processing photos…',
        step: 'exporting_nucleus_round',
        stepLabel: 'Exporting Nucleus Round…',
        imageNumber,
        imageName,
      });
      results.push({
        name: makeUniqueName(base + format.suffix, format.ext, usedFilenames),
        blob: await exportNucleusRound(cv, aligned, templateFormats.nucleus_round || {}),
      });
    }

    return { results, error: null };
  } finally {
    if (gray) gray.delete();
    if (detection) detection.dispose();
    if (aligned) aligned.delete();
    if (img) img.delete();
  }
}

async function runBrowserProcessor(payload) {
  const { photos, formats, baseUrl } = payload;
  const normalizedFormats = normalizeFormats(formats);
  const state = {
    current: 0,
    total: photos.length,
    phase: 'starting',
    phaseLabel: 'Starting…',
    step: 'starting',
    stepLabel: 'Starting browser processor…',
    imageNumber: null,
    imageName: null,
    errorCount: 0,
  };
  const files = [];
  const errors = [];

  updateProgress(state, {
    phase: 'loading_opencv',
    phaseLabel: 'Loading browser processor…',
    step: 'loading_opencv',
    stepLabel: 'Loading OpenCV…',
  });
  const cv = await loadOpenCV();

  updateProgress(state, {
    phase: 'loading_template',
    phaseLabel: 'Loading browser processor…',
    step: 'loading_template',
    stepLabel: 'Loading template…',
  });
  const template = await loadTemplate(baseUrl);

  updateProgress(state, {
    phase: 'loading_cascade',
    phaseLabel: 'Loading browser processor…',
    step: 'loading_cascade',
    stepLabel: 'Loading face detector…',
  });
  const classifier = await loadCascade(cv, baseUrl);

  const usedFilenames = new Set();

  try {
    for (let i = 0; i < photos.length; i += 1) {
      state.current = i;
      const photo = photos[i];
      if (!photo.file) {
        errors.push(`No file for photo: ${photo.path || i + 1}`);
        state.errorCount = errors.length;
        continue;
      }

      try {
        const { results, error } = await processOnePhoto(
          cv,
          classifier,
          template,
          photo,
          normalizedFormats,
          usedFilenames,
          state,
          i
        );
        files.push(...results);
        if (error) errors.push(error);
      } catch (error) {
        errors.push(`${photo.path || photo.file?.name}: ${error.message || error}`);
      }

      state.current = i + 1;
      state.errorCount = errors.length;
      updateProgress(state, {
        phase: 'processing',
        phaseLabel: 'Processing photos…',
        step: 'photo_complete',
        stepLabel: 'Finished image.',
        imageNumber: i + 1,
        imageName: photo.file?.name || photo.path || `Image ${i + 1}`,
      });
    }
  } finally {
    try {
      classifier.delete();
    } catch (_) {}
  }

  return { files, errors };
}

self.onmessage = async (event) => {
  if (event.data?.type !== 'start') return;

  try {
    const result = await runBrowserProcessor(event.data.payload);
    self.postMessage({ type: 'complete', payload: result });
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
