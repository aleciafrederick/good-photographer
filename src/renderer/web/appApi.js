let progressCallback = null;
let lastProgress = null;
let currentRunToken = 0;

function emitProgress(progress, runToken = currentRunToken) {
  lastProgress = progress;
  if (progressCallback && runToken === currentRunToken) {
    progressCallback(progress);
  }
}

function selectPhotos() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/jpeg,image/png,image/gif,image/webp,image/*';
    input.onchange = () => {
      const files = Array.from(input.files || []);
      resolve(
        files.map((file) => ({
          path: file.name,
          file,
        }))
      );
    };
    input.click();
  });
}

const PROCESSOR_TIMEOUT_MS = 300000;

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildMetadata(payload) {
  return {
    photos: payload.photos.map((photo) => ({
      path: photo.path,
      firstName: photo.firstName,
      lastName: photo.lastName,
      year: photo.year,
    })),
    formats: payload.formats,
  };
}

function buildFormData(payload) {
  const formData = new FormData();
  formData.append('metadata', JSON.stringify(buildMetadata(payload)));
  payload.photos.forEach((photo, index) => {
    if (!photo.file) {
      throw new Error(`Missing upload for photo ${index + 1}.`);
    }
    formData.append('files', photo.file, photo.file.name || photo.path || `photo-${index + 1}`);
  });
  return formData;
}

async function fetchJsonOrThrow(response) {
  let data = null;
  try {
    data = await response.json();
  } catch (_) {}

  if (!response.ok) {
    const detail = data?.detail || data?.error || 'Request failed.';
    throw new Error(detail);
  }

  return data;
}

async function downloadProcessedZip(downloadUrl, filename) {
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error('Processed files are ready, but the zip download failed.');
  }
  const blob = await response.blob();
  triggerDownload(blob, filename);
}

function runProcessor(payload) {
  const runToken = ++currentRunToken;
  emitProgress(
    {
      current: 0,
      total: payload.photos.length,
      phase: 'uploading',
      phaseLabel: 'Uploading photos…',
      step: 'uploading',
      stepLabel: 'Uploading photos and submitting job…',
      errorCount: 0,
    },
    runToken
  );

  const processorPromise = fetch('/api/process', {
    method: 'POST',
    body: buildFormData(payload),
  })
    .then(fetchJsonOrThrow)
    .then(async (result) => {
      emitProgress(
        {
          current: payload.photos.length,
          total: payload.photos.length,
          phase: 'server_processing',
          phaseLabel: 'Processing on server…',
          step: 'server_processing',
          stepLabel: 'Server processing finished. Preparing download…',
          errorCount: result.errors?.length || 0,
        },
        runToken
      );

      const downloaded = Boolean(result.downloadUrl);
      if (downloaded) {
        emitProgress(
          {
            current: payload.photos.length,
            total: payload.photos.length,
            phase: 'downloading_result',
            phaseLabel: 'Downloading result…',
            step: 'downloading_result',
            stepLabel: 'Downloading processed zip…',
            errorCount: result.errors?.length || 0,
          },
          runToken
        );
        await downloadProcessedZip(result.downloadUrl, result.downloadFilename || 'GoodPhotographer.zip');
      }

      return {
        success: result.success !== false,
        downloaded,
        errors: result.errors || [],
      };
    })
    .catch((err) => {
      throw err instanceof Error ? err : new Error(String(err));
    });

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(
      () => reject(new Error('Processing timed out. Open DevTools (F12 or Cmd+Option+I) and check the Console for errors.')),
      PROCESSOR_TIMEOUT_MS
    );
  });

  return Promise.race([processorPromise, timeoutPromise]);
}

function onProcessorProgress(fn) {
  progressCallback = fn;
  if (lastProgress) {
    fn(lastProgress);
  }
  return () => {
    if (progressCallback === fn) {
      progressCallback = null;
    }
  };
}

export const appAPI = {
  selectPhotos,
  runProcessor,
  onProcessorProgress,
};
