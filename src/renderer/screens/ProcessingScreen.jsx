import { useState, useEffect } from 'react';

const PHASE_LABELS = {
  uploading: 'Uploading photos…',
  server_processing: 'Processing on server…',
  downloading_result: 'Downloading result…',
  loading_opencv: 'Loading OpenCV… (first time may take 1–2 min)',
  loading_template: 'Loading template…',
  loading_cascade: 'Loading face detector…',
  processing: 'Processing photos…',
  creating_zip: 'Creating download…',
};

export default function ProcessingScreen({ total }) {
  const [progress, setProgress] = useState({
    current: 0,
    phase: null,
    stepLabel: null,
    imageNumber: null,
    imageName: null,
    errorCount: 0,
    warning: null,
  });

  useEffect(() => {
    const unbind = window.electronAPI.onProcessorProgress((data) => {
      setProgress((prev) => ({
        ...prev,
        ...data,
      }));
    });
    return () => {
      if (typeof unbind === 'function') unbind();
    };
  }, []);

  const phaseLabel = progress.phase && PHASE_LABELS[progress.phase];
  const progressText = progress.stepLabel || phaseLabel || `Processing ${progress.current} of ${total}`;
  const imageText = progress.imageNumber
    ? `Image ${progress.imageNumber} of ${total}${progress.imageName ? `: ${progress.imageName}` : ''}`
    : `Completed ${progress.current} of ${total}`;
  const errorText = progress.errorCount > 0 ? `${progress.errorCount} issue${progress.errorCount === 1 ? '' : 's'} so far` : null;

  return (
    <div className="processing">
      <h1>Processing</h1>
      <div className="processing-spinner" aria-hidden="true" />
      <p className="progress-text">{progressText}</p>
      <p className="progress-subtext">{imageText}</p>
      {errorText && <p className="progress-error-count">{errorText}</p>}
      {progress.warning && <p className="progress-warning">{progress.warning}</p>}
    </div>
  );
}
