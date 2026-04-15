const STUCK_WARNING_MS = 15000;
const OVERALL_TIMEOUT_MS = 180000;

function getBaseUrl() {
  return (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || './';
}

function getWorkerUrl() {
  return new URL(`${getBaseUrl()}browserProcessorWorker.js`, window.location.href);
}

function describeProgress(progress) {
  return progress?.stepLabel || progress?.phaseLabel || 'processing';
}

function getStallTimeoutMs(progress) {
  if (progress?.phase === 'loading_opencv') return 130000;
  if (progress?.phase === 'creating_zip') return 60000;
  return 45000;
}

export function runBrowserProcessor(payload, onProgress) {
  if (typeof Worker === 'undefined') {
    return Promise.reject(new Error('This browser does not support background workers for image processing.'));
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(getWorkerUrl());
    let settled = false;
    let warningTimer = null;
    let stallTimer = null;
    let overallTimer = null;
    let lastProgress = {
      current: 0,
      total: payload.photos.length,
      phase: 'starting',
      stepLabel: 'Starting browser processor…',
      warning: null,
    };

    const cleanup = () => {
      if (warningTimer) clearTimeout(warningTimer);
      if (stallTimer) clearTimeout(stallTimer);
      if (overallTimer) clearTimeout(overallTimer);
      worker.terminate();
    };

    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    const succeed = (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const scheduleTimers = () => {
      if (warningTimer) clearTimeout(warningTimer);
      if (stallTimer) clearTimeout(stallTimer);

      warningTimer = setTimeout(() => {
        onProgress?.({
          ...lastProgress,
          warning: `Still working on ${describeProgress(lastProgress)}.`,
        });
      }, STUCK_WARNING_MS);

      stallTimer = setTimeout(() => {
        fail(
          new Error(
            `Processing appears stuck while ${describeProgress(lastProgress)}. Please try again or use a smaller image.`
          )
        );
      }, getStallTimeoutMs(lastProgress));
    };

    overallTimer = setTimeout(() => {
      fail(new Error('Processing timed out. Open DevTools (F12 or Cmd+Option+I) and check the Console for errors.'));
    }, OVERALL_TIMEOUT_MS);

    worker.onmessage = (event) => {
      const data = event.data || {};
      if (data.type === 'progress') {
        lastProgress = {
          ...lastProgress,
          ...data.payload,
          warning: null,
        };
        onProgress?.(lastProgress);
        scheduleTimers();
        return;
      }

      if (data.type === 'complete') {
        succeed(data.payload);
        return;
      }

      if (data.type === 'error') {
        fail(new Error(data.error || 'Browser processor failed.'));
      }
    };

    worker.onerror = (event) => {
      fail(new Error(event.message || 'Browser processor worker failed.'));
    };

    scheduleTimers();
    worker.postMessage({
      type: 'start',
      payload: {
        ...payload,
        baseUrl: getBaseUrl(),
      },
    });
  });
}
